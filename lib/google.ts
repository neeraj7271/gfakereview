import type { BusinessProfile, GoogleCredential } from "@prisma/client";
import { analyzeAllReviews } from "@/lib/detection";
import { db } from "@/lib/db";
import { persistAnalysisResults } from "@/lib/dashboard";
import { getDefaultProfile } from "@/lib/profile";

const scopes = ["https://www.googleapis.com/auth/business.manage"];
const googleTokenUrl = "https://oauth2.googleapis.com/token";
const googleApiBaseUrl = "https://mybusiness.googleapis.com/v4";

type GoogleTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

type GoogleReview = {
  name?: string;
  reviewId?: string;
  reviewer?: {
    displayName?: string;
    profilePhotoUrl?: string;
  };
  starRating?: string;
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: {
    comment?: string;
  };
};

type GoogleReviewsResponse = {
  reviews?: GoogleReview[];
  nextPageToken?: string;
};

export type GoogleSyncResult = {
  imported: number;
  updated: number;
  total: number;
};

export function isGoogleConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI
  );
}

function requireGoogleConfig() {
  if (!isGoogleConfigured()) {
    throw new Error("Google OAuth credentials are not configured.");
  }

  return {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? ""
  };
}

export function getGoogleAuthUrl(state: string) {
  const config = requireGoogleConfig();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

async function postTokenRequest(body: URLSearchParams) {
  const response = await fetch(googleTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const payload = (await response.json().catch(() => ({}))) as Partial<GoogleTokenResponse> & {
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? payload.error ?? "Google OAuth token request failed.");
  }

  return payload as GoogleTokenResponse;
}

export async function exchangeCodeForToken(code: string) {
  const config = requireGoogleConfig();
  return postTokenRequest(
    new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code"
    })
  );
}

export async function saveGoogleTokens(profileId: string, tokens: GoogleTokenResponse) {
  const existing = await db.googleCredential.findUnique({ where: { businessProfileId: profileId } });
  const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null;

  return db.googleCredential.upsert({
    where: { businessProfileId: profileId },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? existing?.refreshToken ?? null,
      scope: tokens.scope ?? existing?.scope ?? null,
      tokenType: tokens.token_type ?? existing?.tokenType ?? null,
      expiresAt
    },
    create: {
      businessProfileId: profileId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      scope: tokens.scope ?? null,
      tokenType: tokens.token_type ?? null,
      expiresAt
    }
  });
}

function tokenIsFresh(credential: GoogleCredential) {
  if (!credential.expiresAt) {
    return true;
  }

  return credential.expiresAt.getTime() > Date.now() + 60_000;
}

async function refreshGoogleCredential(credential: GoogleCredential) {
  if (!credential.refreshToken) {
    throw new Error("Google access expired. Reconnect Google to grant a new refresh token.");
  }

  const config = requireGoogleConfig();
  const tokens = await postTokenRequest(
    new URLSearchParams({
      refresh_token: credential.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token"
    })
  );

  return saveGoogleTokens(credential.businessProfileId, tokens);
}

async function getAccessToken(profile: BusinessProfile) {
  const credential = await db.googleCredential.findUnique({
    where: { businessProfileId: profile.id }
  });

  if (!credential) {
    throw new Error("Connect Google OAuth before syncing reviews.");
  }

  const freshCredential = tokenIsFresh(credential) ? credential : await refreshGoogleCredential(credential);
  return freshCredential.accessToken;
}

function requireGoogleLocationName(profile: BusinessProfile) {
  const name = profile.googleLocationName?.trim();
  if (!name || !/^accounts\/[^/]+\/locations\/[^/]+$/.test(name)) {
    throw new Error("Set Google location name in settings as accounts/{accountId}/locations/{locationId}.");
  }

  return name;
}

function ratingFromGoogle(value: string | undefined) {
  const map: Record<string, number> = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
    STAR_RATING_UNSPECIFIED: 0
  };

  const rating = map[value ?? ""] ?? 0;
  if (rating < 1 || rating > 5) {
    return 3;
  }

  return rating;
}

function reviewIdFromGoogle(review: GoogleReview) {
  if (review.name) {
    return review.name;
  }

  if (review.reviewId) {
    return review.reviewId;
  }

  return null;
}

async function fetchGoogleReviews(locationName: string, accessToken: string) {
  const reviews: GoogleReview[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${googleApiBaseUrl}/${locationName}/reviews`);
    url.searchParams.set("pageSize", "50");
    url.searchParams.set("orderBy", "updateTime desc");
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const payload = (await response.json().catch(() => ({}))) as GoogleReviewsResponse & {
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(payload.error?.message ?? "Google review sync request failed.");
    }

    reviews.push(...(payload.reviews ?? []));
    pageToken = payload.nextPageToken;
  } while (pageToken);

  return reviews;
}

function normalizeGoogleReview(profile: BusinessProfile, review: GoogleReview) {
  const googleReviewId = reviewIdFromGoogle(review);
  if (!googleReviewId) {
    return null;
  }

  const reviewDate = new Date(review.createTime ?? review.updateTime ?? Date.now());
  return {
    googleReviewId,
    reviewerName: review.reviewer?.displayName?.trim() || "Google reviewer",
    reviewerProfileUrl: review.reviewer?.profilePhotoUrl ?? null,
    rating: ratingFromGoogle(review.starRating),
    comment: review.comment?.trim() || "(No written comment)",
    reviewDate: Number.isNaN(reviewDate.getTime()) ? new Date() : reviewDate,
    reply: review.reviewReply?.comment?.trim() || null,
    sourceUrl: profile.reviewUrl,
    source: "GOOGLE"
  };
}

export async function syncGoogleReviews(): Promise<GoogleSyncResult> {
  const profile = await getDefaultProfile();
  const locationName = requireGoogleLocationName(profile);
  const accessToken = await getAccessToken(profile);
  const googleReviews = await fetchGoogleReviews(locationName, accessToken);

  let imported = 0;
  let updated = 0;

  for (const googleReview of googleReviews) {
    const normalized = normalizeGoogleReview(profile, googleReview);
    if (!normalized) {
      continue;
    }

    const existing = await db.review.findUnique({
      where: { googleReviewId: normalized.googleReviewId }
    });

    await db.review.upsert({
      where: { googleReviewId: normalized.googleReviewId },
      update: {
        reviewerName: normalized.reviewerName,
        reviewerProfileUrl: normalized.reviewerProfileUrl,
        rating: normalized.rating,
        comment: normalized.comment,
        reviewDate: normalized.reviewDate,
        reply: normalized.reply,
        sourceUrl: normalized.sourceUrl,
        source: normalized.source
      },
      create: {
        businessProfileId: profile.id,
        ...normalized
      }
    });

    if (existing) {
      updated += 1;
    } else {
      imported += 1;
    }
  }

  const reviews = await db.review.findMany({
    where: { businessProfileId: profile.id }
  });
  await persistAnalysisResults(analyzeAllReviews(reviews));

  return { imported, updated, total: googleReviews.length };
}
