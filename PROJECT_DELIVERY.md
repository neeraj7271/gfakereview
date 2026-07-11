# Project Delivery

Generated after verification on 2026-07-10.

## File Tree

```text
.env.example
.eslintignore
.eslintrc.json
.gitignore
app\add-review\page.tsx
app\alerts\page.tsx
app\api\alerts\[id]\route.ts
app\api\evidence\route.ts
app\api\google\auth-url\route.ts
app\api\google\callback\route.ts
app\api\google\sync-reviews\route.ts
app\api\import\reviews\route.ts
app\api\reviews\[id]\analyze\route.ts
app\api\reviews\[id]\draft-reply\route.ts
app\api\reviews\[id]\route.ts
app\api\reviews\analyze-all\route.ts
app\api\reviews\manual\route.ts
app\api\reviews\route.ts
app\api\settings\route.ts
app\evidence\[id]\page.tsx
app\evidence\page.tsx
app\globals.css
app\import\page.tsx
app\layout.tsx
app\page.tsx
app\reviews\[id]\page.tsx
app\reviews\page.tsx
app\settings\page.tsx
components\AlertActions.tsx
components\AnalyzeAllButton.tsx
components\GoogleConnectionPanel.tsx
components\ImportReviewsForm.tsx
components\ManualReviewForm.tsx
components\PrintButton.tsx
components\ReviewActions.tsx
components\ReviewsTable.tsx
components\ReviewStatusSelect.tsx
components\SettingsForm.tsx
lib\csv.ts
lib\dashboard.ts
lib\db.ts
lib\detection.ts
lib\evidence.ts
lib\format.ts
lib\google.ts
lib\profile.ts
lib\replies.ts
lib\serialize.ts
lib\types.ts
next.config.mjs
next-env.d.ts
package.json
package-lock.json
prisma\schema.prisma
prisma\seed.mjs
README.md
tests\csv.test.ts
tests\detection.test.ts
tests\evidence.test.ts
tsconfig.json
vitest.config.ts
```

## File Contents

### .env.example

`$lang
DATABASE_URL="file:./dev.db"
APP_BASE_URL="http://localhost:3000"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="http://localhost:3000/api/google/callback"
```

### .eslintignore

`$lang
node_modules
.next
out
dist
coverage
prisma/dev.db
tsconfig.tsbuildinfo
```

### .eslintrc.json

`$lang
{
  "extends": ["next/core-web-vitals"]
}
```

### .gitignore

`$lang
node_modules
.next
out
dist
coverage
*.log
.env
.env*.local
*.tsbuildinfo
prisma/dev.db
prisma/dev.db-journal
```

### app\add-review\page.tsx

`$lang
import ManualReviewForm from "@/components/ManualReviewForm";

export default function AddReviewPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Add review manually</h1>
          <p className="page-kicker">
            Enter one review at a time when you are collecting evidence from screenshots or copied Google review text.
          </p>
        </div>
      </header>
      <ManualReviewForm />
    </div>
  );
}
```

### app\alerts\page.tsx

`$lang
import { AlertTriangle } from "lucide-react";
import { db } from "@/lib/db";
import { badgeClass, formatDateTime } from "@/lib/format";
import { getDefaultProfile } from "@/lib/profile";
import AlertActions from "@/components/AlertActions";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const profile = await getDefaultProfile();
  const alerts = await db.alert.findMany({
    where: { businessProfileId: profile.id },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Alerts</h1>
          <p className="page-kicker">Reputation issues that need review before they become customer-facing damage.</p>
        </div>
      </header>

      <section className="grid">
        {alerts.length === 0 ? (
          <div className="panel empty">
            <AlertTriangle size={24} aria-hidden="true" />
            <p>No alerts yet.</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <article className="card panel-body" key={alert.id}>
              <div className="signal-title">
                <span>{alert.title}</span>
                <div className="actions">
                  <span className={badgeClass(alert.resolvedAt ? "info" : alert.severity)}>
                    {alert.resolvedAt ? "resolved" : alert.severity.toLowerCase()}
                  </span>
                  <AlertActions alertId={alert.id} resolved={Boolean(alert.resolvedAt)} />
                </div>
              </div>
              <p className="signal-text">{alert.message}</p>
              <p className="help-text">
                Created {formatDateTime(alert.createdAt)}
                {alert.resolvedAt ? ` - Resolved ${formatDateTime(alert.resolvedAt)}` : ""}
              </p>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
```

### app\api\alerts\[id]\route.ts

`$lang
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDefaultProfile } from "@/lib/profile";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getDefaultProfile();

  try {
    const body = (await request.json()) as { action?: unknown };
    const action = typeof body.action === "string" ? body.action : "resolve";

    if (action !== "resolve" && action !== "reopen") {
      return NextResponse.json({ error: "Unsupported alert action." }, { status: 400 });
    }

    const alert = await db.alert.findFirst({
      where: { id, businessProfileId: profile.id }
    });

    if (!alert) {
      return NextResponse.json({ error: "Alert not found." }, { status: 404 });
    }

    const updated = await db.alert.update({
      where: { id: alert.id },
      data: { resolvedAt: action === "resolve" ? new Date() : null }
    });

    return NextResponse.json({ alert: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update alert." },
      { status: 400 }
    );
  }
}
```

### app\api\evidence\route.ts

`$lang
import { NextResponse } from "next/server";
import { buildEvidenceHtml } from "@/lib/evidence";
import { db } from "@/lib/db";
import { getDefaultProfile } from "@/lib/profile";

const maxPacketReviews = 50;

function parseReviewIds(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error("Select at least one review.");
  }

  const reviewIds = Array.from(
    new Set(
      value.map((item) => {
        if (typeof item !== "string") {
          throw new Error("Review IDs must be strings.");
        }

        return item.trim();
      })
    )
  ).filter(Boolean);

  if (reviewIds.length === 0) {
    throw new Error("Select at least one review.");
  }

  if (reviewIds.length > maxPacketReviews) {
    throw new Error(`Evidence packets can include up to ${maxPacketReviews} reviews.`);
  }

  return reviewIds;
}

export async function POST(request: Request) {
  let reviewIds: string[];
  try {
    const body = (await request.json()) as { reviewIds?: unknown };
    reviewIds = parseReviewIds(body.reviewIds);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid evidence request." },
      { status: 400 }
    );
  }

  const profile = await getDefaultProfile();
  const reviews = await db.review.findMany({
    where: {
      businessProfileId: profile.id,
      id: { in: reviewIds }
    },
    include: {
      signals: true
    },
    orderBy: { reviewDate: "asc" }
  });

  if (reviews.length !== reviewIds.length) {
    return NextResponse.json({ error: "One or more selected reviews were not found." }, { status: 404 });
  }

  const contentHtml = buildEvidenceHtml(profile, reviews);
  const summary = `${reviews.length} review(s), highest suspicion score ${Math.max(
    ...reviews.map((review) => review.suspicionScore)
  )}.`;

  const packet = await db.$transaction(async (tx) => {
    const createdPacket = await tx.evidencePacket.create({
      data: {
        businessProfileId: profile.id,
        title: `Evidence packet - ${new Date().toLocaleDateString("en-US")}`,
        summary,
        reviewIdsJson: JSON.stringify(reviews.map((review) => review.id)),
        contentHtml
      }
    });

    await tx.review.updateMany({
      where: {
        businessProfileId: profile.id,
        id: { in: reviews.map((review) => review.id) }
      },
      data: { status: "ESCALATED" }
    });

    return createdPacket;
  });

  return NextResponse.json({ id: packet.id });
}
```

### app\api\google\auth-url\route.ts

`$lang
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getGoogleAuthUrl, isGoogleConfigured } from "@/lib/google";

export async function GET() {
  if (!isGoogleConfigured()) {
    return NextResponse.json({
      configured: false,
      message: "Google OAuth is not configured. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI to .env."
    });
  }

  const state = randomUUID();
  const response = NextResponse.json({ configured: true, authUrl: getGoogleAuthUrl(state) });
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60,
    path: "/"
  });

  return response;
}
```

### app\api\google\callback\route.ts

`$lang
import { NextResponse } from "next/server";
import { exchangeCodeForToken, saveGoogleTokens } from "@/lib/google";
import { getDefaultProfile } from "@/lib/profile";

function redirectToSettings(request: Request, status: "connected" | "error", message?: string) {
  const url = new URL("/settings", request.url);
  url.searchParams.set("google", status);
  if (message) {
    url.searchParams.set("message", message);
  }

  const response = NextResponse.redirect(url);
  response.cookies.delete("google_oauth_state");
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("google_oauth_state="))
    ?.split("=")[1];

  if (error) {
    return redirectToSettings(request, "error", error);
  }

  if (!code) {
    return redirectToSettings(request, "error", "Missing OAuth code.");
  }

  if (!state || !expectedState || state !== decodeURIComponent(expectedState)) {
    return redirectToSettings(request, "error", "Google OAuth state did not match.");
  }

  try {
    const profile = await getDefaultProfile();
    const tokens = await exchangeCodeForToken(code);
    await saveGoogleTokens(profile.id, tokens);
    return redirectToSettings(request, "connected");
  } catch (caughtError) {
    return redirectToSettings(
      request,
      "error",
      caughtError instanceof Error ? caughtError.message : "Google callback failed."
    );
  }
}
```

### app\api\google\sync-reviews\route.ts

`$lang
import { NextResponse } from "next/server";
import { syncGoogleReviews } from "@/lib/google";

export async function POST() {
  try {
    const result = await syncGoogleReviews();
    return NextResponse.json({
      message: `Google reviews synced. Imported ${result.imported}, updated ${result.updated}.`,
      ...result
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Google sync is unavailable until OAuth credentials are configured."
      },
      { status: 503 }
    );
  }
}
```

### app\api\import\reviews\route.ts

`$lang
import { NextResponse } from "next/server";
import { analyzeAllReviews } from "@/lib/detection";
import { db } from "@/lib/db";
import { parseReviewsCsv } from "@/lib/csv";
import { getDefaultProfile } from "@/lib/profile";
import { persistAnalysisResults } from "@/lib/dashboard";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { csv?: string };
    if (!body.csv) {
      return NextResponse.json({ error: "CSV input is required." }, { status: 400 });
    }

    const profile = await getDefaultProfile();
    const parsed = parseReviewsCsv(body.csv);

    let imported = 0;
    let skipped = 0;

    for (const review of parsed) {
      const existing = await db.review.findFirst({
        where: {
          businessProfileId: profile.id,
          reviewerName: review.reviewerName,
          rating: review.rating,
          comment: review.comment,
          reviewDate: review.reviewDate
        }
      });

      if (existing) {
        skipped += 1;
        continue;
      }

      await db.review.create({
        data: {
          ...review,
          businessProfileId: profile.id,
          source: "CSV"
        }
      });
      imported += 1;
    }

    const reviews = await db.review.findMany({
      where: { businessProfileId: profile.id }
    });
    await persistAnalysisResults(analyzeAllReviews(reviews));

    return NextResponse.json({ imported, skipped });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed." },
      { status: 400 }
    );
  }
}
```

### app\api\reviews\[id]\analyze\route.ts

`$lang
import { NextResponse } from "next/server";
import { analyzeReview } from "@/lib/detection";
import { db } from "@/lib/db";
import { persistAnalysisResults } from "@/lib/dashboard";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = await db.review.findUnique({ where: { id } });

  if (!review) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }

  const allReviews = await db.review.findMany({
    where: { businessProfileId: review.businessProfileId }
  });
  const result = analyzeReview(review, allReviews);
  await persistAnalysisResults([{ review, result }]);

  return NextResponse.json({ reviewId: review.id, score: result.score, level: result.level });
}
```

### app\api\reviews\[id]\draft-reply\route.ts

`$lang
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { draftPublicReply } from "@/lib/replies";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = await db.review.findUnique({
    where: { id },
    include: { businessProfile: true }
  });

  if (!review) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }

  const content = draftPublicReply(review, review.businessProfile);
  const draft = await db.$transaction(async (tx) => {
    const createdDraft = await tx.responseDraft.create({
      data: {
        reviewId: review.id,
        tone: review.suspicionScore >= 60 ? "careful evidence-safe" : "professional",
        content
      }
    });

    await tx.review.update({
      where: { id: review.id },
      data: { status: "REVIEWING" }
    });

    return createdDraft;
  });

  return NextResponse.json({ id: draft.id, content: draft.content });
}
```

### app\api\reviews\[id]\route.ts

`$lang
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDefaultProfile } from "@/lib/profile";
import { serializeReview } from "@/lib/serialize";

const allowedStatuses = new Set(["NEW", "REVIEWING", "RESPONDED", "ESCALATED", "DISMISSED"]);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = await db.review.findUnique({
    where: { id },
    include: {
      signals: true,
      responseDrafts: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!review) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }

  return NextResponse.json({ review: serializeReview(review) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getDefaultProfile();

  try {
    const body = (await request.json()) as { status?: unknown };
    const status = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";

    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ error: "Unsupported review status." }, { status: 400 });
    }

    const review = await db.review.findFirst({
      where: { id, businessProfileId: profile.id }
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found." }, { status: 404 });
    }

    const updated = await db.review.update({
      where: { id: review.id },
      data: { status },
      include: {
        signals: true,
        responseDrafts: {
          orderBy: { createdAt: "desc" }
        }
      }
    });

    return NextResponse.json({ review: serializeReview(updated) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update review status." },
      { status: 400 }
    );
  }
}
```

### app\api\reviews\analyze-all\route.ts

`$lang
import { NextResponse } from "next/server";
import { refreshAnalysisForProfile } from "@/lib/dashboard";

export async function POST() {
  try {
    const analyzed = await refreshAnalysisForProfile();
    return NextResponse.json({ analyzed });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to analyze reviews." },
      { status: 500 }
    );
  }
}
```

### app\api\reviews\manual\route.ts

`$lang
import { NextResponse } from "next/server";
import { analyzeReview } from "@/lib/detection";
import { db } from "@/lib/db";
import { getDefaultProfile } from "@/lib/profile";
import { serializeReview } from "@/lib/serialize";

function parseRating(value: unknown) {
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be a whole number from 1 to 5.");
  }
  return rating;
}

function parseDate(value: unknown) {
  if (!value) return new Date();
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error("Review date is invalid.");
  }
  return date;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const reviewerName = String(body.reviewerName ?? "").trim();
    const comment = String(body.comment ?? "").trim();

    if (reviewerName.length < 2) {
      return NextResponse.json({ error: "Reviewer name is required." }, { status: 400 });
    }

    if (comment.length < 2) {
      return NextResponse.json({ error: "Review comment is required." }, { status: 400 });
    }

    const profile = await getDefaultProfile();
    const review = await db.review.create({
      data: {
        businessProfileId: profile.id,
        reviewerName,
        rating: parseRating(body.rating),
        comment,
        reviewDate: parseDate(body.reviewDate),
        reply: String(body.reply ?? "").trim() || null,
        sourceUrl: String(body.sourceUrl ?? "").trim() || null,
        reviewerProfileUrl: String(body.reviewerProfileUrl ?? "").trim() || null,
        source: "MANUAL"
      }
    });

    const allReviews = await db.review.findMany({
      where: { businessProfileId: profile.id }
    });
    const result = analyzeReview(review, allReviews);

    const updated = await db.review.update({
      where: { id: review.id },
      data: {
        suspicionScore: result.score,
        suspicionLevel: result.level,
        analyzedAt: new Date(),
        signals: { create: result.signals }
      },
      include: {
        signals: true,
        responseDrafts: true
      }
    });

    return NextResponse.json({ review: serializeReview(updated) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create review." },
      { status: 400 }
    );
  }
}
```

### app\api\reviews\route.ts

`$lang
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDefaultProfile } from "@/lib/profile";
import { serializeReview } from "@/lib/serialize";

export async function GET() {
  const profile = await getDefaultProfile();
  const reviews = await db.review.findMany({
    where: { businessProfileId: profile.id },
    orderBy: { reviewDate: "desc" },
    include: {
      signals: true,
      responseDrafts: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  return NextResponse.json({ reviews: reviews.map(serializeReview) });
}
```

### app\api\settings\route.ts

`$lang
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDefaultProfile } from "@/lib/profile";

function requireObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Settings payload must be an object.");
  }

  return value as Record<string, unknown>;
}

function readText(body: Record<string, unknown>, field: string) {
  const value = body[field];
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value !== "string") {
    throw new Error(`${field} must be text.`);
  }

  return value.trim();
}

function parseThreshold(value: unknown, fallback: number) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error("Suspicion threshold must be a number from 0 to 100.");
  }

  const threshold = Number(value);
  if (!Number.isInteger(threshold) || threshold < 0 || threshold > 100) {
    throw new Error("Suspicion threshold must be a whole number from 0 to 100.");
  }

  return threshold;
}

export async function POST(request: Request) {
  try {
    const body = requireObject(await request.json());
    const profile = await getDefaultProfile();
    const name = readText(body, "name");
    const threshold = parseThreshold(body.detectionSensitivity, profile.detectionSensitivity);

    if (name.length < 2) {
      return NextResponse.json({ error: "Business name is required." }, { status: 400 });
    }

    await db.businessProfile.update({
      where: { id: profile.id },
      data: {
        name,
        googleLocationName: readText(body, "googleLocationName") || null,
        industry: readText(body, "industry") || null,
        websiteUrl: readText(body, "websiteUrl") || null,
        phone: readText(body, "phone") || null,
        address: readText(body, "address") || null,
        reviewUrl: readText(body, "reviewUrl") || null,
        detectionSensitivity: threshold
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save settings." },
      { status: 400 }
    );
  }
}
```

### app\evidence\[id]\page.tsx

`$lang
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function EvidenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const packet = await db.evidencePacket.findUnique({
    where: { id }
  });

  if (!packet) {
    notFound();
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{packet.title}</h1>
          <p className="page-kicker">{formatDateTime(packet.createdAt)}</p>
        </div>
        <div className="actions">
          <PrintButton />
        </div>
      </header>
      <article className="print-page" dangerouslySetInnerHTML={{ __html: packet.contentHtml }} />
    </div>
  );
}
```

### app\evidence\page.tsx

`$lang
import Link from "next/link";
import { FileText } from "lucide-react";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { getDefaultProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function EvidencePage() {
  const profile = await getDefaultProfile();
  const packets = await db.evidencePacket.findMany({
    where: { businessProfileId: profile.id },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Evidence packets</h1>
          <p className="page-kicker">Printable summaries for internal review or platform escalation.</p>
        </div>
      </header>

      <section className="grid grid-3">
        {packets.length === 0 ? (
          <div className="panel empty">
            <FileText size={24} aria-hidden="true" />
            <p>No packets yet. Create one from a review detail page.</p>
          </div>
        ) : (
          packets.map((packet) => (
            <Link className="card panel-body" href={`/evidence/${packet.id}`} key={packet.id}>
              <strong>{packet.title}</strong>
              <p className="signal-text">{packet.summary}</p>
              <p className="help-text">{formatDateTime(packet.createdAt)}</p>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
```

### app\globals.css

`$lang
@import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=Libre+Franklin:wght@700;800&display=swap");

:root {
  --bg: #f8faf6;
  --paper: #ffffff;
  --paper-warm: #fbfaf4;
  --surface: #eef3ef;
  --surface-strong: #dfe8e2;
  --ink: #102624;
  --text: #172825;
  --muted: #62726d;
  --border: #cfd9d2;
  --border-strong: #aebdb5;
  --primary: #1f6f68;
  --primary-strong: #174f4b;
  --danger: #d2483d;
  --danger-dark: #9e302a;
  --warning: #b87914;
  --evidence: #f2b84b;
  --success: #2f7d52;
  --focus: #154f50;
  --shadow: 0 1px 0 rgba(16, 38, 36, 0.08), 0 18px 42px rgba(16, 38, 36, 0.07);
  --font-display: "Libre Franklin", "Aptos Display", "Arial Narrow", sans-serif;
  --font-body: "IBM Plex Sans", "Segoe UI", sans-serif;
  --font-mono: "IBM Plex Mono", "Cascadia Mono", monospace;
}

* {
  box-sizing: border-box;
}

html {
  min-width: 320px;
  background: var(--bg);
}

body {
  margin: 0;
  color: var(--text);
  background:
    linear-gradient(90deg, rgba(31, 111, 104, 0.06) 1px, transparent 1px),
    linear-gradient(180deg, rgba(210, 72, 61, 0.04) 0, transparent 360px),
    var(--bg);
  background-size: 44px 44px, auto;
  font-family: var(--font-body);
  font-variant-numeric: tabular-nums;
}

a {
  color: inherit;
  text-decoration: none;
}

button,
input,
select,
textarea {
  font: inherit;
}

button {
  cursor: pointer;
}

a:focus-visible,
button:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible {
  outline: 3px solid rgba(21, 79, 80, 0.35);
  outline-offset: 2px;
}

.shell {
  display: grid;
  grid-template-columns: 256px minmax(0, 1fr);
  min-height: 100vh;
}

.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  border-right: 1px solid var(--border);
  background: #102624;
  color: #f6fbf5;
  padding: 20px 14px;
}

.brand {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 0 8px 18px;
  font-family: var(--font-display);
  font-weight: 800;
  letter-spacing: 0;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 1px solid rgba(242, 184, 75, 0.45);
  border-radius: 8px;
  color: var(--evidence);
  background: rgba(255, 255, 255, 0.07);
}

.brand-text span {
  display: block;
  color: #a8b9b2;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 600;
  margin-top: 2px;
}

.nav {
  display: grid;
  gap: 4px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 10px;
  border-radius: 8px;
  color: #c7d5cf;
  font-size: 14px;
  font-weight: 650;
}

.nav-link:hover,
.nav-link:focus-visible {
  outline: none;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.1);
}

.content {
  min-width: 0;
  padding: 30px;
}

.page {
  max-width: 1210px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
  margin-bottom: 22px;
  border-bottom: 2px solid var(--ink);
  padding-bottom: 18px;
}

.page-title {
  margin: 0;
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 32px;
  line-height: 1.08;
  letter-spacing: 0;
}

.page-kicker {
  max-width: 720px;
  margin: 8px 0 0;
  color: var(--muted);
  line-height: 1.55;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.button,
.button-secondary,
.button-danger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 0 14px;
  font-weight: 750;
  white-space: nowrap;
}

.button {
  color: #ffffff;
  background: var(--primary);
  border-color: var(--primary);
}

.button:hover {
  background: var(--primary-strong);
}

.button-secondary {
  color: var(--ink);
  background: var(--paper);
  border-color: var(--border-strong);
}

.button-secondary:hover {
  background: var(--surface);
}

.button-danger {
  color: #ffffff;
  background: var(--danger);
}

.button:disabled,
.button-secondary:disabled,
.button-danger:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.grid {
  display: grid;
  gap: 16px;
}

.grid-4 {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.grid-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.grid-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.card,
.panel {
  border: 1px solid var(--border);
  border-left: 4px solid var(--primary);
  border-radius: 8px;
  background: var(--paper);
  box-shadow: var(--shadow);
}

.metric-card {
  display: grid;
  gap: 9px;
  min-height: 154px;
  padding: 16px;
  background:
    linear-gradient(180deg, rgba(242, 184, 75, 0.09), transparent 52%),
    var(--paper);
}

.metric-label {
  color: var(--ink);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.metric-value {
  font-family: var(--font-mono);
  font-size: 30px;
  line-height: 1;
  font-weight: 700;
}

.metric-note {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.4;
}

.section {
  margin-top: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.section-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 18px;
  letter-spacing: 0;
}

.panel {
  overflow: hidden;
}

.panel-body {
  padding: 18px;
}

.table-wrap {
  overflow-x: auto;
}

.table {
  width: 100%;
  min-width: 780px;
  border-collapse: collapse;
}

.table th,
.table td {
  border-bottom: 1px solid var(--border);
  padding: 13px 14px;
  text-align: left;
  vertical-align: top;
  font-size: 14px;
}

.table th {
  color: var(--ink);
  background: var(--surface);
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.table tr:last-child td {
  border-bottom: 0;
}

.table tr:hover td {
  background: rgba(31, 111, 104, 0.045);
}

.review-comment {
  max-width: 460px;
  line-height: 1.5;
}

.muted {
  color: var(--muted);
}

.badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 0 8px;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.badge-low {
  color: #235b3d;
  background: #e4f3e9;
  border-color: #b9dcc6;
}

.badge-medium {
  color: #7a520f;
  background: #fff2cf;
  border-color: #e9c36d;
}

.badge-high {
  color: #8d321e;
  background: #ffe5dc;
  border-color: #f2a38f;
}

.badge-critical {
  color: #8d1f1b;
  background: #ffe1df;
  border-color: #e88781;
}

.badge-info {
  color: #174f4b;
  background: #dff0ed;
  border-color: #9dc8c2;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  padding: 14px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.field,
.textarea,
.select {
  width: 100%;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: #ffffff;
  color: var(--text);
}

.field,
.select {
  min-height: 40px;
  padding: 0 11px;
}

.textarea {
  min-height: 220px;
  padding: 12px;
  line-height: 1.45;
  resize: vertical;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.form-row {
  display: grid;
  gap: 7px;
}

.form-row label,
.form-row span {
  color: var(--ink);
  font-size: 13px;
  font-weight: 800;
}

.help-text {
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
}

.detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
  gap: 18px;
}

.rating {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--warning);
  font-family: var(--font-mono);
  font-weight: 800;
}

.signal-list {
  display: grid;
  gap: 10px;
}

.signal-item {
  border: 1px solid var(--border);
  border-left: 4px solid var(--evidence);
  border-radius: 8px;
  padding: 12px;
  background: var(--paper-warm);
}

.signal-title {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-weight: 800;
}

.signal-text {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.45;
}

.toast {
  margin-top: 12px;
  border: 1px solid #9dc8c2;
  border-radius: 8px;
  padding: 12px;
  color: var(--primary-strong);
  background: #e1f1ee;
  font-size: 14px;
  line-height: 1.4;
}

.empty {
  padding: 30px;
  color: var(--muted);
  text-align: center;
}

.print-page {
  background: var(--paper-warm);
  border: 1px solid var(--border-strong);
  border-left: 6px solid var(--evidence);
  border-radius: 8px;
  padding: 28px;
  line-height: 1.55;
}

.print-page h1,
.print-page h2,
.print-page h3 {
  color: var(--ink);
  font-family: var(--font-display);
  letter-spacing: 0;
}

.print-page table {
  width: 100%;
  border-collapse: collapse;
}

.print-page th,
.print-page td {
  border: 1px solid var(--border);
  padding: 8px;
  text-align: left;
}

.status-control {
  max-width: 260px;
}

@media print {
  .sidebar,
  .page-header .actions {
    display: none;
  }

  .shell {
    display: block;
  }

  .content {
    padding: 0;
  }

  .print-page {
    border: 0;
    border-radius: 0;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .button,
  .button-secondary,
  .button-danger,
  .nav-link,
  .table tr td {
    transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease;
  }
}

@media (max-width: 980px) {
  .shell {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: static;
    height: auto;
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }

  .nav {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .grid-4,
  .grid-3,
  .grid-2,
  .detail-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .content {
    padding: 18px;
  }

  .page-header,
  .section-header {
    display: grid;
  }

  .page-title {
    font-size: 25px;
  }

  .nav {
    grid-template-columns: 1fr;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .actions {
    width: 100%;
  }

  .button,
  .button-secondary,
  .button-danger {
    flex: 1;
  }
}
```

### app\import\page.tsx

`$lang
import ImportReviewsForm from "@/components/ImportReviewsForm";

export default function ImportPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Import reviews</h1>
          <p className="page-kicker">
            Paste CSV review data from Google exports, a spreadsheet, or a manual research file.
          </p>
        </div>
      </header>
      <ImportReviewsForm />
    </div>
  );
}
```

### app\layout.tsx

`$lang
import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  FileText,
  Gauge,
  Import,
  ListChecks,
  PlusCircle,
  Settings,
  ShieldCheck
} from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Google Fake Review Detector",
  description: "Detect suspicious review patterns and prepare reputation defense packets."
};

const navItems = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/reviews", label: "Reviews", icon: ListChecks },
  { href: "/add-review", label: "Add Review", icon: PlusCircle },
  { href: "/import", label: "Import", icon: Import },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/evidence", label: "Evidence", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings }
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="sidebar" aria-label="Primary navigation">
            <Link className="brand" href="/">
              <span className="brand-mark">
                <ShieldCheck size={22} aria-hidden="true" />
              </span>
              <span className="brand-text">
                ReviewShield
                <span>Fake review detector</span>
              </span>
            </Link>
            <nav className="nav">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link className="nav-link" href={item.href} key={item.href}>
                    <Icon size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
```

### app\page.tsx

`$lang
import Link from "next/link";
import { AlertTriangle, FileDown, Import, PlusCircle, RefreshCw } from "lucide-react";
import { db } from "@/lib/db";
import { badgeClass, formatDate } from "@/lib/format";
import { getDefaultProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await getDefaultProfile();
  const [reviews, alerts, packets] = await Promise.all([
    db.review.findMany({
      where: { businessProfileId: profile.id },
      orderBy: { reviewDate: "desc" },
      include: { signals: true },
      take: 8
    }),
    db.alert.findMany({
      where: { businessProfileId: profile.id, resolvedAt: null },
      orderBy: { createdAt: "desc" },
      take: 4
    }),
    db.evidencePacket.findMany({
      where: { businessProfileId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 3
    })
  ]);

  const totalReviews = await db.review.count({ where: { businessProfileId: profile.id } });
  const suspiciousReviews = await db.review.count({
    where: {
      businessProfileId: profile.id,
      suspicionScore: { gte: profile.detectionSensitivity }
    }
  });
  const unansweredLowReviews = await db.review.count({
    where: {
      businessProfileId: profile.id,
      rating: { lte: 3 },
      reply: null
    }
  });
  const averageRating =
    totalReviews > 0
      ? (
          (await db.review.aggregate({
            where: { businessProfileId: profile.id },
            _avg: { rating: true }
          }))._avg.rating ?? 0
        ).toFixed(1)
      : "0.0";

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Review defense dashboard</h1>
          <p className="page-kicker">
            Monitor suspicious review patterns for {profile.name} and prepare calm, evidence-backed responses.
          </p>
        </div>
        <div className="actions">
          <Link className="button-secondary" href="/import" title="Import reviews">
            <Import size={17} aria-hidden="true" />
            Import
          </Link>
          <Link className="button-secondary" href="/add-review" title="Add review manually">
            <PlusCircle size={17} aria-hidden="true" />
            Add review
          </Link>
          <Link className="button" href="/reviews" title="Analyze reviews">
            <RefreshCw size={17} aria-hidden="true" />
            Review queue
          </Link>
        </div>
      </header>

      <section className="grid grid-4">
        <article className="card metric-card">
          <div className="metric-label">Total reviews</div>
          <div className="metric-value">{totalReviews}</div>
          <div className="metric-note">Across demo, CSV, manual, and Google sources.</div>
        </article>
        <article className="card metric-card">
          <div className="metric-label">Average rating</div>
          <div className="metric-value">{averageRating}</div>
          <div className="metric-note">Use this as reputation context, not a fraud signal.</div>
        </article>
        <article className="card metric-card">
          <div className="metric-label">Suspicious reviews</div>
          <div className="metric-value">{suspiciousReviews}</div>
          <div className="metric-note">At or above threshold {profile.detectionSensitivity}.</div>
        </article>
        <article className="card metric-card">
          <div className="metric-label">Need response</div>
          <div className="metric-value">{unansweredLowReviews}</div>
          <div className="metric-note">Low or neutral reviews without owner replies.</div>
        </article>
      </section>

      <section className="section grid grid-2">
        <div>
          <div className="section-header">
            <h2 className="section-title">Recent review risk</h2>
            <Link className="button-secondary" href="/reviews">
              View all
            </Link>
          </div>
          <div className="panel table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Reviewer</th>
                  <th>Rating</th>
                  <th>Risk</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => (
                  <tr key={review.id}>
                    <td>
                      <Link href={`/reviews/${review.id}`}>{review.reviewerName}</Link>
                    </td>
                    <td>{review.rating}</td>
                    <td>
                      <span className={badgeClass(review.suspicionLevel)}>
                        {review.suspicionScore} {review.suspicionLevel.toLowerCase()}
                      </span>
                    </td>
                    <td>{formatDate(review.reviewDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="section-header">
            <h2 className="section-title">Active alerts</h2>
            <Link className="button-secondary" href="/alerts">
              Open alerts
            </Link>
          </div>
          <div className="grid">
            {alerts.length === 0 ? (
              <div className="panel empty">No active alerts.</div>
            ) : (
              alerts.map((alert) => (
                <article className="card panel-body" key={alert.id}>
                  <div className="signal-title">
                    <span>{alert.title}</span>
                    <span className={badgeClass(alert.severity)}>{alert.severity.toLowerCase()}</span>
                  </div>
                  <p className="signal-text">{alert.message}</p>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">Evidence packets</h2>
          <Link className="button-secondary" href="/evidence">
            <FileDown size={17} aria-hidden="true" />
            Packet library
          </Link>
        </div>
        <div className="grid grid-3">
          {packets.length === 0 ? (
            <div className="panel empty">
              <AlertTriangle size={22} aria-hidden="true" />
              <p>No packets yet. Open a suspicious review to create one.</p>
            </div>
          ) : (
            packets.map((packet) => (
              <Link className="card panel-body" href={`/evidence/${packet.id}`} key={packet.id}>
                <strong>{packet.title}</strong>
                <p className="signal-text">{packet.summary}</p>
                <p className="help-text">{formatDate(packet.createdAt)}</p>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
```

### app\reviews\[id]\page.tsx

`$lang
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { badgeClass, formatDateTime, statusClass } from "@/lib/format";
import ReviewActions from "@/components/ReviewActions";
import ReviewStatusSelect from "@/components/ReviewStatusSelect";

export const dynamic = "force-dynamic";

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = await db.review.findUnique({
    where: { id },
    include: {
      businessProfile: true,
      signals: {
        orderBy: { weight: "desc" }
      },
      responseDrafts: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!review) {
    notFound();
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link className="nav-link" href="/reviews">
            <ArrowLeft size={17} aria-hidden="true" />
            Back to reviews
          </Link>
          <h1 className="page-title">{review.reviewerName}</h1>
          <p className="page-kicker">
            {review.rating}-star review posted {formatDateTime(review.reviewDate)}
          </p>
        </div>
        <ReviewActions reviewId={review.id} />
      </header>

      <div className="detail-layout">
        <section className="panel">
          <div className="panel-body">
            <div className="actions">
              <span className="rating">Rating {review.rating} / 5</span>
              <span className={badgeClass(review.suspicionLevel)}>
                {review.suspicionScore} {review.suspicionLevel.toLowerCase()}
              </span>
              <span className={statusClass(review.status)}>{review.status.toLowerCase()}</span>
              <span className="badge badge-info">{review.source.toLowerCase()}</span>
            </div>
            <h2 className="section-title section">Review comment</h2>
            <p className="review-comment">{review.comment}</p>
            {review.reply ? (
              <>
                <h2 className="section-title section">Current owner reply</h2>
                <p className="review-comment muted">{review.reply}</p>
              </>
            ) : (
              <p className="toast">No public owner reply is recorded for this review.</p>
            )}
            {review.sourceUrl ? (
              <p className="help-text">
                <a href={review.sourceUrl} target="_blank" rel="noreferrer">
                  Open source review <ExternalLink size={13} aria-hidden="true" />
                </a>
              </p>
            ) : null}
            <div className="section">
              <ReviewStatusSelect reviewId={review.id} status={review.status} />
            </div>
          </div>
        </section>

        <aside className="grid">
          <section className="panel">
            <div className="panel-body">
              <h2 className="section-title">Detection signals</h2>
              <div className="signal-list section">
                {review.signals.length === 0 ? (
                  <p className="muted">Run analysis to create signal explanations.</p>
                ) : (
                  review.signals.map((signal) => (
                    <article className="signal-item" key={signal.id}>
                      <div className="signal-title">
                        <span>{signal.label}</span>
                        <span className={badgeClass(signal.severity)}>{signal.weight}</span>
                      </div>
                      <p className="signal-text">{signal.explanation}</p>
                    </article>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-body">
              <h2 className="section-title">Response drafts</h2>
              <div className="signal-list section">
                {review.responseDrafts.length === 0 ? (
                  <p className="muted">Generate a draft after reviewing the signals.</p>
                ) : (
                  review.responseDrafts.map((draft) => (
                    <article className="signal-item" key={draft.id}>
                      <div className="signal-title">
                        <span>{draft.tone}</span>
                        <span className="muted">{formatDateTime(draft.createdAt)}</span>
                      </div>
                      <p className="signal-text">{draft.content}</p>
                    </article>
                  ))
                )}
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
```

### app\reviews\page.tsx

`$lang
import Link from "next/link";
import { PlusCircle, RefreshCw } from "lucide-react";
import { db } from "@/lib/db";
import { getDefaultProfile } from "@/lib/profile";
import { serializeReview } from "@/lib/serialize";
import ReviewsTable from "@/components/ReviewsTable";
import AnalyzeAllButton from "@/components/AnalyzeAllButton";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const profile = await getDefaultProfile();
  const reviews = await db.review.findMany({
    where: { businessProfileId: profile.id },
    orderBy: [{ suspicionScore: "desc" }, { reviewDate: "desc" }],
    include: {
      signals: true,
      responseDrafts: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Review queue</h1>
          <p className="page-kicker">Filter, inspect, and re-score suspicious reviews before responding.</p>
        </div>
        <div className="actions">
          <Link className="button-secondary" href="/add-review">
            <PlusCircle size={17} aria-hidden="true" />
            Add review
          </Link>
          <AnalyzeAllButton>
            <RefreshCw size={17} aria-hidden="true" />
            Re-score all
          </AnalyzeAllButton>
        </div>
      </header>
      <ReviewsTable reviews={reviews.map(serializeReview)} />
    </div>
  );
}
```

### app\settings\page.tsx

`$lang
import { Settings } from "lucide-react";
import { getDefaultProfile } from "@/lib/profile";
import SettingsForm from "@/components/SettingsForm";
import GoogleConnectionPanel from "@/components/GoogleConnectionPanel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await getDefaultProfile();

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-kicker">Configure the business profile, detection sensitivity, and Google integration state.</p>
        </div>
      </header>
      <section className="grid grid-2">
        <div className="panel">
          <div className="panel-body">
            <h2 className="section-title">
              <Settings size={18} aria-hidden="true" /> Business profile
            </h2>
            <SettingsForm
              profile={{
                name: profile.name,
                googleLocationName: profile.googleLocationName,
                industry: profile.industry,
                websiteUrl: profile.websiteUrl,
                phone: profile.phone,
                address: profile.address,
                reviewUrl: profile.reviewUrl,
                detectionSensitivity: profile.detectionSensitivity
              }}
            />
          </div>
        </div>
        <GoogleConnectionPanel />
      </section>
    </div>
  );
}
```

### components\AlertActions.tsx

`$lang
"use client";

import { CheckCircle2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AlertActions({ alertId, resolved }: { alertId: string; resolved: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function updateAlert() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: resolved ? "reopen" : "resolve" })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not update alert.");
      }

      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update alert.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button className="button-secondary" type="button" onClick={updateAlert} disabled={loading}>
        {resolved ? <RotateCcw size={17} aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}
        {loading ? "Saving..." : resolved ? "Reopen" : "Resolve"}
      </button>
      {message ? <div className="toast">{message}</div> : null}
    </div>
  );
}
```

### components\AnalyzeAllButton.tsx

`$lang
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AnalyzeAllButton({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function analyze() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/reviews/analyze-all", { method: "POST" });
      const payload = (await response.json()) as { analyzed?: number; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to analyze reviews.");
      }

      setMessage(`Analyzed ${payload.analyzed ?? 0} review(s).`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to analyze reviews.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button className="button" type="button" onClick={analyze} disabled={loading}>
        {loading ? "Analyzing..." : children}
      </button>
      {message ? <div className="toast">{message}</div> : null}
    </div>
  );
}
```

### components\GoogleConnectionPanel.tsx

`$lang
"use client";

import { KeyRound, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function GoogleConnectionPanel() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleStatus = params.get("google");
    const googleMessage = params.get("message");

    if (googleStatus === "connected") {
      setMessage("Google OAuth is connected. Run sync to import reviews.");
    } else if (googleStatus === "error") {
      setMessage(googleMessage ?? "Google OAuth failed.");
    }
  }, []);

  async function connect() {
    setLoading("connect");
    setMessage("");
    try {
      const response = await fetch("/api/google/auth-url");
      const payload = (await response.json()) as { configured: boolean; authUrl?: string; message?: string };
      if (!response.ok || !payload.configured || !payload.authUrl) {
        throw new Error(payload.message ?? "Google OAuth is not configured.");
      }

      window.location.href = payload.authUrl;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google OAuth is not configured.");
      setLoading(null);
    }
  }

  async function sync() {
    setLoading("sync");
    setMessage("");
    try {
      const response = await fetch("/api/google/sync-reviews", { method: "POST" });
      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Google sync failed.");
      }

      setMessage(payload.message ?? "Google reviews synced.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google sync failed.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="panel">
      <div className="panel-body">
        <h2 className="section-title">
          <KeyRound size={18} aria-hidden="true" /> Google connection
        </h2>
        <p className="help-text">
          Demo, manual, and CSV modes work without Google. Live Google sync requires OAuth credentials, Business Profile API access,
          and the Google location name.
        </p>
        <div className="actions section">
          <button className="button-secondary" type="button" onClick={connect} disabled={Boolean(loading)}>
            <KeyRound size={17} aria-hidden="true" />
            {loading === "connect" ? "Connecting..." : "Connect Google"}
          </button>
          <button className="button" type="button" onClick={sync} disabled={Boolean(loading)}>
            <RefreshCw size={17} aria-hidden="true" />
            {loading === "sync" ? "Syncing..." : "Sync reviews"}
          </button>
        </div>
        {message ? <div className="toast">{message}</div> : null}
      </div>
    </section>
  );
}
```

### components\ImportReviewsForm.tsx

`$lang
"use client";

import { Clipboard, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { sampleCsv } from "@/lib/csv";

export default function ImportReviewsForm() {
  const router = useRouter();
  const [csv, setCsv] = useState(sampleCsv);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/import/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv })
      });
      const payload = (await response.json()) as { imported?: number; skipped?: number; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Import failed.");
      }
      setMessage(`Imported ${payload.imported ?? 0} review(s). Skipped ${payload.skipped ?? 0} duplicate(s).`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-body">
        <div className="form-row">
          <label htmlFor="csv-input">CSV input</label>
          <textarea
            id="csv-input"
            className="textarea"
            value={csv}
            onChange={(event) => setCsv(event.target.value)}
            spellCheck={false}
          />
          <p className="help-text">
            Required columns: reviewerName, rating, comment, reviewDate. Optional columns: reply, sourceUrl, reviewerProfileUrl.
          </p>
        </div>
        <div className="actions section">
          <button className="button" type="button" onClick={submit} disabled={loading}>
            <Upload size={17} aria-hidden="true" />
            {loading ? "Importing..." : "Import reviews"}
          </button>
          <button className="button-secondary" type="button" onClick={() => setCsv(sampleCsv)}>
            <Clipboard size={17} aria-hidden="true" />
            Load sample
          </button>
        </div>
        {message ? <div className="toast">{message}</div> : null}
      </div>
    </section>
  );
}
```

### components\ManualReviewForm.tsx

`$lang
"use client";

import { PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ManualReviewForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    reviewerName: "",
    rating: "1",
    comment: "",
    reviewDate: new Date().toISOString().slice(0, 10),
    reply: "",
    sourceUrl: "",
    reviewerProfileUrl: ""
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function update(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/reviews/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const payload = (await response.json()) as { review?: { id: string }; error?: string };
      if (!response.ok || !payload.review) {
        throw new Error(payload.error ?? "Could not create review.");
      }
      router.push(`/reviews/${payload.review.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create review.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-body">
        <div className="form-grid">
          <label className="form-row">
            <span>Reviewer name</span>
            <input
              className="field"
              value={form.reviewerName}
              onChange={(event) => update("reviewerName", event.target.value)}
            />
          </label>
          <label className="form-row">
            <span>Rating</span>
            <select className="select" value={form.rating} onChange={(event) => update("rating", event.target.value)}>
              <option value="1">1 star</option>
              <option value="2">2 stars</option>
              <option value="3">3 stars</option>
              <option value="4">4 stars</option>
              <option value="5">5 stars</option>
            </select>
          </label>
          <label className="form-row">
            <span>Review date</span>
            <input
              className="field"
              type="date"
              value={form.reviewDate}
              onChange={(event) => update("reviewDate", event.target.value)}
            />
          </label>
          <label className="form-row">
            <span>Reviewer profile URL</span>
            <input
              className="field"
              value={form.reviewerProfileUrl}
              onChange={(event) => update("reviewerProfileUrl", event.target.value)}
            />
          </label>
          <label className="form-row">
            <span>Review source URL</span>
            <input
              className="field"
              value={form.sourceUrl}
              onChange={(event) => update("sourceUrl", event.target.value)}
            />
          </label>
          <label className="form-row">
            <span>Existing owner reply</span>
            <input
              className="field"
              value={form.reply}
              onChange={(event) => update("reply", event.target.value)}
            />
          </label>
        </div>
        <label className="form-row section">
          <span>Review comment</span>
          <textarea
            className="textarea"
            value={form.comment}
            onChange={(event) => update("comment", event.target.value)}
          />
        </label>
        <div className="actions section">
          <button className="button" type="button" onClick={submit} disabled={loading}>
            <PlusCircle size={17} aria-hidden="true" />
            {loading ? "Adding..." : "Add and analyze"}
          </button>
        </div>
        {message ? <div className="toast">{message}</div> : null}
      </div>
    </section>
  );
}
```

### components\PrintButton.tsx

`$lang
"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button className="button-secondary" type="button" onClick={() => window.print()} title="Print packet">
      <Printer size={17} aria-hidden="true" />
      Print
    </button>
  );
}
```

### components\ReviewActions.tsx

`$lang
"use client";

import { FileText, MessageSquareText, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ReviewActions({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  async function run(action: "analyze" | "draft" | "evidence") {
    setLoading(action);
    setMessage("");

    try {
      const endpoint =
        action === "evidence"
          ? "/api/evidence"
          : action === "draft"
            ? `/api/reviews/${reviewId}/draft-reply`
            : `/api/reviews/${reviewId}/analyze`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "evidence" ? JSON.stringify({ reviewIds: [reviewId] }) : undefined
      });
      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Action failed.");
      }

      if (action === "evidence" && payload.id) {
        router.push(`/evidence/${payload.id}`);
        return;
      }

      setMessage(action === "draft" ? "Draft created." : "Review analyzed.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      <div className="actions">
        <button className="button-secondary" type="button" onClick={() => run("analyze")} disabled={Boolean(loading)}>
          <RefreshCw size={17} aria-hidden="true" />
          {loading === "analyze" ? "Analyzing..." : "Analyze"}
        </button>
        <button className="button-secondary" type="button" onClick={() => run("draft")} disabled={Boolean(loading)}>
          <MessageSquareText size={17} aria-hidden="true" />
          {loading === "draft" ? "Drafting..." : "Draft reply"}
        </button>
        <button className="button" type="button" onClick={() => run("evidence")} disabled={Boolean(loading)}>
          <FileText size={17} aria-hidden="true" />
          {loading === "evidence" ? "Creating..." : "Evidence"}
        </button>
      </div>
      {message ? <div className="toast">{message}</div> : null}
    </div>
  );
}
```

### components\ReviewsTable.tsx

`$lang
"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { SerializedReview } from "@/lib/types";
import { badgeClass, formatDate, statusClass } from "@/lib/format";

export default function ReviewsTable({ reviews }: { reviews: SerializedReview[] }) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("ALL");
  const [rating, setRating] = useState("ALL");

  const filtered = useMemo(() => {
    return reviews.filter((review) => {
      const queryMatch =
        query.trim().length === 0 ||
        `${review.reviewerName} ${review.comment}`.toLowerCase().includes(query.toLowerCase());
      const levelMatch = level === "ALL" || review.suspicionLevel === level;
      const ratingMatch = rating === "ALL" || String(review.rating) === rating;
      return queryMatch && levelMatch && ratingMatch;
    });
  }, [level, query, rating, reviews]);

  return (
    <section className="panel">
      <div className="toolbar">
        <div style={{ flex: "1 1 260px" }}>
          <label className="form-row" htmlFor="review-search">
            <span className="muted">Search</span>
            <span style={{ position: "relative", display: "block" }}>
              <Search
                size={16}
                aria-hidden="true"
                style={{ position: "absolute", left: 12, top: 12, color: "var(--muted)" }}
              />
              <input
                id="review-search"
                className="field"
                style={{ paddingLeft: 36 }}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Reviewer or comment search"
              />
            </span>
          </label>
        </div>
        <label className="form-row" htmlFor="level-filter">
          <span className="muted">Risk</span>
          <select id="level-filter" className="select" value={level} onChange={(event) => setLevel(event.target.value)}>
            <option value="ALL">All risk</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </label>
        <label className="form-row" htmlFor="rating-filter">
          <span className="muted">Rating</span>
          <select id="rating-filter" className="select" value={rating} onChange={(event) => setRating(event.target.value)}>
            <option value="ALL">All ratings</option>
            <option value="1">1 star</option>
            <option value="2">2 stars</option>
            <option value="3">3 stars</option>
            <option value="4">4 stars</option>
            <option value="5">5 stars</option>
          </select>
        </label>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Reviewer</th>
              <th>Rating</th>
              <th>Comment</th>
              <th>Risk</th>
              <th>Signals</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((review) => (
              <tr key={review.id}>
                <td>
                  <Link href={`/reviews/${review.id}`}>{review.reviewerName}</Link>
                </td>
                <td>{review.rating}</td>
                <td className="review-comment">{review.comment}</td>
                <td>
                  <span className={badgeClass(review.suspicionLevel)}>
                    {review.suspicionScore} {review.suspicionLevel.toLowerCase()}
                  </span>
                </td>
                <td>{review.signals.length}</td>
                <td>
                  <span className={statusClass(review.status)}>{review.status.toLowerCase()}</span>
                </td>
                <td>{formatDate(review.reviewDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? <div className="empty">No reviews match the selected filters.</div> : null}
      </div>
    </section>
  );
}
```

### components\ReviewStatusSelect.tsx

`$lang
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const statuses = [
  { value: "NEW", label: "New" },
  { value: "REVIEWING", label: "Reviewing" },
  { value: "RESPONDED", label: "Responded" },
  { value: "ESCALATED", label: "Escalated" },
  { value: "DISMISSED", label: "Dismissed" }
];

export default function ReviewStatusSelect({ reviewId, status }: { reviewId: string; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function updateStatus(nextStatus: string) {
    setValue(nextStatus);
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not update status.");
      }

      router.refresh();
    } catch (error) {
      setValue(status);
      setMessage(error instanceof Error ? error.message : "Could not update status.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="form-row status-control">
      <label htmlFor="review-status">Queue status</label>
      <select
        id="review-status"
        className="select"
        value={value}
        onChange={(event) => updateStatus(event.target.value)}
        disabled={loading}
      >
        {statuses.map((item) => (
          <option value={item.value} key={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      {message ? <div className="toast">{message}</div> : null}
    </div>
  );
}
```

### components\SettingsForm.tsx

`$lang
"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type SettingsProfile = {
  name: string;
  googleLocationName: string | null;
  industry: string | null;
  websiteUrl: string | null;
  phone: string | null;
  address: string | null;
  reviewUrl: string | null;
  detectionSensitivity: number;
};

export default function SettingsForm({ profile }: { profile: SettingsProfile }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: profile.name,
    googleLocationName: profile.googleLocationName ?? "",
    industry: profile.industry ?? "",
    websiteUrl: profile.websiteUrl ?? "",
    phone: profile.phone ?? "",
    address: profile.address ?? "",
    reviewUrl: profile.reviewUrl ?? "",
    detectionSensitivity: String(profile.detectionSensitivity)
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function update(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Save failed.");
      }
      setMessage("Settings saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="form-grid section">
      <label className="form-row">
        <span>Name</span>
        <input className="field" value={form.name} onChange={(event) => update("name", event.target.value)} />
      </label>
      <label className="form-row">
        <span>Industry</span>
        <input className="field" value={form.industry} onChange={(event) => update("industry", event.target.value)} />
      </label>
      <label className="form-row">
        <span>Google location name</span>
        <input
          className="field"
          value={form.googleLocationName}
          onChange={(event) => update("googleLocationName", event.target.value)}
        />
        <p className="help-text">Use the format accounts/123/locations/456.</p>
      </label>
      <label className="form-row">
        <span>Website</span>
        <input className="field" value={form.websiteUrl} onChange={(event) => update("websiteUrl", event.target.value)} />
      </label>
      <label className="form-row">
        <span>Phone</span>
        <input className="field" value={form.phone} onChange={(event) => update("phone", event.target.value)} />
      </label>
      <label className="form-row">
        <span>Address</span>
        <input className="field" value={form.address} onChange={(event) => update("address", event.target.value)} />
      </label>
      <label className="form-row">
        <span>Review link</span>
        <input className="field" value={form.reviewUrl} onChange={(event) => update("reviewUrl", event.target.value)} />
      </label>
      <label className="form-row">
        <span>Suspicion threshold</span>
        <input
          className="field"
          type="number"
          min="0"
          max="100"
          value={form.detectionSensitivity}
          onChange={(event) => update("detectionSensitivity", event.target.value)}
        />
      </label>
      <div className="form-row">
        <span>&nbsp;</span>
        <button className="button" type="button" onClick={submit} disabled={loading}>
          <Save size={17} aria-hidden="true" />
          {loading ? "Saving..." : "Save settings"}
        </button>
      </div>
      {message ? <div className="toast">{message}</div> : null}
    </div>
  );
}
```

### lib\csv.ts

`$lang
export type ImportedReviewInput = {
  reviewerName: string;
  rating: number;
  comment: string;
  reviewDate: Date;
  reply?: string;
  sourceUrl?: string;
  reviewerProfileUrl?: string;
};

function parseCsvRecords(input: string) {
  const records: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];

    if (character === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && next === "\n") {
        index += 1;
      }

      row.push(current.trim());
      current = "";
      if (row.some((value) => value.length > 0)) {
        records.push(row);
      }
      row = [];
      continue;
    }

    current += character;
  }

  row.push(current.trim());
  if (row.some((value) => value.length > 0)) {
    records.push(row);
  }

  if (inQuotes) {
    throw new Error("CSV contains an unclosed quoted field.");
  }

  return records;
}

export function parseReviewsCsv(input: string): ImportedReviewInput[] {
  const records = parseCsvRecords(input);

  if (records.length < 2) {
    throw new Error("CSV must include a header row and at least one review row.");
  }

  const headers = records[0].map((header) => header.trim());
  const normalizedHeaders = headers.map((header) => header.toLowerCase());

  function value(row: string[], header: string) {
    const index = normalizedHeaders.indexOf(header.toLowerCase());
    return index >= 0 ? row[index]?.trim() ?? "" : "";
  }

  const required = ["reviewerName", "rating", "comment", "reviewDate"];
  const missing = required.filter((header) => !normalizedHeaders.includes(header.toLowerCase()));
  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(", ")}.`);
  }

  return records.slice(1).map((row, index) => {
    const rating = Number(value(row, "rating"));
    const reviewDate = new Date(value(row, "reviewDate"));

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new Error(`Row ${index + 2} has an invalid rating. Use a whole number from 1 to 5.`);
    }

    if (Number.isNaN(reviewDate.getTime())) {
      throw new Error(`Row ${index + 2} has an invalid reviewDate.`);
    }

    const reviewerName = value(row, "reviewerName");
    const comment = value(row, "comment");

    if (!reviewerName || !comment) {
      throw new Error(`Row ${index + 2} needs reviewerName and comment values.`);
    }

    return {
      reviewerName,
      rating,
      comment,
      reviewDate,
      reply: value(row, "reply") || undefined,
      sourceUrl: value(row, "sourceUrl") || undefined,
      reviewerProfileUrl: value(row, "reviewerProfileUrl") || undefined
    };
  });
}

export const sampleCsv = `reviewerName,rating,comment,reviewDate,reply,sourceUrl,reviewerProfileUrl
Jordan Lee,1,"Worst place ever. Avoid this business.",2026-07-06,,,
Sam Patel,5,"Clear communication and fast service.",2026-07-05,"Thank you, Sam.",,`;
```

### lib\dashboard.ts

`$lang
import type { Review } from "@prisma/client";
import { analyzeAllReviews, type DetectionResult } from "@/lib/detection";
import { db } from "@/lib/db";
import { getDefaultProfile } from "@/lib/profile";

type AnalyzedReview = {
  review: Review;
  result: DetectionResult;
};

export async function persistAnalysisResults(analyzed: AnalyzedReview[]) {
  await db.$transaction(async (tx) => {
    for (const item of analyzed) {
      await tx.detectionSignal.deleteMany({ where: { reviewId: item.review.id } });
      await tx.review.update({
        where: { id: item.review.id },
        data: {
          suspicionScore: item.result.score,
          suspicionLevel: item.result.level,
          analyzedAt: new Date(),
          signals: {
            create: item.result.signals
          }
        }
      });
    }
  });
}

async function syncRiskAlert(profileId: string, criticalCount: number, highCount: number, threshold: number) {
  const activeRiskTitles = ["Critical suspicious reviews found", "High-risk review threshold crossed"];
  const now = new Date();

  if (criticalCount === 0 && highCount === 0) {
    await db.alert.updateMany({
      where: {
        businessProfileId: profileId,
        title: { in: activeRiskTitles },
        resolvedAt: null
      },
      data: { resolvedAt: now }
    });
    return;
  }

  const alert =
    criticalCount > 0
      ? {
          title: "Critical suspicious reviews found",
          message: `${criticalCount} review(s) have critical suspicion scores after the latest analysis.`,
          severity: "CRITICAL"
        }
      : {
          title: "High-risk review threshold crossed",
          message: `${highCount} review(s) are at or above your sensitivity threshold of ${threshold}.`,
          severity: "WARNING"
        };

  await db.alert.updateMany({
    where: {
      businessProfileId: profileId,
      title: { in: activeRiskTitles.filter((title) => title !== alert.title) },
      resolvedAt: null
    },
    data: { resolvedAt: now }
  });

  const existing = await db.alert.findFirst({
    where: {
      businessProfileId: profileId,
      title: alert.title,
      resolvedAt: null
    }
  });

  if (existing) {
    await db.alert.update({
      where: { id: existing.id },
      data: {
        message: alert.message,
        severity: alert.severity
      }
    });
    return;
  }

  await db.alert.create({
    data: {
      businessProfileId: profileId,
      ...alert
    }
  });
}

export async function refreshAnalysisForProfile() {
  const profile = await getDefaultProfile();
  const reviews = await db.review.findMany({
    where: { businessProfileId: profile.id },
    orderBy: { reviewDate: "desc" }
  });

  const analyzed = analyzeAllReviews(reviews);
  await persistAnalysisResults(analyzed);

  const criticalCount = analyzed.filter((item) => item.result.score >= 80).length;
  const highCount = analyzed.filter((item) => item.result.score >= profile.detectionSensitivity).length;
  await syncRiskAlert(profile.id, criticalCount, highCount, profile.detectionSensitivity);

  return analyzed.length;
}
```

### lib\db.ts

`$lang
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
```

### lib\detection.ts

`$lang
import type { Review } from "@prisma/client";
import { clamp } from "@/lib/format";

export type SignalSeverity = "INFO" | "WATCH" | "WARNING" | "CRITICAL";
export type SuspicionLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type SignalInput = {
  type: string;
  label: string;
  explanation: string;
  weight: number;
  severity: SignalSeverity;
};

export type DetectionResult = {
  score: number;
  level: SuspicionLevel;
  signals: SignalInput[];
};

const suspiciousPhrases = [
  "scam",
  "fraud",
  "avoid this business",
  "worst place ever",
  "do not waste your money",
  "competitor",
  "marketing vendor",
  "declined",
  "one star"
];

const genericShortPhrases = [
  "bad service",
  "terrible",
  "worst",
  "never again",
  "avoid"
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value: string) {
  return new Set(normalizeText(value).split(" ").filter((token) => token.length > 2));
}

function jaccardSimilarity(left: string, right: string) {
  const a = tokenSet(left);
  const b = tokenSet(right);

  if (!a.size || !b.size) {
    return 0;
  }

  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

function hoursBetween(left: Date, right: Date) {
  return Math.abs(left.getTime() - right.getTime()) / 1000 / 60 / 60;
}

function levelForScore(score: number): SuspicionLevel {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}

export function analyzeReview(review: Review, allReviews: Review[]): DetectionResult {
  const signals: SignalInput[] = [];
  const comment = normalizeText(review.comment);

  if (review.rating <= 2) {
    signals.push({
      type: "LOW_RATING",
      label: "Low-star review",
      explanation: "The review is one or two stars, so it has a higher reputation impact and deserves review before a public response.",
      weight: review.rating === 1 ? 14 : 9,
      severity: review.rating === 1 ? "WARNING" : "WATCH"
    });
  }

  if (!review.reviewerProfileUrl || review.reviewerProfileUrl.trim().length < 8) {
    signals.push({
      type: "SPARSE_REVIEWER_METADATA",
      label: "Sparse reviewer metadata",
      explanation: "The reviewer profile URL is missing or incomplete. This does not prove fraud, but it weakens reviewer context.",
      weight: 11,
      severity: "WATCH"
    });
  }

  if (review.comment.trim().length <= 24 && review.rating <= 2) {
    signals.push({
      type: "SHORT_LOW_CONTEXT",
      label: "Short low-context complaint",
      explanation: "The review has very little detail for a low rating, which makes it harder to verify against customer records.",
      weight: 13,
      severity: "WARNING"
    });
  }

  const phraseHits = suspiciousPhrases.filter((phrase) => comment.includes(phrase));
  if (phraseHits.length > 0) {
    signals.push({
      type: "SUSPICIOUS_LANGUAGE",
      label: "Suspicious wording",
      explanation: `The review contains high-intensity or attack-like wording: ${phraseHits.join(", ")}.`,
      weight: Math.min(24, 8 + phraseHits.length * 5),
      severity: "WARNING"
    });
  }

  const genericHits = genericShortPhrases.filter((phrase) => comment === phrase || comment.includes(phrase));
  if (genericHits.length > 0 && comment.split(" ").length <= 8) {
    signals.push({
      type: "GENERIC_COMPLAINT",
      label: "Generic complaint",
      explanation: "The complaint is broad and hard to match to a specific customer experience.",
      weight: 9,
      severity: "WATCH"
    });
  }

  const lowStarBurstCount = allReviews.filter((candidate) => {
    return (
      candidate.id !== review.id &&
      candidate.rating <= 2 &&
      review.rating <= 2 &&
      hoursBetween(candidate.reviewDate, review.reviewDate) <= 48
    );
  }).length;

  if (lowStarBurstCount >= 2) {
    signals.push({
      type: "LOW_STAR_BURST",
      label: "Low-star burst",
      explanation: `${lowStarBurstCount + 1} low-star reviews landed within a 48-hour window.`,
      weight: Math.min(30, 16 + lowStarBurstCount * 4),
      severity: "CRITICAL"
    });
  }

  const similarReview = allReviews
    .filter((candidate) => candidate.id !== review.id)
    .map((candidate) => ({
      candidate,
      similarity: jaccardSimilarity(review.comment, candidate.comment)
    }))
    .sort((a, b) => b.similarity - a.similarity)[0];

  if (similarReview && similarReview.similarity >= 0.72) {
    signals.push({
      type: "REPEATED_WORDING",
      label: "Repeated wording",
      explanation: `This review is ${Math.round(similarReview.similarity * 100)}% similar to another review from ${similarReview.candidate.reviewerName}.`,
      weight: 28,
      severity: "CRITICAL"
    });
  }

  if (!review.reply && review.rating <= 3) {
    signals.push({
      type: "NO_OWNER_RESPONSE",
      label: "No owner response",
      explanation: "There is no public owner reply yet. A careful response can reduce reputational damage while evidence is collected.",
      weight: 6,
      severity: "INFO"
    });
  }

  const rawScore = signals.reduce((sum, signal) => sum + signal.weight, 0);
  const score = clamp(rawScore, 0, 100);

  return {
    score,
    level: levelForScore(score),
    signals
  };
}

export function analyzeAllReviews(reviews: Review[]) {
  return reviews.map((review) => ({
    review,
    result: analyzeReview(review, reviews)
  }));
}
```

### lib\evidence.ts

`$lang
import type { BusinessProfile, DetectionSignal, Review } from "@prisma/client";
import { formatDateTime } from "@/lib/format";

type ReviewWithSignals = Review & {
  signals: DetectionSignal[];
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildEvidenceHtml(profile: BusinessProfile, reviews: ReviewWithSignals[]) {
  const criticalCount = reviews.filter((review) => review.suspicionScore >= 80).length;
  const highCount = reviews.filter((review) => review.suspicionScore >= 60).length;
  const averageScore =
    reviews.length > 0
      ? Math.round(reviews.reduce((sum, review) => sum + review.suspicionScore, 0) / reviews.length)
      : 0;

  const rows = reviews
    .map((review) => {
      const signalText = review.signals
        .map((signal) => `${escapeHtml(signal.label)} (${signal.weight})`)
        .join(", ");

      return `<tr>
        <td>${escapeHtml(review.reviewerName)}</td>
        <td>${review.rating}</td>
        <td>${formatDateTime(review.reviewDate)}</td>
        <td>${review.suspicionScore} / ${escapeHtml(review.suspicionLevel)}</td>
        <td>${escapeHtml(signalText || "No signals recorded")}</td>
        <td>${escapeHtml(review.comment)}</td>
      </tr>`;
    })
    .join("");

  const timeline = reviews
    .slice()
    .sort((a, b) => a.reviewDate.getTime() - b.reviewDate.getTime())
    .map(
      (review) =>
        `<li><strong>${formatDateTime(review.reviewDate)}</strong>: ${escapeHtml(
          review.reviewerName
        )} left a ${review.rating}-star review with score ${review.suspicionScore}.</li>`
    )
    .join("");

  return `
    <h1>Suspicious Review Evidence Packet</h1>
    <p><strong>Business:</strong> ${escapeHtml(profile.name)}</p>
    <p><strong>Created:</strong> ${formatDateTime(new Date())}</p>
    <h2>Summary</h2>
    <p>This packet groups ${reviews.length} review(s) for internal review and potential Google escalation. Average suspicion score is ${averageScore}. Critical reviews: ${criticalCount}. High or higher reviews: ${highCount}.</p>
    <h2>Timeline</h2>
    <ol>${timeline}</ol>
    <h2>Review Evidence</h2>
    <table>
      <thead>
        <tr>
          <th>Reviewer</th>
          <th>Rating</th>
          <th>Date</th>
          <th>Risk</th>
          <th>Signals</th>
          <th>Comment</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <h2>Escalation Notes</h2>
    <p>Recommended next action: compare reviewer names and timestamps against customer records, document any mismatch, reply publicly without accusation, and escalate only reviews that violate platform policy or appear coordinated.</p>
  `;
}
```

### lib\format.ts

`$lang
export function formatDate(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

export function formatDateTime(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function scoreLabel(score: number) {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 35) return "Medium";
  return "Low";
}

export function badgeClass(level: string) {
  const normalized = level.toLowerCase();
  if (normalized === "critical") return "badge badge-critical";
  if (normalized === "high") return "badge badge-high";
  if (normalized === "medium") return "badge badge-medium";
  if (normalized === "warning") return "badge badge-high";
  if (normalized === "info") return "badge badge-info";
  return "badge badge-low";
}

export function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "escalated") return "badge badge-critical";
  if (normalized === "reviewing") return "badge badge-medium";
  if (normalized === "responded") return "badge badge-info";
  if (normalized === "dismissed") return "badge badge-low";
  return "badge badge-info";
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
```

### lib\google.ts

`$lang
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
```

### lib\profile.ts

`$lang
import { db } from "@/lib/db";

export async function getDefaultProfile() {
  const existing = await db.businessProfile.findFirst({
    orderBy: { createdAt: "asc" }
  });

  if (existing) {
    return existing;
  }

  return db.businessProfile.create({
    data: {
      name: "Demo Local Business",
      industry: "Local services",
      detectionSensitivity: 65
    }
  });
}
```

### lib\replies.ts

`$lang
import type { BusinessProfile, Review } from "@prisma/client";

export function draftPublicReply(review: Review, profile: BusinessProfile) {
  const businessName = profile.name;
  const contactLine = profile.phone
    ? `Please contact us at ${profile.phone} so we can look into this directly.`
    : "Please contact our team directly so we can look into this.";

  if (review.suspicionScore >= 60) {
    return [
      `Thank you for sharing feedback about ${businessName}.`,
      "We take reviews seriously, but we are not able to match this description to a recent customer experience from the details provided.",
      contactLine,
      "We want to understand what happened and resolve any legitimate concern."
    ].join(" ");
  }

  if (review.rating <= 2) {
    return [
      `Thank you for bringing this to our attention.`,
      "We are sorry your experience did not meet expectations.",
      contactLine,
      "Your feedback helps us improve how we serve customers."
    ].join(" ");
  }

  return [
    `Thank you for the review and for choosing ${businessName}.`,
    "We appreciate the feedback and will share it with the team."
  ].join(" ");
}
```

### lib\serialize.ts

`$lang
import type { DetectionSignal, ResponseDraft, Review } from "@prisma/client";
import type { SerializedReview } from "@/lib/types";

type ReviewWithRelations = Review & {
  signals?: DetectionSignal[];
  responseDrafts?: ResponseDraft[];
};

export function serializeReview(review: ReviewWithRelations): SerializedReview {
  return {
    id: review.id,
    reviewerName: review.reviewerName,
    reviewerProfileUrl: review.reviewerProfileUrl,
    rating: review.rating,
    comment: review.comment,
    reviewDate: review.reviewDate.toISOString(),
    reply: review.reply,
    sourceUrl: review.sourceUrl,
    source: review.source,
    status: review.status,
    suspicionScore: review.suspicionScore,
    suspicionLevel: review.suspicionLevel,
    analyzedAt: review.analyzedAt?.toISOString() ?? null,
    signals:
      review.signals?.map((signal) => ({
        id: signal.id,
        type: signal.type,
        label: signal.label,
        explanation: signal.explanation,
        weight: signal.weight,
        severity: signal.severity,
        createdAt: signal.createdAt.toISOString()
      })) ?? [],
    responseDrafts:
      review.responseDrafts?.map((draft) => ({
        id: draft.id,
        tone: draft.tone,
        content: draft.content,
        createdAt: draft.createdAt.toISOString()
      })) ?? []
  };
}
```

### lib\types.ts

`$lang
export type SerializedSignal = {
  id: string;
  type: string;
  label: string;
  explanation: string;
  weight: number;
  severity: string;
  createdAt: string;
};

export type SerializedDraft = {
  id: string;
  tone: string;
  content: string;
  createdAt: string;
};

export type SerializedReview = {
  id: string;
  reviewerName: string;
  reviewerProfileUrl: string | null;
  rating: number;
  comment: string;
  reviewDate: string;
  reply: string | null;
  sourceUrl: string | null;
  source: string;
  status: string;
  suspicionScore: number;
  suspicionLevel: string;
  analyzedAt: string | null;
  signals: SerializedSignal[];
  responseDrafts: SerializedDraft[];
};
```

### next.config.mjs

`$lang
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true
};

export default nextConfig;
```

### next-env.d.ts

`$lang
/// <reference types="next" />
/// <reference types="next/image-types/global" />
/// <reference path="./.next/types/routes.d.ts" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

### package.json

`$lang
{
  "name": "googl-fake-review-detector",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "eslint . --ext .js,.mjs,.ts,.tsx --max-warnings=0",
    "test": "vitest run",
    "check": "tsc --noEmit",
    "db:push": "prisma db push",
    "db:seed": "node prisma/seed.mjs",
    "postinstall": "prisma generate"
  },
  "dependencies": {
    "@prisma/client": "5.22.0",
    "lucide-react": "0.468.0",
    "next": "^15.5.18",
    "react": "^19.1.1",
    "react-dom": "^19.1.1"
  },
  "devDependencies": {
    "@types/node": "^22.20.1",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "eslint": "8.57.1",
    "eslint-config-next": "^15.5.18",
    "prisma": "5.22.0",
    "typescript": "5.7.2",
    "vitest": "^4.1.10"
  },
  "overrides": {
    "postcss": "8.5.10"
  }
}
```

### package-lock.json

`$lang
{
  "name": "googl-fake-review-detector",
  "version": "0.1.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "googl-fake-review-detector",
      "version": "0.1.0",
      "hasInstallScript": true,
      "dependencies": {
        "@prisma/client": "5.22.0",
        "lucide-react": "0.468.0",
        "next": "^15.5.18",
        "react": "^19.1.1",
        "react-dom": "^19.1.1"
      },
      "devDependencies": {
        "@types/node": "^22.20.1",
        "@types/react": "^19.0.0",
        "@types/react-dom": "^19.0.0",
        "eslint": "8.57.1",
        "eslint-config-next": "^15.5.18",
        "prisma": "5.22.0",
        "typescript": "5.7.2",
        "vitest": "^4.1.10"
      }
    },
    "node_modules/@emnapi/core": {
      "version": "1.10.0",
      "dev": true,
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "@emnapi/wasi-threads": "1.2.1",
        "tslib": "^2.4.0"
      }
    },
    "node_modules/@emnapi/runtime": {
      "version": "1.10.0",
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "tslib": "^2.4.0"
      }
    },
    "node_modules/@emnapi/wasi-threads": {
      "version": "1.2.1",
      "dev": true,
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "tslib": "^2.4.0"
      }
    },
    "node_modules/@eslint-community/eslint-utils": {
      "version": "4.9.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "eslint-visitor-keys": "^3.4.3"
      },
      "engines": {
        "node": "^12.22.0 || ^14.17.0 || >=16.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      },
      "peerDependencies": {
        "eslint": "^6.0.0 || ^7.0.0 || >=8.0.0"
      }
    },
    "node_modules/@eslint-community/regexpp": {
      "version": "4.12.2",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "^12.0.0 || ^14.0.0 || >=16.0.0"
      }
    },
    "node_modules/@eslint/eslintrc": {
      "version": "2.1.4",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ajv": "^6.12.4",
        "debug": "^4.3.2",
        "espree": "^9.6.0",
        "globals": "^13.19.0",
        "ignore": "^5.2.0",
        "import-fresh": "^3.2.1",
        "js-yaml": "^4.1.0",
        "minimatch": "^3.1.2",
        "strip-json-comments": "^3.1.1"
      },
      "engines": {
        "node": "^12.22.0 || ^14.17.0 || >=16.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/@eslint/js": {
      "version": "8.57.1",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "^12.22.0 || ^14.17.0 || >=16.0.0"
      }
    },
    "node_modules/@humanwhocodes/config-array": {
      "version": "0.13.0",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@humanwhocodes/object-schema": "^2.0.3",
        "debug": "^4.3.1",
        "minimatch": "^3.0.5"
      },
      "engines": {
        "node": ">=10.10.0"
      }
    },
    "node_modules/@humanwhocodes/module-importer": {
      "version": "1.0.1",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">=12.22"
      },
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/nzakas"
      }
    },
    "node_modules/@humanwhocodes/object-schema": {
      "version": "2.0.3",
      "dev": true,
      "license": "BSD-3-Clause"
    },
    "node_modules/@img/colour": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/@img/colour/-/colour-1.1.0.tgz",
      "integrity": "sha512-Td76q7j57o/tLVdgS746cYARfSyxk8iEfRxewL9h4OMzYhbW4TAcppl0mT4eyqXddh6L/jwoM75mo7ixa/pCeQ==",
      "license": "MIT",
      "optional": true,
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/@img/sharp-darwin-arm64": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-darwin-arm64/-/sharp-darwin-arm64-0.34.5.tgz",
      "integrity": "sha512-imtQ3WMJXbMY4fxb/Ndp6HBTNVtWCUI0WdobyheGf5+ad6xX8VIDO8u2xE4qc/fr08CKG/7dDseFtn6M6g/r3w==",
      "cpu": [
        "arm64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-darwin-arm64": "1.2.4"
      }
    },
    "node_modules/@img/sharp-darwin-x64": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-darwin-x64/-/sharp-darwin-x64-0.34.5.tgz",
      "integrity": "sha512-YNEFAF/4KQ/PeW0N+r+aVVsoIY0/qxxikF2SWdp+NRkmMB7y9LBZAVqQ4yhGCm/H3H270OSykqmQMKLBhBJDEw==",
      "cpu": [
        "x64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-darwin-x64": "1.2.4"
      }
    },
    "node_modules/@img/sharp-libvips-darwin-arm64": {
      "version": "1.2.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-darwin-arm64/-/sharp-libvips-darwin-arm64-1.2.4.tgz",
      "integrity": "sha512-zqjjo7RatFfFoP0MkQ51jfuFZBnVE2pRiaydKJ1G/rHZvnsrHAOcQALIi9sA5co5xenQdTugCvtb1cuf78Vf4g==",
      "cpu": [
        "arm64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "darwin"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-darwin-x64": {
      "version": "1.2.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-darwin-x64/-/sharp-libvips-darwin-x64-1.2.4.tgz",
      "integrity": "sha512-1IOd5xfVhlGwX+zXv2N93k0yMONvUlANylbJw1eTah8K/Jtpi15KC+WSiaX/nBmbm2HxRM1gZ0nSdjSsrZbGKg==",
      "cpu": [
        "x64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "darwin"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-arm": {
      "version": "1.2.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-arm/-/sharp-libvips-linux-arm-1.2.4.tgz",
      "integrity": "sha512-bFI7xcKFELdiNCVov8e44Ia4u2byA+l3XtsAj+Q8tfCwO6BQ8iDojYdvoPMqsKDkuoOo+X6HZA0s0q11ANMQ8A==",
      "cpu": [
        "arm"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-arm64": {
      "version": "1.2.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-arm64/-/sharp-libvips-linux-arm64-1.2.4.tgz",
      "integrity": "sha512-excjX8DfsIcJ10x1Kzr4RcWe1edC9PquDRRPx3YVCvQv+U5p7Yin2s32ftzikXojb1PIFc/9Mt28/y+iRklkrw==",
      "cpu": [
        "arm64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-ppc64": {
      "version": "1.2.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-ppc64/-/sharp-libvips-linux-ppc64-1.2.4.tgz",
      "integrity": "sha512-FMuvGijLDYG6lW+b/UvyilUWu5Ayu+3r2d1S8notiGCIyYU/76eig1UfMmkZ7vwgOrzKzlQbFSuQfgm7GYUPpA==",
      "cpu": [
        "ppc64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-riscv64": {
      "version": "1.2.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-riscv64/-/sharp-libvips-linux-riscv64-1.2.4.tgz",
      "integrity": "sha512-oVDbcR4zUC0ce82teubSm+x6ETixtKZBh/qbREIOcI3cULzDyb18Sr/Wcyx7NRQeQzOiHTNbZFF1UwPS2scyGA==",
      "cpu": [
        "riscv64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-s390x": {
      "version": "1.2.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-s390x/-/sharp-libvips-linux-s390x-1.2.4.tgz",
      "integrity": "sha512-qmp9VrzgPgMoGZyPvrQHqk02uyjA0/QrTO26Tqk6l4ZV0MPWIW6LTkqOIov+J1yEu7MbFQaDpwdwJKhbJvuRxQ==",
      "cpu": [
        "s390x"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linux-x64": {
      "version": "1.2.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-x64/-/sharp-libvips-linux-x64-1.2.4.tgz",
      "integrity": "sha512-tJxiiLsmHc9Ax1bz3oaOYBURTXGIRDODBqhveVHonrHJ9/+k89qbLl0bcJns+e4t4rvaNBxaEZsFtSfAdquPrw==",
      "cpu": [
        "x64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linuxmusl-arm64": {
      "version": "1.2.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linuxmusl-arm64/-/sharp-libvips-linuxmusl-arm64-1.2.4.tgz",
      "integrity": "sha512-FVQHuwx1IIuNow9QAbYUzJ+En8KcVm9Lk5+uGUQJHaZmMECZmOlix9HnH7n1TRkXMS0pGxIJokIVB9SuqZGGXw==",
      "cpu": [
        "arm64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-libvips-linuxmusl-x64": {
      "version": "1.2.4",
      "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linuxmusl-x64/-/sharp-libvips-linuxmusl-x64-1.2.4.tgz",
      "integrity": "sha512-+LpyBk7L44ZIXwz/VYfglaX/okxezESc6UxDSoyo2Ks6Jxc4Y7sGjpgU9s4PMgqgjj1gZCylTieNamqA1MF7Dg==",
      "cpu": [
        "x64"
      ],
      "license": "LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "linux"
      ],
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-linux-arm": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-arm/-/sharp-linux-arm-0.34.5.tgz",
      "integrity": "sha512-9dLqsvwtg1uuXBGZKsxem9595+ujv0sJ6Vi8wcTANSFpwV/GONat5eCkzQo/1O6zRIkh0m/8+5BjrRr7jDUSZw==",
      "cpu": [
        "arm"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-arm": "1.2.4"
      }
    },
    "node_modules/@img/sharp-linux-arm64": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-arm64/-/sharp-linux-arm64-0.34.5.tgz",
      "integrity": "sha512-bKQzaJRY/bkPOXyKx5EVup7qkaojECG6NLYswgktOZjaXecSAeCWiZwwiFf3/Y+O1HrauiE3FVsGxFg8c24rZg==",
      "cpu": [
        "arm64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-arm64": "1.2.4"
      }
    },
    "node_modules/@img/sharp-linux-ppc64": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-ppc64/-/sharp-linux-ppc64-0.34.5.tgz",
      "integrity": "sha512-7zznwNaqW6YtsfrGGDA6BRkISKAAE1Jo0QdpNYXNMHu2+0dTrPflTLNkpc8l7MUP5M16ZJcUvysVWWrMefZquA==",
      "cpu": [
        "ppc64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-ppc64": "1.2.4"
      }
    },
    "node_modules/@img/sharp-linux-riscv64": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-riscv64/-/sharp-linux-riscv64-0.34.5.tgz",
      "integrity": "sha512-51gJuLPTKa7piYPaVs8GmByo7/U7/7TZOq+cnXJIHZKavIRHAP77e3N2HEl3dgiqdD/w0yUfiJnII77PuDDFdw==",
      "cpu": [
        "riscv64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-riscv64": "1.2.4"
      }
    },
    "node_modules/@img/sharp-linux-s390x": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-s390x/-/sharp-linux-s390x-0.34.5.tgz",
      "integrity": "sha512-nQtCk0PdKfho3eC5MrbQoigJ2gd1CgddUMkabUj+rBevs8tZ2cULOx46E7oyX+04WGfABgIwmMC0VqieTiR4jg==",
      "cpu": [
        "s390x"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-s390x": "1.2.4"
      }
    },
    "node_modules/@img/sharp-linux-x64": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linux-x64/-/sharp-linux-x64-0.34.5.tgz",
      "integrity": "sha512-MEzd8HPKxVxVenwAa+JRPwEC7QFjoPWuS5NZnBt6B3pu7EG2Ge0id1oLHZpPJdn3OQK+BQDiw9zStiHBTJQQQQ==",
      "cpu": [
        "x64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linux-x64": "1.2.4"
      }
    },
    "node_modules/@img/sharp-linuxmusl-arm64": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linuxmusl-arm64/-/sharp-linuxmusl-arm64-0.34.5.tgz",
      "integrity": "sha512-fprJR6GtRsMt6Kyfq44IsChVZeGN97gTD331weR1ex1c1rypDEABN6Tm2xa1wE6lYb5DdEnk03NZPqA7Id21yg==",
      "cpu": [
        "arm64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linuxmusl-arm64": "1.2.4"
      }
    },
    "node_modules/@img/sharp-linuxmusl-x64": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-linuxmusl-x64/-/sharp-linuxmusl-x64-0.34.5.tgz",
      "integrity": "sha512-Jg8wNT1MUzIvhBFxViqrEhWDGzqymo3sV7z7ZsaWbZNDLXRJZoRGrjulp60YYtV4wfY8VIKcWidjojlLcWrd8Q==",
      "cpu": [
        "x64"
      ],
      "license": "Apache-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-libvips-linuxmusl-x64": "1.2.4"
      }
    },
    "node_modules/@img/sharp-wasm32": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-wasm32/-/sharp-wasm32-0.34.5.tgz",
      "integrity": "sha512-OdWTEiVkY2PHwqkbBI8frFxQQFekHaSSkUIJkwzclWZe64O1X4UlUjqqqLaPbUpMOQk6FBu/HtlGXNblIs0huw==",
      "cpu": [
        "wasm32"
      ],
      "license": "Apache-2.0 AND LGPL-3.0-or-later AND MIT",
      "optional": true,
      "dependencies": {
        "@emnapi/runtime": "^1.7.0"
      },
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-win32-arm64": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-win32-arm64/-/sharp-win32-arm64-0.34.5.tgz",
      "integrity": "sha512-WQ3AgWCWYSb2yt+IG8mnC6Jdk9Whs7O0gxphblsLvdhSpSTtmu69ZG1Gkb6NuvxsNACwiPV6cNSZNzt0KPsw7g==",
      "cpu": [
        "arm64"
      ],
      "license": "Apache-2.0 AND LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-win32-ia32": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-win32-ia32/-/sharp-win32-ia32-0.34.5.tgz",
      "integrity": "sha512-FV9m/7NmeCmSHDD5j4+4pNI8Cp3aW+JvLoXcTUo0IqyjSfAZJ8dIUmijx1qaJsIiU+Hosw6xM5KijAWRJCSgNg==",
      "cpu": [
        "ia32"
      ],
      "license": "Apache-2.0 AND LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@img/sharp-win32-x64": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/@img/sharp-win32-x64/-/sharp-win32-x64-0.34.5.tgz",
      "integrity": "sha512-+29YMsqY2/9eFEiW93eqWnuLcWcufowXewwSNIT6UwZdUUCrM3oFjMWH/Z6/TMmb4hlFenmfAVbpWeup2jryCw==",
      "cpu": [
        "x64"
      ],
      "license": "Apache-2.0 AND LGPL-3.0-or-later",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      }
    },
    "node_modules/@jridgewell/sourcemap-codec": {
      "version": "1.5.5",
      "resolved": "https://registry.npmjs.org/@jridgewell/sourcemap-codec/-/sourcemap-codec-1.5.5.tgz",
      "integrity": "sha512-cYQ9310grqxueWbl+WuIUIaiUaDcj7WOq5fVhEljNVgRfOUhY9fy2zTvfoqWsnebh8Sl70VScFbICvJnLKB0Og==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@napi-rs/wasm-runtime": {
      "version": "1.1.6",
      "dev": true,
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "@tybys/wasm-util": "^0.10.3"
      },
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/Brooooooklyn"
      },
      "peerDependencies": {
        "@emnapi/core": "^1.7.1",
        "@emnapi/runtime": "^1.7.1"
      }
    },
    "node_modules/@next/env": {
      "version": "15.5.18",
      "resolved": "https://registry.npmjs.org/@next/env/-/env-15.5.18.tgz",
      "integrity": "sha512-hAV85Ckd9QR6RvH04MEKwsfLTksvFpO47j9xwtoIuvuPnlwecpSi+uZTtm8HirVbtlI2Fnz//xpcSTjFdyJk+g==",
      "license": "MIT"
    },
    "node_modules/@next/eslint-plugin-next": {
      "version": "15.5.18",
      "resolved": "https://registry.npmjs.org/@next/eslint-plugin-next/-/eslint-plugin-next-15.5.18.tgz",
      "integrity": "sha512-w4MYq8M26a8PNrfto0JosLf5/3ssln1rsyP96g2DkC8uFVymStM5DLSz5ElxxrPRg2XnTMnFo3kREFlhYvxhWw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "fast-glob": "3.3.1"
      }
    },
    "node_modules/@next/swc-darwin-arm64": {
      "version": "15.5.18",
      "resolved": "https://registry.npmjs.org/@next/swc-darwin-arm64/-/swc-darwin-arm64-15.5.18.tgz",
      "integrity": "sha512-w0WvQf1n+txiwns/9pwIQteCJpZTbxzO2SE0FLcwuD4v0WEh1JPOjdyxWL21XwJsdpx8cFRjyzxzCS/siP7HcQ==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-darwin-x64": {
      "version": "15.5.18",
      "resolved": "https://registry.npmjs.org/@next/swc-darwin-x64/-/swc-darwin-x64-15.5.18.tgz",
      "integrity": "sha512-znn71QmDuxm+BOaglihMZfvyySMnNljkVIY5Z2TCssBmm+WqL6c19VhtH5ktFkHa8EZ2bnTUpcNcmNSQsg67og==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-arm64-gnu": {
      "version": "15.5.18",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-arm64-gnu/-/swc-linux-arm64-gnu-15.5.18.tgz",
      "integrity": "sha512-yPPe5MNL+igZUa+OsqQJisqSfh6oarIuA1Q0BDxljGJhRQyZeP+WRHh7rs/jZUGMh5aY0YdIjXZG0VohkKkUdw==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-arm64-musl": {
      "version": "15.5.18",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-arm64-musl/-/swc-linux-arm64-musl-15.5.18.tgz",
      "integrity": "sha512-glaCczEWIrHsokFZ3pP08U4BpKxwIdnT+txdOM32OBgpL9Yw4aqx8NejmgtZQZOdstQ5f0L3CasIZudzCuD+nw==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-x64-gnu": {
      "version": "15.5.18",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-x64-gnu/-/swc-linux-x64-gnu-15.5.18.tgz",
      "integrity": "sha512-oUfg2EgJmU3R0OCOWiokGFUTvZiPfXtriXiuF3YNxRoROCdgvTedHIzYoeKH34gsZxS/V7mHbfq2hpAHwhH1/A==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-linux-x64-musl": {
      "version": "15.5.18",
      "resolved": "https://registry.npmjs.org/@next/swc-linux-x64-musl/-/swc-linux-x64-musl-15.5.18.tgz",
      "integrity": "sha512-JLxSP3KTd9iu/bvUMQxH7RJo9xKSHf55/6RPE4a6FTSZygGn7uvZbCej0AHXydwkggQGSD9UddSjwv6Xz5ESfA==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-win32-arm64-msvc": {
      "version": "15.5.18",
      "resolved": "https://registry.npmjs.org/@next/swc-win32-arm64-msvc/-/swc-win32-arm64-msvc-15.5.18.tgz",
      "integrity": "sha512-ir1v7enP52K2HNz3tQQvwF+x7VNxBk1ciiZ18WBPvxf4C59IqdfmHPJYK3vH7rSxpuCVw/8C712wTXNAtEp+NA==",
      "cpu": [
        "arm64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@next/swc-win32-x64-msvc": {
      "version": "15.5.18",
      "resolved": "https://registry.npmjs.org/@next/swc-win32-x64-msvc/-/swc-win32-x64-msvc-15.5.18.tgz",
      "integrity": "sha512-LIu5me6QTANCd25E7I5uIEfvgQ06RK7tvHAbYo3zCb3VpxQEPvMcSpd87NwUABDT6MbGPdEGR5VRiK4PPTJhQg==",
      "cpu": [
        "x64"
      ],
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 10"
      }
    },
    "node_modules/@nodelib/fs.scandir": {
      "version": "2.1.5",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.stat": "2.0.5",
        "run-parallel": "^1.1.9"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@nodelib/fs.stat": {
      "version": "2.0.5",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@nodelib/fs.walk": {
      "version": "1.2.8",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.scandir": "2.1.5",
        "fastq": "^1.6.0"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/@nolyfill/is-core-module": {
      "version": "1.0.39",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=12.4.0"
      }
    },
    "node_modules/@oxc-project/types": {
      "version": "0.139.0",
      "resolved": "https://registry.npmjs.org/@oxc-project/types/-/types-0.139.0.tgz",
      "integrity": "sha512-r9gHphtCs+1M7J0pw6Sn/hh/Wpa/iQrOOkrNAlVLF/gHq+/CJmHIWKKUUhdWjcD6CIa8idarspCsASiXCXvFUw==",
      "dev": true,
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/Boshen"
      }
    },
    "node_modules/@prisma/client": {
      "version": "5.22.0",
      "hasInstallScript": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">=16.13"
      },
      "peerDependencies": {
        "prisma": "*"
      },
      "peerDependenciesMeta": {
        "prisma": {
          "optional": true
        }
      }
    },
    "node_modules/@prisma/debug": {
      "version": "5.22.0",
      "devOptional": true,
      "license": "Apache-2.0"
    },
    "node_modules/@prisma/engines": {
      "version": "5.22.0",
      "devOptional": true,
      "hasInstallScript": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@prisma/debug": "5.22.0",
        "@prisma/engines-version": "5.22.0-44.605197351a3c8bdd595af2d2a9bc3025bca48ea2",
        "@prisma/fetch-engine": "5.22.0",
        "@prisma/get-platform": "5.22.0"
      }
    },
    "node_modules/@prisma/engines-version": {
      "version": "5.22.0-44.605197351a3c8bdd595af2d2a9bc3025bca48ea2",
      "devOptional": true,
      "license": "Apache-2.0"
    },
    "node_modules/@prisma/fetch-engine": {
      "version": "5.22.0",
      "devOptional": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@prisma/debug": "5.22.0",
        "@prisma/engines-version": "5.22.0-44.605197351a3c8bdd595af2d2a9bc3025bca48ea2",
        "@prisma/get-platform": "5.22.0"
      }
    },
    "node_modules/@prisma/get-platform": {
      "version": "5.22.0",
      "devOptional": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@prisma/debug": "5.22.0"
      }
    },
    "node_modules/@rolldown/binding-android-arm64": {
      "version": "1.1.5",
      "resolved": "https://registry.npmjs.org/@rolldown/binding-android-arm64/-/binding-android-arm64-1.1.5.tgz",
      "integrity": "sha512-lZg8fqIv2v7FF237bwMgzGZEJvGL79/s5knJ/i6FmsGF4XXlzccZ4jb+TrFIxtSSxFtIpdsgrPZeMk1I9AFcyQ==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ],
      "engines": {
        "node": "^20.19.0 || >=22.12.0"
      }
    },
    "node_modules/@rolldown/binding-darwin-arm64": {
      "version": "1.1.5",
      "resolved": "https://registry.npmjs.org/@rolldown/binding-darwin-arm64/-/binding-darwin-arm64-1.1.5.tgz",
      "integrity": "sha512-51Bnx9pNiMRKSUNtBfySkNJ9vMU9Hh3I1ozDd6gyPPYzaXCfnptUcEZxXGYFn+ul2dtcMUiqGR1Yai2K10uoTw==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": "^20.19.0 || >=22.12.0"
      }
    },
    "node_modules/@rolldown/binding-darwin-x64": {
      "version": "1.1.5",
      "resolved": "https://registry.npmjs.org/@rolldown/binding-darwin-x64/-/binding-darwin-x64-1.1.5.tgz",
      "integrity": "sha512-Tm+gbfC0aHu1tBA/JvKQh32S0K6YgCHkiAF4/W6xX0K0RmNuc94VeK419dJoE65R5aRxmo+noZQSWrAMF6yb6g==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": "^20.19.0 || >=22.12.0"
      }
    },
    "node_modules/@rolldown/binding-freebsd-x64": {
      "version": "1.1.5",
      "resolved": "https://registry.npmjs.org/@rolldown/binding-freebsd-x64/-/binding-freebsd-x64-1.1.5.tgz",
      "integrity": "sha512-JMzDKCCXq93YccG5gz3hvOs1oXRKAf0XYpfOS88e+wZrC8Iugj6j68867vrYZkvpDDpKn/KoKORThmchMpF6TA==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "freebsd"
      ],
      "engines": {
        "node": "^20.19.0 || >=22.12.0"
      }
    },
    "node_modules/@rolldown/binding-linux-arm-gnueabihf": {
      "version": "1.1.5",
      "resolved": "https://registry.npmjs.org/@rolldown/binding-linux-arm-gnueabihf/-/binding-linux-arm-gnueabihf-1.1.5.tgz",
      "integrity": "sha512-uML21j2K5TfPGutKxub+M+nLjZIrWjXQ5Grx4lCe/nimTj9B4L63zHpjXLl4y0L3mcm2htEQIb06oCG/szerNw==",
      "cpu": [
        "arm"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": "^20.19.0 || >=22.12.0"
      }
    },
    "node_modules/@rolldown/binding-linux-arm64-gnu": {
      "version": "1.1.5",
      "resolved": "https://registry.npmjs.org/@rolldown/binding-linux-arm64-gnu/-/binding-linux-arm64-gnu-1.1.5.tgz",
      "integrity": "sha512-navSiuTMogvnQoZoM/v+l3ZWo50/NTwSHSzheABx/RCnmUPaKwq9qSo4Br2OYRs21+Fz8uFqITZM3H4opOB0/Q==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": "^20.19.0 || >=22.12.0"
      }
    },
    "node_modules/@rolldown/binding-linux-arm64-musl": {
      "version": "1.1.5",
      "resolved": "https://registry.npmjs.org/@rolldown/binding-linux-arm64-musl/-/binding-linux-arm64-musl-1.1.5.tgz",
      "integrity": "sha512-lAryqH7IteztmCXQXk0etKj4wBQ7Gx5S6LjKhsgp9zb8I5bsuvU/2llH1hDQcjsFeqIsovMVN339/8pUDDBXxA==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": "^20.19.0 || >=22.12.0"
      }
    },
    "node_modules/@rolldown/binding-linux-ppc64-gnu": {
      "version": "1.1.5",
      "resolved": "https://registry.npmjs.org/@rolldown/binding-linux-ppc64-gnu/-/binding-linux-ppc64-gnu-1.1.5.tgz",
      "integrity": "sha512-fsK/sNBnxzBlL4O1JNrZakVQxPspqpED5dLtNsZS9oOKmtSpdNIzxH2kkol5HYTWJN47sE20ztMJPxfZ89qGOg==",
      "cpu": [
        "ppc64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": "^20.19.0 || >=22.12.0"
      }
    },
    "node_modules/@rolldown/binding-linux-s390x-gnu": {
      "version": "1.1.5",
      "resolved": "https://registry.npmjs.org/@rolldown/binding-linux-s390x-gnu/-/binding-linux-s390x-gnu-1.1.5.tgz",
      "integrity": "sha512-gLYb4BIadlfTOYT5gO503n8zQjXflgzpD0FcyKh0Mzx3rqCZKnHoJWV9xe1KXUJ5lx2JfcSHr/mhzS0PC/McAA==",
      "cpu": [
        "s390x"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": "^20.19.0 || >=22.12.0"
      }
    },
    "node_modules/@rolldown/binding-linux-x64-gnu": {
      "version": "1.1.5",
      "resolved": "https://registry.npmjs.org/@rolldown/binding-linux-x64-gnu/-/binding-linux-x64-gnu-1.1.5.tgz",
      "integrity": "sha512-FjcpEKUyJygHgs1o50VYNvkt5+7Le/VEdYt0AkRpkL33MnyQfwr8l5mXwMmfmTbyMPr5vJLC+8/Gd9gXnwU1QQ==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": "^20.19.0 || >=22.12.0"
      }
    },
    "node_modules/@rolldown/binding-linux-x64-musl": {
      "version": "1.1.5",
      "resolved": "https://registry.npmjs.org/@rolldown/binding-linux-x64-musl/-/binding-linux-x64-musl-1.1.5.tgz",
      "integrity": "sha512-Me+PfPI2TMeOQk0gYWfLQZtTktrmzbr8cDboqX83XKc7UrgAi55gF+2dUkWdxd19n55Essp2yeca+O9N5rBxHg==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": "^20.19.0 || >=22.12.0"
      }
    },
    "node_modules/@rolldown/binding-openharmony-arm64": {
      "version": "1.1.5",
      "resolved": "https://registry.npmjs.org/@rolldown/binding-openharmony-arm64/-/binding-openharmony-arm64-1.1.5.tgz",
      "integrity": "sha512-yc5WrLzXks6zCQfn9Oxr8pORKyl/pF+QjHmW/Qx3qu0oyrrNC+y2JLTU1E2rcWYAmzlnqngWXHQjy51VzW70Vw==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "openharmony"
      ],
      "engines": {
        "node": "^20.19.0 || >=22.12.0"
      }
    },
    "node_modules/@rolldown/binding-wasm32-wasi": {
      "version": "1.1.5",
      "resolved": "https://registry.npmjs.org/@rolldown/binding-wasm32-wasi/-/binding-wasm32-wasi-1.1.5.tgz",
      "integrity": "sha512-VbQGPX2b4r48TAMIM2cjgluIM1HYutm4pcTEJsle7iEP7sB1dFqtPLBVbdLAZCxy1txCcPxf4QFf4v8uvltPqA==",
      "cpu": [
        "wasm32"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "@emnapi/core": "1.11.1",
        "@emnapi/runtime": "1.11.1",
        "@napi-rs/wasm-runtime": "^1.1.6"
      },
      "engines": {
        "node": "^20.19.0 || >=22.12.0"
      }
    },
    "node_modules/@rolldown/binding-wasm32-wasi/node_modules/@emnapi/core": {
      "version": "1.11.1",
      "resolved": "https://registry.npmjs.org/@emnapi/core/-/core-1.11.1.tgz",
      "integrity": "sha512-RSvbQmHzdKzNsLYa/wHrbc3KN4sYLKAdPZxqiM2HATqv/SBk2/ENSHpvXGaLOMcsAyz0poEGqkmmKYG3OWiJEQ==",
      "dev": true,
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "@emnapi/wasi-threads": "1.2.2",
        "tslib": "^2.4.0"
      }
    },
    "node_modules/@rolldown/binding-wasm32-wasi/node_modules/@emnapi/runtime": {
      "version": "1.11.1",
      "resolved": "https://registry.npmjs.org/@emnapi/runtime/-/runtime-1.11.1.tgz",
      "integrity": "sha512-vgj7R3y3Wgx24IQaGPA/R6YFXLHVMOZ0uVEyIQPaWs+rd1AzfEMXlAC22FYwO1XkKR6NPsq7mUandH8oIRdZFw==",
      "dev": true,
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "tslib": "^2.4.0"
      }
    },
    "node_modules/@rolldown/binding-wasm32-wasi/node_modules/@emnapi/wasi-threads": {
      "version": "1.2.2",
      "resolved": "https://registry.npmjs.org/@emnapi/wasi-threads/-/wasi-threads-1.2.2.tgz",
      "integrity": "sha512-c95qOXkHdydNKhscBTebqEC1CVAZpyqOfVfBzQ1qgzyl3gfeldUjIggDbIZgDKsHLgnsM+igH7TJ/eAasaVuMA==",
      "dev": true,
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "tslib": "^2.4.0"
      }
    },
    "node_modules/@rolldown/binding-win32-arm64-msvc": {
      "version": "1.1.5",
      "resolved": "https://registry.npmjs.org/@rolldown/binding-win32-arm64-msvc/-/binding-win32-arm64-msvc-1.1.5.tgz",
      "integrity": "sha512-gHv82k63z4qpV5+Q1y/12KrK0ltWBukVDI8nZcbT7Tt/ZlOIVwppazneq0F93oDxTo3IgAMEDIoQh3E2n6mVsw==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": "^20.19.0 || >=22.12.0"
      }
    },
    "node_modules/@rolldown/binding-win32-x64-msvc": {
      "version": "1.1.5",
      "resolved": "https://registry.npmjs.org/@rolldown/binding-win32-x64-msvc/-/binding-win32-x64-msvc-1.1.5.tgz",
      "integrity": "sha512-tTZuDBPw85tEN5PQi1pnEBzDy0Z49HtScLAbD5t6hyeU92A95pRWaSMw1GZZi/RwgSgUIl0xrSlXIT/9QzvYSA==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": "^20.19.0 || >=22.12.0"
      }
    },
    "node_modules/@rolldown/pluginutils": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/@rolldown/pluginutils/-/pluginutils-1.0.1.tgz",
      "integrity": "sha512-2j9bGt5Jh8hj+vPtgzPtl72j0yRxHAyumoo6TNfAjsLB04UtpSvPbPcDcBMxz7n+9CYB0c1GxQFxYRg2jimqGw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@rtsao/scc": {
      "version": "1.1.0",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@rushstack/eslint-patch": {
      "version": "1.16.1",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@standard-schema/spec": {
      "version": "1.1.0",
      "resolved": "https://registry.npmjs.org/@standard-schema/spec/-/spec-1.1.0.tgz",
      "integrity": "sha512-l2aFy5jALhniG5HgqrD6jXLi/rUWrKvqN/qJx6yoJsgKhblVd+iqqU4RCXavm/jPityDo5TCvKMnpjKnOriy0w==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@swc/helpers": {
      "version": "0.5.15",
      "resolved": "https://registry.npmjs.org/@swc/helpers/-/helpers-0.5.15.tgz",
      "integrity": "sha512-JQ5TuMi45Owi4/BIMAJBoSQoOJu12oOk/gADqlcUL9JEdHB8vyjUSsxqeNXnmXHjYKMi2WcYtezGEEhqUI/E2g==",
      "license": "Apache-2.0",
      "dependencies": {
        "tslib": "^2.8.0"
      }
    },
    "node_modules/@tybys/wasm-util": {
      "version": "0.10.3",
      "dev": true,
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "tslib": "^2.4.0"
      }
    },
    "node_modules/@types/chai": {
      "version": "5.2.3",
      "resolved": "https://registry.npmjs.org/@types/chai/-/chai-5.2.3.tgz",
      "integrity": "sha512-Mw558oeA9fFbv65/y4mHtXDs9bPnFMZAL/jxdPFUpOHHIXX91mcgEHbS5Lahr+pwZFR8A7GQleRWeI6cGFC2UA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@types/deep-eql": "*",
        "assertion-error": "^2.0.1"
      }
    },
    "node_modules/@types/deep-eql": {
      "version": "4.0.2",
      "resolved": "https://registry.npmjs.org/@types/deep-eql/-/deep-eql-4.0.2.tgz",
      "integrity": "sha512-c9h9dVVMigMPc4bwTvC5dxqtqJZwQPePsWjPlpSOnojbor6pGqdk541lfA7AqFQr5pB1BRdq0juY9db81BwyFw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@types/estree": {
      "version": "1.0.9",
      "resolved": "https://registry.npmjs.org/@types/estree/-/estree-1.0.9.tgz",
      "integrity": "sha512-GhdPgy1el4/ImP05X05Uw4cw2/M93BCUmnEvWZNStlCzEKME4Fkk+YpoA5OiHNQmoS7Cafb8Xa3Pya8m1Qrzeg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@types/json5": {
      "version": "0.0.29",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@types/node": {
      "version": "22.20.1",
      "resolved": "https://registry.npmjs.org/@types/node/-/node-22.20.1.tgz",
      "integrity": "sha512-EANqOCF9QFyra+4pfxUcX9STKJpCLjMbObVzljIJomAWSnuSIEAvyzEU53GaajbXJEgdh0iEcPL+DGvpUd4k1Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "undici-types": "~6.21.0"
      }
    },
    "node_modules/@types/react": {
      "version": "19.2.17",
      "resolved": "https://registry.npmjs.org/@types/react/-/react-19.2.17.tgz",
      "integrity": "sha512-MXfmqaVPEVgkBT/aY0aGCkRWWtByiYQXo3xdQ8r5RzuFrPiRn8Gar2tQdXSUQ2GKV3bkXckek89V8wQBY2Q/Aw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "csstype": "^3.2.2"
      }
    },
    "node_modules/@types/react-dom": {
      "version": "19.2.3",
      "resolved": "https://registry.npmjs.org/@types/react-dom/-/react-dom-19.2.3.tgz",
      "integrity": "sha512-jp2L/eY6fn+KgVVQAOqYItbF0VY/YApe5Mz2F0aykSO8gx31bYCZyvSeYxCHKvzHG5eZjc+zyaS5BrBWya2+kQ==",
      "dev": true,
      "license": "MIT",
      "peerDependencies": {
        "@types/react": "^19.2.0"
      }
    },
    "node_modules/@typescript-eslint/eslint-plugin": {
      "version": "8.63.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@eslint-community/regexpp": "^4.12.2",
        "@typescript-eslint/scope-manager": "8.63.0",
        "@typescript-eslint/type-utils": "8.63.0",
        "@typescript-eslint/utils": "8.63.0",
        "@typescript-eslint/visitor-keys": "8.63.0",
        "ignore": "^7.0.5",
        "natural-compare": "^1.4.0",
        "ts-api-utils": "^2.5.0"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      },
      "peerDependencies": {
        "@typescript-eslint/parser": "^8.63.0",
        "eslint": "^8.57.0 || ^9.0.0 || ^10.0.0",
        "typescript": ">=4.8.4 <6.1.0"
      }
    },
    "node_modules/@typescript-eslint/eslint-plugin/node_modules/ignore": {
      "version": "7.0.5",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 4"
      }
    },
    "node_modules/@typescript-eslint/parser": {
      "version": "8.63.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@typescript-eslint/scope-manager": "8.63.0",
        "@typescript-eslint/types": "8.63.0",
        "@typescript-eslint/typescript-estree": "8.63.0",
        "@typescript-eslint/visitor-keys": "8.63.0",
        "debug": "^4.4.3"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      },
      "peerDependencies": {
        "eslint": "^8.57.0 || ^9.0.0 || ^10.0.0",
        "typescript": ">=4.8.4 <6.1.0"
      }
    },
    "node_modules/@typescript-eslint/project-service": {
      "version": "8.63.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@typescript-eslint/tsconfig-utils": "^8.63.0",
        "@typescript-eslint/types": "^8.63.0",
        "debug": "^4.4.3"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      },
      "peerDependencies": {
        "typescript": ">=4.8.4 <6.1.0"
      }
    },
    "node_modules/@typescript-eslint/scope-manager": {
      "version": "8.63.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@typescript-eslint/types": "8.63.0",
        "@typescript-eslint/visitor-keys": "8.63.0"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      }
    },
    "node_modules/@typescript-eslint/tsconfig-utils": {
      "version": "8.63.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      },
      "peerDependencies": {
        "typescript": ">=4.8.4 <6.1.0"
      }
    },
    "node_modules/@typescript-eslint/type-utils": {
      "version": "8.63.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@typescript-eslint/types": "8.63.0",
        "@typescript-eslint/typescript-estree": "8.63.0",
        "@typescript-eslint/utils": "8.63.0",
        "debug": "^4.4.3",
        "ts-api-utils": "^2.5.0"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      },
      "peerDependencies": {
        "eslint": "^8.57.0 || ^9.0.0 || ^10.0.0",
        "typescript": ">=4.8.4 <6.1.0"
      }
    },
    "node_modules/@typescript-eslint/types": {
      "version": "8.63.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      }
    },
    "node_modules/@typescript-eslint/typescript-estree": {
      "version": "8.63.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@typescript-eslint/project-service": "8.63.0",
        "@typescript-eslint/tsconfig-utils": "8.63.0",
        "@typescript-eslint/types": "8.63.0",
        "@typescript-eslint/visitor-keys": "8.63.0",
        "debug": "^4.4.3",
        "minimatch": "^10.2.2",
        "semver": "^7.7.3",
        "tinyglobby": "^0.2.15",
        "ts-api-utils": "^2.5.0"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      },
      "peerDependencies": {
        "typescript": ">=4.8.4 <6.1.0"
      }
    },
    "node_modules/@typescript-eslint/typescript-estree/node_modules/balanced-match": {
      "version": "4.0.4",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "18 || 20 || >=22"
      }
    },
    "node_modules/@typescript-eslint/typescript-estree/node_modules/brace-expansion": {
      "version": "5.0.7",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "balanced-match": "^4.0.2"
      },
      "engines": {
        "node": "18 || 20 || >=22"
      }
    },
    "node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch": {
      "version": "10.2.5",
      "dev": true,
      "license": "BlueOak-1.0.0",
      "dependencies": {
        "brace-expansion": "^5.0.5"
      },
      "engines": {
        "node": "18 || 20 || >=22"
      },
      "funding": {
        "url": "https://github.com/sponsors/isaacs"
      }
    },
    "node_modules/@typescript-eslint/utils": {
      "version": "8.63.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@eslint-community/eslint-utils": "^4.9.1",
        "@typescript-eslint/scope-manager": "8.63.0",
        "@typescript-eslint/types": "8.63.0",
        "@typescript-eslint/typescript-estree": "8.63.0"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      },
      "peerDependencies": {
        "eslint": "^8.57.0 || ^9.0.0 || ^10.0.0",
        "typescript": ">=4.8.4 <6.1.0"
      }
    },
    "node_modules/@typescript-eslint/visitor-keys": {
      "version": "8.63.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@typescript-eslint/types": "8.63.0",
        "eslint-visitor-keys": "^5.0.0"
      },
      "engines": {
        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/typescript-eslint"
      }
    },
    "node_modules/@typescript-eslint/visitor-keys/node_modules/eslint-visitor-keys": {
      "version": "5.0.1",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": "^20.19.0 || ^22.13.0 || >=24"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/@ungap/structured-clone": {
      "version": "1.3.2",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/@unrs/resolver-binding-win32-x64-msvc": {
      "version": "1.12.2",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ]
    },
    "node_modules/@vitest/expect": {
      "version": "4.1.10",
      "resolved": "https://registry.npmjs.org/@vitest/expect/-/expect-4.1.10.tgz",
      "integrity": "sha512-YsCn+qAk1GWjQOWFEsEcL2gNQ0zmVmQu3T03qP6UyjhtmdtwtbuI+DASn/7iQB3HGTXkdBwGddzxPlmiql5vlA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@standard-schema/spec": "^1.1.0",
        "@types/chai": "^5.2.2",
        "@vitest/spy": "4.1.10",
        "@vitest/utils": "4.1.10",
        "chai": "^6.2.2",
        "tinyrainbow": "^3.1.0"
      },
      "funding": {
        "url": "https://opencollective.com/vitest"
      }
    },
    "node_modules/@vitest/pretty-format": {
      "version": "4.1.10",
      "resolved": "https://registry.npmjs.org/@vitest/pretty-format/-/pretty-format-4.1.10.tgz",
      "integrity": "sha512-W1HsjSH4MXQ9YfmmhLAoIYf1HRfekQCGngeIgcei6MP5QQGWUe0gkopdZQaVCFO+JDJMrAJGwa5pRpNpvy4P8Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "tinyrainbow": "^3.1.0"
      },
      "funding": {
        "url": "https://opencollective.com/vitest"
      }
    },
    "node_modules/@vitest/runner": {
      "version": "4.1.10",
      "resolved": "https://registry.npmjs.org/@vitest/runner/-/runner-4.1.10.tgz",
      "integrity": "sha512-IKI6kpIH+LmpROplyLwBBaCfMgOZOMsygVa6BARD6ahA04VRuJSa6OaVG7kRvSEMD870Vd91rSSw0eegtWyLGg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@vitest/utils": "4.1.10",
        "pathe": "^2.0.3"
      },
      "funding": {
        "url": "https://opencollective.com/vitest"
      }
    },
    "node_modules/@vitest/snapshot": {
      "version": "4.1.10",
      "resolved": "https://registry.npmjs.org/@vitest/snapshot/-/snapshot-4.1.10.tgz",
      "integrity": "sha512-xRkfOT1qpTAi/Ti4Y1LtfRc3kEuqxGw59eN2jN9pRWMtS/XDevekhcFSqvQqjUNGksfjMJu3Y+oJ+4Ypn2OaJw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@vitest/pretty-format": "4.1.10",
        "@vitest/utils": "4.1.10",
        "magic-string": "^0.30.21",
        "pathe": "^2.0.3"
      },
      "funding": {
        "url": "https://opencollective.com/vitest"
      }
    },
    "node_modules/@vitest/spy": {
      "version": "4.1.10",
      "resolved": "https://registry.npmjs.org/@vitest/spy/-/spy-4.1.10.tgz",
      "integrity": "sha512-PLf/Ugvoq5wO/b4rwYCR1h2PSIdXz7wnkQFMiUpLdtM7l6pqVFcQIBEHyT1+l+cj7mNwAfZHzqXqDyjvOuwbDw==",
      "dev": true,
      "license": "MIT",
      "funding": {
        "url": "https://opencollective.com/vitest"
      }
    },
    "node_modules/@vitest/utils": {
      "version": "4.1.10",
      "resolved": "https://registry.npmjs.org/@vitest/utils/-/utils-4.1.10.tgz",
      "integrity": "sha512-fy9am/HWxbaGt/Sawrp90vt6Y6jQwf1RX77cz3uwoJwJVMli/e1IEwRPnMNJ7vKfPTwo0diXifkpPvwH9v7nGA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@vitest/pretty-format": "4.1.10",
        "convert-source-map": "^2.0.0",
        "tinyrainbow": "^3.1.0"
      },
      "funding": {
        "url": "https://opencollective.com/vitest"
      }
    },
    "node_modules/acorn": {
      "version": "8.17.0",
      "dev": true,
      "license": "MIT",
      "bin": {
        "acorn": "bin/acorn"
      },
      "engines": {
        "node": ">=0.4.0"
      }
    },
    "node_modules/acorn-jsx": {
      "version": "5.3.2",
      "dev": true,
      "license": "MIT",
      "peerDependencies": {
        "acorn": "^6.0.0 || ^7.0.0 || ^8.0.0"
      }
    },
    "node_modules/ajv": {
      "version": "6.15.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "fast-deep-equal": "^3.1.1",
        "fast-json-stable-stringify": "^2.0.0",
        "json-schema-traverse": "^0.4.1",
        "uri-js": "^4.2.2"
      },
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/epoberezkin"
      }
    },
    "node_modules/ansi-regex": {
      "version": "5.0.1",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/ansi-styles": {
      "version": "4.3.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "color-convert": "^2.0.1"
      },
      "engines": {
        "node": ">=8"
      },
      "funding": {
        "url": "https://github.com/chalk/ansi-styles?sponsor=1"
      }
    },
    "node_modules/argparse": {
      "version": "2.0.1",
      "dev": true,
      "license": "Python-2.0"
    },
    "node_modules/aria-query": {
      "version": "5.3.2",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/array-buffer-byte-length": {
      "version": "1.0.2",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.3",
        "is-array-buffer": "^3.0.5"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/array-includes": {
      "version": "3.1.9",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.4",
        "define-properties": "^1.2.1",
        "es-abstract": "^1.24.0",
        "es-object-atoms": "^1.1.1",
        "get-intrinsic": "^1.3.0",
        "is-string": "^1.1.1",
        "math-intrinsics": "^1.1.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/array-includes/node_modules/es-abstract": {
      "version": "1.24.2",
      "resolved": "https://registry.npmjs.org/es-abstract/-/es-abstract-1.24.2.tgz",
      "integrity": "sha512-2FpH9Q5i2RRwyEP1AylXe6nYLR5OhaJTZwmlcP0dL/+JCbgg7yyEo/sEK6HeGZRf3dFpWwThaRHVApXSkW3xeg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "array-buffer-byte-length": "^1.0.2",
        "arraybuffer.prototype.slice": "^1.0.4",
        "available-typed-arrays": "^1.0.7",
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.4",
        "data-view-buffer": "^1.0.2",
        "data-view-byte-length": "^1.0.2",
        "data-view-byte-offset": "^1.0.1",
        "es-define-property": "^1.0.1",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.1.1",
        "es-set-tostringtag": "^2.1.0",
        "es-to-primitive": "^1.3.0",
        "function.prototype.name": "^1.1.8",
        "get-intrinsic": "^1.3.0",
        "get-proto": "^1.0.1",
        "get-symbol-description": "^1.1.0",
        "globalthis": "^1.0.4",
        "gopd": "^1.2.0",
        "has-property-descriptors": "^1.0.2",
        "has-proto": "^1.2.0",
        "has-symbols": "^1.1.0",
        "hasown": "^2.0.2",
        "internal-slot": "^1.1.0",
        "is-array-buffer": "^3.0.5",
        "is-callable": "^1.2.7",
        "is-data-view": "^1.0.2",
        "is-negative-zero": "^2.0.3",
        "is-regex": "^1.2.1",
        "is-set": "^2.0.3",
        "is-shared-array-buffer": "^1.0.4",
        "is-string": "^1.1.1",
        "is-typed-array": "^1.1.15",
        "is-weakref": "^1.1.1",
        "math-intrinsics": "^1.1.0",
        "object-inspect": "^1.13.4",
        "object-keys": "^1.1.1",
        "object.assign": "^4.1.7",
        "own-keys": "^1.0.1",
        "regexp.prototype.flags": "^1.5.4",
        "safe-array-concat": "^1.1.3",
        "safe-push-apply": "^1.0.0",
        "safe-regex-test": "^1.1.0",
        "set-proto": "^1.0.0",
        "stop-iteration-iterator": "^1.1.0",
        "string.prototype.trim": "^1.2.10",
        "string.prototype.trimend": "^1.0.9",
        "string.prototype.trimstart": "^1.0.8",
        "typed-array-buffer": "^1.0.3",
        "typed-array-byte-length": "^1.0.3",
        "typed-array-byte-offset": "^1.0.4",
        "typed-array-length": "^1.0.7",
        "unbox-primitive": "^1.1.0",
        "which-typed-array": "^1.1.19"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/array.prototype.findlast": {
      "version": "1.2.5",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.7",
        "define-properties": "^1.2.1",
        "es-abstract": "^1.23.2",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.0.0",
        "es-shim-unscopables": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/array.prototype.findlast/node_modules/es-abstract": {
      "version": "1.24.2",
      "resolved": "https://registry.npmjs.org/es-abstract/-/es-abstract-1.24.2.tgz",
      "integrity": "sha512-2FpH9Q5i2RRwyEP1AylXe6nYLR5OhaJTZwmlcP0dL/+JCbgg7yyEo/sEK6HeGZRf3dFpWwThaRHVApXSkW3xeg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "array-buffer-byte-length": "^1.0.2",
        "arraybuffer.prototype.slice": "^1.0.4",
        "available-typed-arrays": "^1.0.7",
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.4",
        "data-view-buffer": "^1.0.2",
        "data-view-byte-length": "^1.0.2",
        "data-view-byte-offset": "^1.0.1",
        "es-define-property": "^1.0.1",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.1.1",
        "es-set-tostringtag": "^2.1.0",
        "es-to-primitive": "^1.3.0",
        "function.prototype.name": "^1.1.8",
        "get-intrinsic": "^1.3.0",
        "get-proto": "^1.0.1",
        "get-symbol-description": "^1.1.0",
        "globalthis": "^1.0.4",
        "gopd": "^1.2.0",
        "has-property-descriptors": "^1.0.2",
        "has-proto": "^1.2.0",
        "has-symbols": "^1.1.0",
        "hasown": "^2.0.2",
        "internal-slot": "^1.1.0",
        "is-array-buffer": "^3.0.5",
        "is-callable": "^1.2.7",
        "is-data-view": "^1.0.2",
        "is-negative-zero": "^2.0.3",
        "is-regex": "^1.2.1",
        "is-set": "^2.0.3",
        "is-shared-array-buffer": "^1.0.4",
        "is-string": "^1.1.1",
        "is-typed-array": "^1.1.15",
        "is-weakref": "^1.1.1",
        "math-intrinsics": "^1.1.0",
        "object-inspect": "^1.13.4",
        "object-keys": "^1.1.1",
        "object.assign": "^4.1.7",
        "own-keys": "^1.0.1",
        "regexp.prototype.flags": "^1.5.4",
        "safe-array-concat": "^1.1.3",
        "safe-push-apply": "^1.0.0",
        "safe-regex-test": "^1.1.0",
        "set-proto": "^1.0.0",
        "stop-iteration-iterator": "^1.1.0",
        "string.prototype.trim": "^1.2.10",
        "string.prototype.trimend": "^1.0.9",
        "string.prototype.trimstart": "^1.0.8",
        "typed-array-buffer": "^1.0.3",
        "typed-array-byte-length": "^1.0.3",
        "typed-array-byte-offset": "^1.0.4",
        "typed-array-length": "^1.0.7",
        "unbox-primitive": "^1.1.0",
        "which-typed-array": "^1.1.19"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/array.prototype.findlastindex": {
      "version": "1.2.6",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.4",
        "define-properties": "^1.2.1",
        "es-abstract": "^1.23.9",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.1.1",
        "es-shim-unscopables": "^1.1.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/array.prototype.findlastindex/node_modules/es-abstract": {
      "version": "1.24.2",
      "resolved": "https://registry.npmjs.org/es-abstract/-/es-abstract-1.24.2.tgz",
      "integrity": "sha512-2FpH9Q5i2RRwyEP1AylXe6nYLR5OhaJTZwmlcP0dL/+JCbgg7yyEo/sEK6HeGZRf3dFpWwThaRHVApXSkW3xeg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "array-buffer-byte-length": "^1.0.2",
        "arraybuffer.prototype.slice": "^1.0.4",
        "available-typed-arrays": "^1.0.7",
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.4",
        "data-view-buffer": "^1.0.2",
        "data-view-byte-length": "^1.0.2",
        "data-view-byte-offset": "^1.0.1",
        "es-define-property": "^1.0.1",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.1.1",
        "es-set-tostringtag": "^2.1.0",
        "es-to-primitive": "^1.3.0",
        "function.prototype.name": "^1.1.8",
        "get-intrinsic": "^1.3.0",
        "get-proto": "^1.0.1",
        "get-symbol-description": "^1.1.0",
        "globalthis": "^1.0.4",
        "gopd": "^1.2.0",
        "has-property-descriptors": "^1.0.2",
        "has-proto": "^1.2.0",
        "has-symbols": "^1.1.0",
        "hasown": "^2.0.2",
        "internal-slot": "^1.1.0",
        "is-array-buffer": "^3.0.5",
        "is-callable": "^1.2.7",
        "is-data-view": "^1.0.2",
        "is-negative-zero": "^2.0.3",
        "is-regex": "^1.2.1",
        "is-set": "^2.0.3",
        "is-shared-array-buffer": "^1.0.4",
        "is-string": "^1.1.1",
        "is-typed-array": "^1.1.15",
        "is-weakref": "^1.1.1",
        "math-intrinsics": "^1.1.0",
        "object-inspect": "^1.13.4",
        "object-keys": "^1.1.1",
        "object.assign": "^4.1.7",
        "own-keys": "^1.0.1",
        "regexp.prototype.flags": "^1.5.4",
        "safe-array-concat": "^1.1.3",
        "safe-push-apply": "^1.0.0",
        "safe-regex-test": "^1.1.0",
        "set-proto": "^1.0.0",
        "stop-iteration-iterator": "^1.1.0",
        "string.prototype.trim": "^1.2.10",
        "string.prototype.trimend": "^1.0.9",
        "string.prototype.trimstart": "^1.0.8",
        "typed-array-buffer": "^1.0.3",
        "typed-array-byte-length": "^1.0.3",
        "typed-array-byte-offset": "^1.0.4",
        "typed-array-length": "^1.0.7",
        "unbox-primitive": "^1.1.0",
        "which-typed-array": "^1.1.19"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/array.prototype.flat": {
      "version": "1.3.3",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "define-properties": "^1.2.1",
        "es-abstract": "^1.23.5",
        "es-shim-unscopables": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/array.prototype.flat/node_modules/es-abstract": {
      "version": "1.24.2",
      "resolved": "https://registry.npmjs.org/es-abstract/-/es-abstract-1.24.2.tgz",
      "integrity": "sha512-2FpH9Q5i2RRwyEP1AylXe6nYLR5OhaJTZwmlcP0dL/+JCbgg7yyEo/sEK6HeGZRf3dFpWwThaRHVApXSkW3xeg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "array-buffer-byte-length": "^1.0.2",
        "arraybuffer.prototype.slice": "^1.0.4",
        "available-typed-arrays": "^1.0.7",
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.4",
        "data-view-buffer": "^1.0.2",
        "data-view-byte-length": "^1.0.2",
        "data-view-byte-offset": "^1.0.1",
        "es-define-property": "^1.0.1",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.1.1",
        "es-set-tostringtag": "^2.1.0",
        "es-to-primitive": "^1.3.0",
        "function.prototype.name": "^1.1.8",
        "get-intrinsic": "^1.3.0",
        "get-proto": "^1.0.1",
        "get-symbol-description": "^1.1.0",
        "globalthis": "^1.0.4",
        "gopd": "^1.2.0",
        "has-property-descriptors": "^1.0.2",
        "has-proto": "^1.2.0",
        "has-symbols": "^1.1.0",
        "hasown": "^2.0.2",
        "internal-slot": "^1.1.0",
        "is-array-buffer": "^3.0.5",
        "is-callable": "^1.2.7",
        "is-data-view": "^1.0.2",
        "is-negative-zero": "^2.0.3",
        "is-regex": "^1.2.1",
        "is-set": "^2.0.3",
        "is-shared-array-buffer": "^1.0.4",
        "is-string": "^1.1.1",
        "is-typed-array": "^1.1.15",
        "is-weakref": "^1.1.1",
        "math-intrinsics": "^1.1.0",
        "object-inspect": "^1.13.4",
        "object-keys": "^1.1.1",
        "object.assign": "^4.1.7",
        "own-keys": "^1.0.1",
        "regexp.prototype.flags": "^1.5.4",
        "safe-array-concat": "^1.1.3",
        "safe-push-apply": "^1.0.0",
        "safe-regex-test": "^1.1.0",
        "set-proto": "^1.0.0",
        "stop-iteration-iterator": "^1.1.0",
        "string.prototype.trim": "^1.2.10",
        "string.prototype.trimend": "^1.0.9",
        "string.prototype.trimstart": "^1.0.8",
        "typed-array-buffer": "^1.0.3",
        "typed-array-byte-length": "^1.0.3",
        "typed-array-byte-offset": "^1.0.4",
        "typed-array-length": "^1.0.7",
        "unbox-primitive": "^1.1.0",
        "which-typed-array": "^1.1.19"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/array.prototype.flatmap": {
      "version": "1.3.3",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "define-properties": "^1.2.1",
        "es-abstract": "^1.23.5",
        "es-shim-unscopables": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/array.prototype.flatmap/node_modules/es-abstract": {
      "version": "1.24.2",
      "resolved": "https://registry.npmjs.org/es-abstract/-/es-abstract-1.24.2.tgz",
      "integrity": "sha512-2FpH9Q5i2RRwyEP1AylXe6nYLR5OhaJTZwmlcP0dL/+JCbgg7yyEo/sEK6HeGZRf3dFpWwThaRHVApXSkW3xeg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "array-buffer-byte-length": "^1.0.2",
        "arraybuffer.prototype.slice": "^1.0.4",
        "available-typed-arrays": "^1.0.7",
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.4",
        "data-view-buffer": "^1.0.2",
        "data-view-byte-length": "^1.0.2",
        "data-view-byte-offset": "^1.0.1",
        "es-define-property": "^1.0.1",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.1.1",
        "es-set-tostringtag": "^2.1.0",
        "es-to-primitive": "^1.3.0",
        "function.prototype.name": "^1.1.8",
        "get-intrinsic": "^1.3.0",
        "get-proto": "^1.0.1",
        "get-symbol-description": "^1.1.0",
        "globalthis": "^1.0.4",
        "gopd": "^1.2.0",
        "has-property-descriptors": "^1.0.2",
        "has-proto": "^1.2.0",
        "has-symbols": "^1.1.0",
        "hasown": "^2.0.2",
        "internal-slot": "^1.1.0",
        "is-array-buffer": "^3.0.5",
        "is-callable": "^1.2.7",
        "is-data-view": "^1.0.2",
        "is-negative-zero": "^2.0.3",
        "is-regex": "^1.2.1",
        "is-set": "^2.0.3",
        "is-shared-array-buffer": "^1.0.4",
        "is-string": "^1.1.1",
        "is-typed-array": "^1.1.15",
        "is-weakref": "^1.1.1",
        "math-intrinsics": "^1.1.0",
        "object-inspect": "^1.13.4",
        "object-keys": "^1.1.1",
        "object.assign": "^4.1.7",
        "own-keys": "^1.0.1",
        "regexp.prototype.flags": "^1.5.4",
        "safe-array-concat": "^1.1.3",
        "safe-push-apply": "^1.0.0",
        "safe-regex-test": "^1.1.0",
        "set-proto": "^1.0.0",
        "stop-iteration-iterator": "^1.1.0",
        "string.prototype.trim": "^1.2.10",
        "string.prototype.trimend": "^1.0.9",
        "string.prototype.trimstart": "^1.0.8",
        "typed-array-buffer": "^1.0.3",
        "typed-array-byte-length": "^1.0.3",
        "typed-array-byte-offset": "^1.0.4",
        "typed-array-length": "^1.0.7",
        "unbox-primitive": "^1.1.0",
        "which-typed-array": "^1.1.19"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/array.prototype.tosorted": {
      "version": "1.1.4",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.7",
        "define-properties": "^1.2.1",
        "es-abstract": "^1.23.3",
        "es-errors": "^1.3.0",
        "es-shim-unscopables": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/array.prototype.tosorted/node_modules/es-abstract": {
      "version": "1.24.2",
      "resolved": "https://registry.npmjs.org/es-abstract/-/es-abstract-1.24.2.tgz",
      "integrity": "sha512-2FpH9Q5i2RRwyEP1AylXe6nYLR5OhaJTZwmlcP0dL/+JCbgg7yyEo/sEK6HeGZRf3dFpWwThaRHVApXSkW3xeg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "array-buffer-byte-length": "^1.0.2",
        "arraybuffer.prototype.slice": "^1.0.4",
        "available-typed-arrays": "^1.0.7",
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.4",
        "data-view-buffer": "^1.0.2",
        "data-view-byte-length": "^1.0.2",
        "data-view-byte-offset": "^1.0.1",
        "es-define-property": "^1.0.1",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.1.1",
        "es-set-tostringtag": "^2.1.0",
        "es-to-primitive": "^1.3.0",
        "function.prototype.name": "^1.1.8",
        "get-intrinsic": "^1.3.0",
        "get-proto": "^1.0.1",
        "get-symbol-description": "^1.1.0",
        "globalthis": "^1.0.4",
        "gopd": "^1.2.0",
        "has-property-descriptors": "^1.0.2",
        "has-proto": "^1.2.0",
        "has-symbols": "^1.1.0",
        "hasown": "^2.0.2",
        "internal-slot": "^1.1.0",
        "is-array-buffer": "^3.0.5",
        "is-callable": "^1.2.7",
        "is-data-view": "^1.0.2",
        "is-negative-zero": "^2.0.3",
        "is-regex": "^1.2.1",
        "is-set": "^2.0.3",
        "is-shared-array-buffer": "^1.0.4",
        "is-string": "^1.1.1",
        "is-typed-array": "^1.1.15",
        "is-weakref": "^1.1.1",
        "math-intrinsics": "^1.1.0",
        "object-inspect": "^1.13.4",
        "object-keys": "^1.1.1",
        "object.assign": "^4.1.7",
        "own-keys": "^1.0.1",
        "regexp.prototype.flags": "^1.5.4",
        "safe-array-concat": "^1.1.3",
        "safe-push-apply": "^1.0.0",
        "safe-regex-test": "^1.1.0",
        "set-proto": "^1.0.0",
        "stop-iteration-iterator": "^1.1.0",
        "string.prototype.trim": "^1.2.10",
        "string.prototype.trimend": "^1.0.9",
        "string.prototype.trimstart": "^1.0.8",
        "typed-array-buffer": "^1.0.3",
        "typed-array-byte-length": "^1.0.3",
        "typed-array-byte-offset": "^1.0.4",
        "typed-array-length": "^1.0.7",
        "unbox-primitive": "^1.1.0",
        "which-typed-array": "^1.1.19"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/arraybuffer.prototype.slice": {
      "version": "1.0.4",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "array-buffer-byte-length": "^1.0.1",
        "call-bind": "^1.0.8",
        "define-properties": "^1.2.1",
        "es-abstract": "^1.23.5",
        "es-errors": "^1.3.0",
        "get-intrinsic": "^1.2.6",
        "is-array-buffer": "^3.0.4"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/arraybuffer.prototype.slice/node_modules/es-abstract": {
      "version": "1.24.2",
      "resolved": "https://registry.npmjs.org/es-abstract/-/es-abstract-1.24.2.tgz",
      "integrity": "sha512-2FpH9Q5i2RRwyEP1AylXe6nYLR5OhaJTZwmlcP0dL/+JCbgg7yyEo/sEK6HeGZRf3dFpWwThaRHVApXSkW3xeg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "array-buffer-byte-length": "^1.0.2",
        "arraybuffer.prototype.slice": "^1.0.4",
        "available-typed-arrays": "^1.0.7",
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.4",
        "data-view-buffer": "^1.0.2",
        "data-view-byte-length": "^1.0.2",
        "data-view-byte-offset": "^1.0.1",
        "es-define-property": "^1.0.1",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.1.1",
        "es-set-tostringtag": "^2.1.0",
        "es-to-primitive": "^1.3.0",
        "function.prototype.name": "^1.1.8",
        "get-intrinsic": "^1.3.0",
        "get-proto": "^1.0.1",
        "get-symbol-description": "^1.1.0",
        "globalthis": "^1.0.4",
        "gopd": "^1.2.0",
        "has-property-descriptors": "^1.0.2",
        "has-proto": "^1.2.0",
        "has-symbols": "^1.1.0",
        "hasown": "^2.0.2",
        "internal-slot": "^1.1.0",
        "is-array-buffer": "^3.0.5",
        "is-callable": "^1.2.7",
        "is-data-view": "^1.0.2",
        "is-negative-zero": "^2.0.3",
        "is-regex": "^1.2.1",
        "is-set": "^2.0.3",
        "is-shared-array-buffer": "^1.0.4",
        "is-string": "^1.1.1",
        "is-typed-array": "^1.1.15",
        "is-weakref": "^1.1.1",
        "math-intrinsics": "^1.1.0",
        "object-inspect": "^1.13.4",
        "object-keys": "^1.1.1",
        "object.assign": "^4.1.7",
        "own-keys": "^1.0.1",
        "regexp.prototype.flags": "^1.5.4",
        "safe-array-concat": "^1.1.3",
        "safe-push-apply": "^1.0.0",
        "safe-regex-test": "^1.1.0",
        "set-proto": "^1.0.0",
        "stop-iteration-iterator": "^1.1.0",
        "string.prototype.trim": "^1.2.10",
        "string.prototype.trimend": "^1.0.9",
        "string.prototype.trimstart": "^1.0.8",
        "typed-array-buffer": "^1.0.3",
        "typed-array-byte-length": "^1.0.3",
        "typed-array-byte-offset": "^1.0.4",
        "typed-array-length": "^1.0.7",
        "unbox-primitive": "^1.1.0",
        "which-typed-array": "^1.1.19"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/assertion-error": {
      "version": "2.0.1",
      "resolved": "https://registry.npmjs.org/assertion-error/-/assertion-error-2.0.1.tgz",
      "integrity": "sha512-Izi8RQcffqCeNVgFigKli1ssklIbpHnCYc6AknXGYoB6grJqyeby7jv12JUQgmTAnIDnbck1uxksT4dzN3PWBA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=12"
      }
    },
    "node_modules/ast-types-flow": {
      "version": "0.0.8",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/async-function": {
      "version": "1.0.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/available-typed-arrays": {
      "version": "1.0.7",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "possible-typed-array-names": "^1.0.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/axe-core": {
      "version": "4.12.1",
      "dev": true,
      "license": "MPL-2.0",
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/axobject-query": {
      "version": "4.1.0",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/balanced-match": {
      "version": "1.0.2",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/brace-expansion": {
      "version": "1.1.16",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "balanced-match": "^1.0.0",
        "concat-map": "0.0.1"
      }
    },
    "node_modules/braces": {
      "version": "3.0.3",
      "resolved": "https://registry.npmjs.org/braces/-/braces-3.0.3.tgz",
      "integrity": "sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "fill-range": "^7.1.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/call-bind": {
      "version": "1.0.9",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind-apply-helpers": "^1.0.2",
        "es-define-property": "^1.0.1",
        "get-intrinsic": "^1.3.0",
        "set-function-length": "^1.2.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/call-bind-apply-helpers": {
      "version": "1.0.2",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0",
        "function-bind": "^1.1.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/call-bound": {
      "version": "1.0.4",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind-apply-helpers": "^1.0.2",
        "get-intrinsic": "^1.3.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/callsites": {
      "version": "3.1.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/caniuse-lite": {
      "version": "1.0.30001803",
      "resolved": "https://registry.npmjs.org/caniuse-lite/-/caniuse-lite-1.0.30001803.tgz",
      "integrity": "sha512-g/uHREV2ZpK9qMalCsWaxmA6ol+DX8GYhuf3T40RKoP+oL7vhRJh8LNt73PCjpnR6l14FzfPrB5Yux4PKm2meg==",
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/browserslist"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/caniuse-lite"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "CC-BY-4.0"
    },
    "node_modules/chai": {
      "version": "6.2.2",
      "resolved": "https://registry.npmjs.org/chai/-/chai-6.2.2.tgz",
      "integrity": "sha512-NUPRluOfOiTKBKvWPtSD4PhFvWCqOi0BGStNWs57X9js7XGTprSmFoz5F0tWhR4WPjNeR9jXqdC7/UpSJTnlRg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/chalk": {
      "version": "4.1.2",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-styles": "^4.1.0",
        "supports-color": "^7.1.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/chalk/chalk?sponsor=1"
      }
    },
    "node_modules/client-only": {
      "version": "0.0.1",
      "resolved": "https://registry.npmjs.org/client-only/-/client-only-0.0.1.tgz",
      "integrity": "sha512-IV3Ou0jSMzZrd3pZ48nLkT9DA7Ag1pnPzaiQhpW7c3RbcqqzvzzVu+L8gfqMp/8IM2MQtSiqaCxrrcfu8I8rMA==",
      "license": "MIT"
    },
    "node_modules/color-convert": {
      "version": "2.0.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "color-name": "~1.1.4"
      },
      "engines": {
        "node": ">=7.0.0"
      }
    },
    "node_modules/color-name": {
      "version": "1.1.4",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/concat-map": {
      "version": "0.0.1",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/convert-source-map": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/convert-source-map/-/convert-source-map-2.0.0.tgz",
      "integrity": "sha512-Kvp459HrV2FEJ1CAsi1Ku+MY3kasH19TFykTz2xWmMeq6bk2NU3XXvfJ+Q61m0xktWwt+1HSYf3JZsTms3aRJg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/cross-spawn": {
      "version": "7.0.6",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "path-key": "^3.1.0",
        "shebang-command": "^2.0.0",
        "which": "^2.0.1"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/csstype": {
      "version": "3.2.3",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/damerau-levenshtein": {
      "version": "1.0.8",
      "dev": true,
      "license": "BSD-2-Clause"
    },
    "node_modules/data-view-buffer": {
      "version": "1.0.2",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.3",
        "es-errors": "^1.3.0",
        "is-data-view": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/data-view-byte-length": {
      "version": "1.0.2",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.3",
        "es-errors": "^1.3.0",
        "is-data-view": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/inspect-js"
      }
    },
    "node_modules/data-view-byte-offset": {
      "version": "1.0.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.2",
        "es-errors": "^1.3.0",
        "is-data-view": "^1.0.1"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/debug": {
      "version": "4.4.3",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ms": "^2.1.3"
      },
      "engines": {
        "node": ">=6.0"
      },
      "peerDependenciesMeta": {
        "supports-color": {
          "optional": true
        }
      }
    },
    "node_modules/deep-is": {
      "version": "0.1.4",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/define-data-property": {
      "version": "1.1.4",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-define-property": "^1.0.0",
        "es-errors": "^1.3.0",
        "gopd": "^1.0.1"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/define-properties": {
      "version": "1.2.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "define-data-property": "^1.0.1",
        "has-property-descriptors": "^1.0.0",
        "object-keys": "^1.1.1"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/detect-libc": {
      "version": "2.1.2",
      "resolved": "https://registry.npmjs.org/detect-libc/-/detect-libc-2.1.2.tgz",
      "integrity": "sha512-Btj2BOOO83o3WyH59e8MgXsxEQVcarkUOpEYrubB0urwnN10yQ364rsiByU11nZlqWYZm05i/of7io4mzihBtQ==",
      "devOptional": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/doctrine": {
      "version": "3.0.0",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "esutils": "^2.0.2"
      },
      "engines": {
        "node": ">=6.0.0"
      }
    },
    "node_modules/dunder-proto": {
      "version": "1.0.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind-apply-helpers": "^1.0.1",
        "es-errors": "^1.3.0",
        "gopd": "^1.2.0"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/emoji-regex": {
      "version": "9.2.2",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/es-abstract-get": {
      "version": "1.0.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.1.2",
        "is-callable": "^1.2.7",
        "object-inspect": "^1.13.4"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/es-define-property": {
      "version": "1.0.1",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/es-errors": {
      "version": "1.3.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/es-iterator-helpers": {
      "version": "1.3.3",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.9",
        "call-bound": "^1.0.4",
        "define-properties": "^1.2.1",
        "es-abstract": "^1.24.2",
        "es-errors": "^1.3.0",
        "es-set-tostringtag": "^2.1.0",
        "function-bind": "^1.1.2",
        "get-intrinsic": "^1.3.0",
        "globalthis": "^1.0.4",
        "gopd": "^1.2.0",
        "has-property-descriptors": "^1.0.2",
        "has-proto": "^1.2.0",
        "has-symbols": "^1.1.0",
        "internal-slot": "^1.1.0",
        "iterator.prototype": "^1.1.5",
        "math-intrinsics": "^1.1.0"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/es-iterator-helpers/node_modules/es-abstract": {
      "version": "1.24.2",
      "resolved": "https://registry.npmjs.org/es-abstract/-/es-abstract-1.24.2.tgz",
      "integrity": "sha512-2FpH9Q5i2RRwyEP1AylXe6nYLR5OhaJTZwmlcP0dL/+JCbgg7yyEo/sEK6HeGZRf3dFpWwThaRHVApXSkW3xeg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "array-buffer-byte-length": "^1.0.2",
        "arraybuffer.prototype.slice": "^1.0.4",
        "available-typed-arrays": "^1.0.7",
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.4",
        "data-view-buffer": "^1.0.2",
        "data-view-byte-length": "^1.0.2",
        "data-view-byte-offset": "^1.0.1",
        "es-define-property": "^1.0.1",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.1.1",
        "es-set-tostringtag": "^2.1.0",
        "es-to-primitive": "^1.3.0",
        "function.prototype.name": "^1.1.8",
        "get-intrinsic": "^1.3.0",
        "get-proto": "^1.0.1",
        "get-symbol-description": "^1.1.0",
        "globalthis": "^1.0.4",
        "gopd": "^1.2.0",
        "has-property-descriptors": "^1.0.2",
        "has-proto": "^1.2.0",
        "has-symbols": "^1.1.0",
        "hasown": "^2.0.2",
        "internal-slot": "^1.1.0",
        "is-array-buffer": "^3.0.5",
        "is-callable": "^1.2.7",
        "is-data-view": "^1.0.2",
        "is-negative-zero": "^2.0.3",
        "is-regex": "^1.2.1",
        "is-set": "^2.0.3",
        "is-shared-array-buffer": "^1.0.4",
        "is-string": "^1.1.1",
        "is-typed-array": "^1.1.15",
        "is-weakref": "^1.1.1",
        "math-intrinsics": "^1.1.0",
        "object-inspect": "^1.13.4",
        "object-keys": "^1.1.1",
        "object.assign": "^4.1.7",
        "own-keys": "^1.0.1",
        "regexp.prototype.flags": "^1.5.4",
        "safe-array-concat": "^1.1.3",
        "safe-push-apply": "^1.0.0",
        "safe-regex-test": "^1.1.0",
        "set-proto": "^1.0.0",
        "stop-iteration-iterator": "^1.1.0",
        "string.prototype.trim": "^1.2.10",
        "string.prototype.trimend": "^1.0.9",
        "string.prototype.trimstart": "^1.0.8",
        "typed-array-buffer": "^1.0.3",
        "typed-array-byte-length": "^1.0.3",
        "typed-array-byte-offset": "^1.0.4",
        "typed-array-length": "^1.0.7",
        "unbox-primitive": "^1.1.0",
        "which-typed-array": "^1.1.19"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/es-module-lexer": {
      "version": "2.3.0",
      "resolved": "https://registry.npmjs.org/es-module-lexer/-/es-module-lexer-2.3.0.tgz",
      "integrity": "sha512-KLdwQm2NvGLDkQDCGvmiQrhkd0JbMzXthwQAUgWjQuQdBLFa3eiBP5arXZyA+f8x+x7OXgud6bq2rxjGtHV2tw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/es-object-atoms": {
      "version": "1.1.2",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/es-set-tostringtag": {
      "version": "2.1.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0",
        "get-intrinsic": "^1.2.6",
        "has-tostringtag": "^1.0.2",
        "hasown": "^2.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/es-shim-unscopables": {
      "version": "1.1.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "hasown": "^2.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/es-to-primitive": {
      "version": "1.3.4",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-abstract-get": "^1.0.0",
        "es-define-property": "^1.0.1",
        "es-errors": "^1.3.0",
        "is-callable": "^1.2.7",
        "is-date-object": "^1.1.0",
        "is-symbol": "^1.1.1"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/escape-string-regexp": {
      "version": "4.0.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/eslint": {
      "version": "8.57.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@eslint-community/eslint-utils": "^4.2.0",
        "@eslint-community/regexpp": "^4.6.1",
        "@eslint/eslintrc": "^2.1.4",
        "@eslint/js": "8.57.1",
        "@humanwhocodes/config-array": "^0.13.0",
        "@humanwhocodes/module-importer": "^1.0.1",
        "@nodelib/fs.walk": "^1.2.8",
        "@ungap/structured-clone": "^1.2.0",
        "ajv": "^6.12.4",
        "chalk": "^4.0.0",
        "cross-spawn": "^7.0.2",
        "debug": "^4.3.2",
        "doctrine": "^3.0.0",
        "escape-string-regexp": "^4.0.0",
        "eslint-scope": "^7.2.2",
        "eslint-visitor-keys": "^3.4.3",
        "espree": "^9.6.1",
        "esquery": "^1.4.2",
        "esutils": "^2.0.2",
        "fast-deep-equal": "^3.1.3",
        "file-entry-cache": "^6.0.1",
        "find-up": "^5.0.0",
        "glob-parent": "^6.0.2",
        "globals": "^13.19.0",
        "graphemer": "^1.4.0",
        "ignore": "^5.2.0",
        "imurmurhash": "^0.1.4",
        "is-glob": "^4.0.0",
        "is-path-inside": "^3.0.3",
        "js-yaml": "^4.1.0",
        "json-stable-stringify-without-jsonify": "^1.0.1",
        "levn": "^0.4.1",
        "lodash.merge": "^4.6.2",
        "minimatch": "^3.1.2",
        "natural-compare": "^1.4.0",
        "optionator": "^0.9.3",
        "strip-ansi": "^6.0.1",
        "text-table": "^0.2.0"
      },
      "bin": {
        "eslint": "bin/eslint.js"
      },
      "engines": {
        "node": "^12.22.0 || ^14.17.0 || >=16.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/eslint-config-next": {
      "version": "15.5.18",
      "resolved": "https://registry.npmjs.org/eslint-config-next/-/eslint-config-next-15.5.18.tgz",
      "integrity": "sha512-HuoJU6uUPD00eyiud78IBnT4HLhztFj2V+ild2Uon5ZUrYZKe0Olu2QRD99e9IgL4/H1eg5Onka3BsfRW2U0Xw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@next/eslint-plugin-next": "15.5.18",
        "@rushstack/eslint-patch": "^1.10.3",
        "@typescript-eslint/eslint-plugin": "^5.4.2 || ^6.0.0 || ^7.0.0 || ^8.0.0",
        "@typescript-eslint/parser": "^5.4.2 || ^6.0.0 || ^7.0.0 || ^8.0.0",
        "eslint-import-resolver-node": "^0.3.6",
        "eslint-import-resolver-typescript": "^3.5.2",
        "eslint-plugin-import": "^2.31.0",
        "eslint-plugin-jsx-a11y": "^6.10.0",
        "eslint-plugin-react": "^7.37.0",
        "eslint-plugin-react-hooks": "^5.0.0"
      },
      "peerDependencies": {
        "eslint": "^7.23.0 || ^8.0.0 || ^9.0.0",
        "typescript": ">=3.3.1"
      },
      "peerDependenciesMeta": {
        "typescript": {
          "optional": true
        }
      }
    },
    "node_modules/eslint-import-resolver-node": {
      "version": "0.3.10",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "debug": "^3.2.7",
        "is-core-module": "^2.16.1",
        "resolve": "^2.0.0-next.6"
      }
    },
    "node_modules/eslint-import-resolver-node/node_modules/debug": {
      "version": "3.2.7",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ms": "^2.1.1"
      }
    },
    "node_modules/eslint-import-resolver-typescript": {
      "version": "3.10.1",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "@nolyfill/is-core-module": "1.0.39",
        "debug": "^4.4.0",
        "get-tsconfig": "^4.10.0",
        "is-bun-module": "^2.0.0",
        "stable-hash": "^0.0.5",
        "tinyglobby": "^0.2.13",
        "unrs-resolver": "^1.6.2"
      },
      "engines": {
        "node": "^14.18.0 || >=16.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint-import-resolver-typescript"
      },
      "peerDependencies": {
        "eslint": "*",
        "eslint-plugin-import": "*",
        "eslint-plugin-import-x": "*"
      },
      "peerDependenciesMeta": {
        "eslint-plugin-import": {
          "optional": true
        },
        "eslint-plugin-import-x": {
          "optional": true
        }
      }
    },
    "node_modules/eslint-module-utils": {
      "version": "2.14.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "debug": "^3.2.7"
      },
      "engines": {
        "node": ">=4"
      },
      "peerDependenciesMeta": {
        "eslint": {
          "optional": true
        }
      }
    },
    "node_modules/eslint-module-utils/node_modules/debug": {
      "version": "3.2.7",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ms": "^2.1.1"
      }
    },
    "node_modules/eslint-plugin-import": {
      "version": "2.32.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@rtsao/scc": "^1.1.0",
        "array-includes": "^3.1.9",
        "array.prototype.findlastindex": "^1.2.6",
        "array.prototype.flat": "^1.3.3",
        "array.prototype.flatmap": "^1.3.3",
        "debug": "^3.2.7",
        "doctrine": "^2.1.0",
        "eslint-import-resolver-node": "^0.3.9",
        "eslint-module-utils": "^2.12.1",
        "hasown": "^2.0.2",
        "is-core-module": "^2.16.1",
        "is-glob": "^4.0.3",
        "minimatch": "^3.1.2",
        "object.fromentries": "^2.0.8",
        "object.groupby": "^1.0.3",
        "object.values": "^1.2.1",
        "semver": "^6.3.1",
        "string.prototype.trimend": "^1.0.9",
        "tsconfig-paths": "^3.15.0"
      },
      "engines": {
        "node": ">=4"
      },
      "peerDependencies": {
        "eslint": "^2 || ^3 || ^4 || ^5 || ^6 || ^7.2.0 || ^8 || ^9"
      }
    },
    "node_modules/eslint-plugin-import/node_modules/debug": {
      "version": "3.2.7",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ms": "^2.1.1"
      }
    },
    "node_modules/eslint-plugin-import/node_modules/doctrine": {
      "version": "2.1.0",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "esutils": "^2.0.2"
      },
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/eslint-plugin-import/node_modules/semver": {
      "version": "6.3.1",
      "dev": true,
      "license": "ISC",
      "bin": {
        "semver": "bin/semver.js"
      }
    },
    "node_modules/eslint-plugin-jsx-a11y": {
      "version": "6.10.2",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "aria-query": "^5.3.2",
        "array-includes": "^3.1.8",
        "array.prototype.flatmap": "^1.3.2",
        "ast-types-flow": "^0.0.8",
        "axe-core": "^4.10.0",
        "axobject-query": "^4.1.0",
        "damerau-levenshtein": "^1.0.8",
        "emoji-regex": "^9.2.2",
        "hasown": "^2.0.2",
        "jsx-ast-utils": "^3.3.5",
        "language-tags": "^1.0.9",
        "minimatch": "^3.1.2",
        "object.fromentries": "^2.0.8",
        "safe-regex-test": "^1.0.3",
        "string.prototype.includes": "^2.0.1"
      },
      "engines": {
        "node": ">=4.0"
      },
      "peerDependencies": {
        "eslint": "^3 || ^4 || ^5 || ^6 || ^7 || ^8 || ^9"
      }
    },
    "node_modules/eslint-plugin-react": {
      "version": "7.37.5",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "array-includes": "^3.1.8",
        "array.prototype.findlast": "^1.2.5",
        "array.prototype.flatmap": "^1.3.3",
        "array.prototype.tosorted": "^1.1.4",
        "doctrine": "^2.1.0",
        "es-iterator-helpers": "^1.2.1",
        "estraverse": "^5.3.0",
        "hasown": "^2.0.2",
        "jsx-ast-utils": "^2.4.1 || ^3.0.0",
        "minimatch": "^3.1.2",
        "object.entries": "^1.1.9",
        "object.fromentries": "^2.0.8",
        "object.values": "^1.2.1",
        "prop-types": "^15.8.1",
        "resolve": "^2.0.0-next.5",
        "semver": "^6.3.1",
        "string.prototype.matchall": "^4.0.12",
        "string.prototype.repeat": "^1.0.0"
      },
      "engines": {
        "node": ">=4"
      },
      "peerDependencies": {
        "eslint": "^3 || ^4 || ^5 || ^6 || ^7 || ^8 || ^9.7"
      }
    },
    "node_modules/eslint-plugin-react-hooks": {
      "version": "5.2.0",
      "resolved": "https://registry.npmjs.org/eslint-plugin-react-hooks/-/eslint-plugin-react-hooks-5.2.0.tgz",
      "integrity": "sha512-+f15FfK64YQwZdJNELETdn5ibXEUQmW1DZL6KXhNnc2heoy/sg9VJJeT7n8TlMWouzWqSWavFkIhHyIbIAEapg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "peerDependencies": {
        "eslint": "^3.0.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0-0 || ^9.0.0"
      }
    },
    "node_modules/eslint-plugin-react/node_modules/doctrine": {
      "version": "2.1.0",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "esutils": "^2.0.2"
      },
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/eslint-plugin-react/node_modules/semver": {
      "version": "6.3.1",
      "dev": true,
      "license": "ISC",
      "bin": {
        "semver": "bin/semver.js"
      }
    },
    "node_modules/eslint-scope": {
      "version": "7.2.2",
      "dev": true,
      "license": "BSD-2-Clause",
      "dependencies": {
        "esrecurse": "^4.3.0",
        "estraverse": "^5.2.0"
      },
      "engines": {
        "node": "^12.22.0 || ^14.17.0 || >=16.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/eslint-visitor-keys": {
      "version": "3.4.3",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": "^12.22.0 || ^14.17.0 || >=16.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/espree": {
      "version": "9.6.1",
      "dev": true,
      "license": "BSD-2-Clause",
      "dependencies": {
        "acorn": "^8.9.0",
        "acorn-jsx": "^5.3.2",
        "eslint-visitor-keys": "^3.4.1"
      },
      "engines": {
        "node": "^12.22.0 || ^14.17.0 || >=16.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/esquery": {
      "version": "1.7.0",
      "dev": true,
      "license": "BSD-3-Clause",
      "dependencies": {
        "estraverse": "^5.1.0"
      },
      "engines": {
        "node": ">=0.10"
      }
    },
    "node_modules/esrecurse": {
      "version": "4.3.0",
      "dev": true,
      "license": "BSD-2-Clause",
      "dependencies": {
        "estraverse": "^5.2.0"
      },
      "engines": {
        "node": ">=4.0"
      }
    },
    "node_modules/estraverse": {
      "version": "5.3.0",
      "dev": true,
      "license": "BSD-2-Clause",
      "engines": {
        "node": ">=4.0"
      }
    },
    "node_modules/estree-walker": {
      "version": "3.0.3",
      "resolved": "https://registry.npmjs.org/estree-walker/-/estree-walker-3.0.3.tgz",
      "integrity": "sha512-7RUKfXgSMMkzt6ZuXmqapOurLGPPfgj6l9uRZ7lRGolvk0y2yocc35LdcxKC5PQZdn2DMqioAQ2NoWcrTKmm6g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@types/estree": "^1.0.0"
      }
    },
    "node_modules/esutils": {
      "version": "2.0.3",
      "dev": true,
      "license": "BSD-2-Clause",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/expect-type": {
      "version": "1.4.0",
      "resolved": "https://registry.npmjs.org/expect-type/-/expect-type-1.4.0.tgz",
      "integrity": "sha512-KfYbmpRm0VbLjEvVa9yGwCi9GI34xvi7A/HXYWQO65CSD2u3MczUJSuwXKFIxlGsgBQizV9q5J9NHj4VG0n+pA==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">=12.0.0"
      }
    },
    "node_modules/fast-deep-equal": {
      "version": "3.1.3",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/fast-glob": {
      "version": "3.3.1",
      "resolved": "https://registry.npmjs.org/fast-glob/-/fast-glob-3.3.1.tgz",
      "integrity": "sha512-kNFPyjhh5cKjrUltxs+wFx+ZkbRaxxmZ+X0ZU31SOsxCEtP9VPgtq2teZw1DebupL5GmDaNQ6yKMMVcM41iqDg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@nodelib/fs.stat": "^2.0.2",
        "@nodelib/fs.walk": "^1.2.3",
        "glob-parent": "^5.1.2",
        "merge2": "^1.3.0",
        "micromatch": "^4.0.4"
      },
      "engines": {
        "node": ">=8.6.0"
      }
    },
    "node_modules/fast-glob/node_modules/glob-parent": {
      "version": "5.1.2",
      "resolved": "https://registry.npmjs.org/glob-parent/-/glob-parent-5.1.2.tgz",
      "integrity": "sha512-AOIgSQCepiJYwP3ARnGx+5VnTu2HBYdzbGP45eLw1vr3zB3vZLeyed1sC9hnbcOc9/SrMyM5RPQrkGz4aS9Zow==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "is-glob": "^4.0.1"
      },
      "engines": {
        "node": ">= 6"
      }
    },
    "node_modules/fast-json-stable-stringify": {
      "version": "2.1.0",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/fast-levenshtein": {
      "version": "2.0.6",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/fastq": {
      "version": "1.20.1",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "reusify": "^1.0.4"
      }
    },
    "node_modules/fdir": {
      "version": "6.5.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=12.0.0"
      },
      "peerDependencies": {
        "picomatch": "^3 || ^4"
      },
      "peerDependenciesMeta": {
        "picomatch": {
          "optional": true
        }
      }
    },
    "node_modules/file-entry-cache": {
      "version": "6.0.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "flat-cache": "^3.0.4"
      },
      "engines": {
        "node": "^10.12.0 || >=12.0.0"
      }
    },
    "node_modules/fill-range": {
      "version": "7.1.1",
      "resolved": "https://registry.npmjs.org/fill-range/-/fill-range-7.1.1.tgz",
      "integrity": "sha512-YsGpe3WHLK8ZYi4tWDg2Jy3ebRz2rXowDxnld4bkQB00cc/1Zw9AWnC0i9ztDJitivtQvaI9KaLyKrc+hBW0yg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "to-regex-range": "^5.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/find-up": {
      "version": "5.0.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "locate-path": "^6.0.0",
        "path-exists": "^4.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/flat-cache": {
      "version": "3.2.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "flatted": "^3.2.9",
        "keyv": "^4.5.3",
        "rimraf": "^3.0.2"
      },
      "engines": {
        "node": "^10.12.0 || >=12.0.0"
      }
    },
    "node_modules/flatted": {
      "version": "3.4.2",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/for-each": {
      "version": "0.3.5",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-callable": "^1.2.7"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/fs.realpath": {
      "version": "1.0.0",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/fsevents": {
      "version": "2.3.3",
      "resolved": "https://registry.npmjs.org/fsevents/-/fsevents-2.3.3.tgz",
      "integrity": "sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw==",
      "dev": true,
      "hasInstallScript": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": "^8.16.0 || ^10.6.0 || >=11.0.0"
      }
    },
    "node_modules/function-bind": {
      "version": "1.1.2",
      "dev": true,
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/function.prototype.name": {
      "version": "1.2.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.9",
        "call-bound": "^1.0.4",
        "es-define-property": "^1.0.1",
        "es-errors": "^1.3.0",
        "functions-have-names": "^1.2.3",
        "has-property-descriptors": "^1.0.2",
        "hasown": "^2.0.4",
        "is-callable": "^1.2.7",
        "is-document.all": "^1.0.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/functions-have-names": {
      "version": "1.2.3",
      "dev": true,
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/generator-function": {
      "version": "2.0.1",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/get-intrinsic": {
      "version": "1.3.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind-apply-helpers": "^1.0.2",
        "es-define-property": "^1.0.1",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.1.1",
        "function-bind": "^1.1.2",
        "get-proto": "^1.0.1",
        "gopd": "^1.2.0",
        "has-symbols": "^1.1.0",
        "hasown": "^2.0.2",
        "math-intrinsics": "^1.1.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/get-proto": {
      "version": "1.0.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "dunder-proto": "^1.0.1",
        "es-object-atoms": "^1.0.0"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/get-symbol-description": {
      "version": "1.1.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.3",
        "es-errors": "^1.3.0",
        "get-intrinsic": "^1.2.6"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/get-tsconfig": {
      "version": "4.14.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "resolve-pkg-maps": "^1.0.0"
      },
      "funding": {
        "url": "https://github.com/privatenumber/get-tsconfig?sponsor=1"
      }
    },
    "node_modules/glob-parent": {
      "version": "6.0.2",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "is-glob": "^4.0.3"
      },
      "engines": {
        "node": ">=10.13.0"
      }
    },
    "node_modules/globals": {
      "version": "13.24.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "type-fest": "^0.20.2"
      },
      "engines": {
        "node": ">=8"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/globalthis": {
      "version": "1.0.4",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "define-properties": "^1.2.1",
        "gopd": "^1.0.1"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/gopd": {
      "version": "1.2.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/graphemer": {
      "version": "1.4.0",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/has-bigints": {
      "version": "1.1.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/has-flag": {
      "version": "4.0.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/has-property-descriptors": {
      "version": "1.0.2",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-define-property": "^1.0.0"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/has-proto": {
      "version": "1.2.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "dunder-proto": "^1.0.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/has-symbols": {
      "version": "1.1.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/has-tostringtag": {
      "version": "1.0.2",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "has-symbols": "^1.0.3"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/hasown": {
      "version": "2.0.4",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "function-bind": "^1.1.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/ignore": {
      "version": "5.3.2",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 4"
      }
    },
    "node_modules/import-fresh": {
      "version": "3.3.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "parent-module": "^1.0.0",
        "resolve-from": "^4.0.0"
      },
      "engines": {
        "node": ">=6"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/imurmurhash": {
      "version": "0.1.4",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.8.19"
      }
    },
    "node_modules/inflight": {
      "version": "1.0.6",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "once": "^1.3.0",
        "wrappy": "1"
      }
    },
    "node_modules/inherits": {
      "version": "2.0.4",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/internal-slot": {
      "version": "1.1.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0",
        "hasown": "^2.0.2",
        "side-channel": "^1.1.0"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/is-array-buffer": {
      "version": "3.0.5",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.3",
        "get-intrinsic": "^1.2.6"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-async-function": {
      "version": "2.1.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "async-function": "^1.0.0",
        "call-bound": "^1.0.3",
        "get-proto": "^1.0.1",
        "has-tostringtag": "^1.0.2",
        "safe-regex-test": "^1.1.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-bigint": {
      "version": "1.1.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "has-bigints": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-boolean-object": {
      "version": "1.2.2",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.3",
        "has-tostringtag": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-bun-module": {
      "version": "2.0.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "semver": "^7.7.1"
      }
    },
    "node_modules/is-callable": {
      "version": "1.2.7",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-core-module": {
      "version": "2.16.2",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "hasown": "^2.0.3"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-data-view": {
      "version": "1.0.2",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.2",
        "get-intrinsic": "^1.2.6",
        "is-typed-array": "^1.1.13"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-date-object": {
      "version": "1.1.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.2",
        "has-tostringtag": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-document.all": {
      "version": "1.0.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.4"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-extglob": {
      "version": "2.1.1",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/is-finalizationregistry": {
      "version": "1.1.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.3"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-generator-function": {
      "version": "1.1.2",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.4",
        "generator-function": "^2.0.0",
        "get-proto": "^1.0.1",
        "has-tostringtag": "^1.0.2",
        "safe-regex-test": "^1.1.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-glob": {
      "version": "4.0.3",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-extglob": "^2.1.1"
      },
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/is-map": {
      "version": "2.0.3",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-negative-zero": {
      "version": "2.0.3",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-number": {
      "version": "7.0.0",
      "resolved": "https://registry.npmjs.org/is-number/-/is-number-7.0.0.tgz",
      "integrity": "sha512-41Cifkg6e8TylSpdtTpeLVMqvSBEVzTttHvERD741+pnZ8ANv0004MRL43QKPDlK9cGvNp6NZWZUBlbGXYxxng==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.12.0"
      }
    },
    "node_modules/is-number-object": {
      "version": "1.1.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.3",
        "has-tostringtag": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-path-inside": {
      "version": "3.0.3",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/is-regex": {
      "version": "1.2.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.2",
        "gopd": "^1.2.0",
        "has-tostringtag": "^1.0.2",
        "hasown": "^2.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-set": {
      "version": "2.0.3",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-shared-array-buffer": {
      "version": "1.0.4",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.3"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-string": {
      "version": "1.1.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.3",
        "has-tostringtag": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-symbol": {
      "version": "1.1.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.2",
        "has-symbols": "^1.1.0",
        "safe-regex-test": "^1.1.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-typed-array": {
      "version": "1.1.15",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "which-typed-array": "^1.1.16"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-weakmap": {
      "version": "2.0.2",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-weakref": {
      "version": "1.1.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.3"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/is-weakset": {
      "version": "2.0.4",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.3",
        "get-intrinsic": "^1.2.6"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/isarray": {
      "version": "2.0.5",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/isexe": {
      "version": "2.0.0",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/iterator.prototype": {
      "version": "1.1.5",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "define-data-property": "^1.1.4",
        "es-object-atoms": "^1.0.0",
        "get-intrinsic": "^1.2.6",
        "get-proto": "^1.0.0",
        "has-symbols": "^1.1.0",
        "set-function-name": "^2.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/js-tokens": {
      "version": "4.0.0",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/js-yaml": {
      "version": "4.3.0",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/puzrin"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/nodeca"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "argparse": "^2.0.1"
      },
      "bin": {
        "js-yaml": "bin/js-yaml.js"
      }
    },
    "node_modules/json-buffer": {
      "version": "3.0.1",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/json-schema-traverse": {
      "version": "0.4.1",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/json-stable-stringify-without-jsonify": {
      "version": "1.0.1",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/json5": {
      "version": "1.0.2",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "minimist": "^1.2.0"
      },
      "bin": {
        "json5": "lib/cli.js"
      }
    },
    "node_modules/jsx-ast-utils": {
      "version": "3.3.5",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "array-includes": "^3.1.6",
        "array.prototype.flat": "^1.3.1",
        "object.assign": "^4.1.4",
        "object.values": "^1.1.6"
      },
      "engines": {
        "node": ">=4.0"
      }
    },
    "node_modules/keyv": {
      "version": "4.5.4",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "json-buffer": "3.0.1"
      }
    },
    "node_modules/language-subtag-registry": {
      "version": "0.3.23",
      "dev": true,
      "license": "CC0-1.0"
    },
    "node_modules/language-tags": {
      "version": "1.0.9",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "language-subtag-registry": "^0.3.20"
      },
      "engines": {
        "node": ">=0.10"
      }
    },
    "node_modules/levn": {
      "version": "0.4.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "prelude-ls": "^1.2.1",
        "type-check": "~0.4.0"
      },
      "engines": {
        "node": ">= 0.8.0"
      }
    },
    "node_modules/lightningcss": {
      "version": "1.32.0",
      "resolved": "https://registry.npmjs.org/lightningcss/-/lightningcss-1.32.0.tgz",
      "integrity": "sha512-NXYBzinNrblfraPGyrbPoD19C1h9lfI/1mzgWYvXUTe414Gz/X1FD2XBZSZM7rRTrMA8JL3OtAaGifrIKhQ5yQ==",
      "dev": true,
      "license": "MPL-2.0",
      "dependencies": {
        "detect-libc": "^2.0.3"
      },
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      },
      "optionalDependencies": {
        "lightningcss-android-arm64": "1.32.0",
        "lightningcss-darwin-arm64": "1.32.0",
        "lightningcss-darwin-x64": "1.32.0",
        "lightningcss-freebsd-x64": "1.32.0",
        "lightningcss-linux-arm-gnueabihf": "1.32.0",
        "lightningcss-linux-arm64-gnu": "1.32.0",
        "lightningcss-linux-arm64-musl": "1.32.0",
        "lightningcss-linux-x64-gnu": "1.32.0",
        "lightningcss-linux-x64-musl": "1.32.0",
        "lightningcss-win32-arm64-msvc": "1.32.0",
        "lightningcss-win32-x64-msvc": "1.32.0"
      }
    },
    "node_modules/lightningcss-android-arm64": {
      "version": "1.32.0",
      "resolved": "https://registry.npmjs.org/lightningcss-android-arm64/-/lightningcss-android-arm64-1.32.0.tgz",
      "integrity": "sha512-YK7/ClTt4kAK0vo6w3X+Pnm0D2cf2vPHbhOXdoNti1Ga0al1P4TBZhwjATvjNwLEBCnKvjJc2jQgHXH0NEwlAg==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "android"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-darwin-arm64": {
      "version": "1.32.0",
      "resolved": "https://registry.npmjs.org/lightningcss-darwin-arm64/-/lightningcss-darwin-arm64-1.32.0.tgz",
      "integrity": "sha512-RzeG9Ju5bag2Bv1/lwlVJvBE3q6TtXskdZLLCyfg5pt+HLz9BqlICO7LZM7VHNTTn/5PRhHFBSjk5lc4cmscPQ==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-darwin-x64": {
      "version": "1.32.0",
      "resolved": "https://registry.npmjs.org/lightningcss-darwin-x64/-/lightningcss-darwin-x64-1.32.0.tgz",
      "integrity": "sha512-U+QsBp2m/s2wqpUYT/6wnlagdZbtZdndSmut/NJqlCcMLTWp5muCrID+K5UJ6jqD2BFshejCYXniPDbNh73V8w==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "darwin"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-freebsd-x64": {
      "version": "1.32.0",
      "resolved": "https://registry.npmjs.org/lightningcss-freebsd-x64/-/lightningcss-freebsd-x64-1.32.0.tgz",
      "integrity": "sha512-JCTigedEksZk3tHTTthnMdVfGf61Fky8Ji2E4YjUTEQX14xiy/lTzXnu1vwiZe3bYe0q+SpsSH/CTeDXK6WHig==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "freebsd"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-linux-arm-gnueabihf": {
      "version": "1.32.0",
      "resolved": "https://registry.npmjs.org/lightningcss-linux-arm-gnueabihf/-/lightningcss-linux-arm-gnueabihf-1.32.0.tgz",
      "integrity": "sha512-x6rnnpRa2GL0zQOkt6rts3YDPzduLpWvwAF6EMhXFVZXD4tPrBkEFqzGowzCsIWsPjqSK+tyNEODUBXeeVHSkw==",
      "cpu": [
        "arm"
      ],
      "dev": true,
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-linux-arm64-gnu": {
      "version": "1.32.0",
      "resolved": "https://registry.npmjs.org/lightningcss-linux-arm64-gnu/-/lightningcss-linux-arm64-gnu-1.32.0.tgz",
      "integrity": "sha512-0nnMyoyOLRJXfbMOilaSRcLH3Jw5z9HDNGfT/gwCPgaDjnx0i8w7vBzFLFR1f6CMLKF8gVbebmkUN3fa/kQJpQ==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-linux-arm64-musl": {
      "version": "1.32.0",
      "resolved": "https://registry.npmjs.org/lightningcss-linux-arm64-musl/-/lightningcss-linux-arm64-musl-1.32.0.tgz",
      "integrity": "sha512-UpQkoenr4UJEzgVIYpI80lDFvRmPVg6oqboNHfoH4CQIfNA+HOrZ7Mo7KZP02dC6LjghPQJeBsvXhJod/wnIBg==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-linux-x64-gnu": {
      "version": "1.32.0",
      "resolved": "https://registry.npmjs.org/lightningcss-linux-x64-gnu/-/lightningcss-linux-x64-gnu-1.32.0.tgz",
      "integrity": "sha512-V7Qr52IhZmdKPVr+Vtw8o+WLsQJYCTd8loIfpDaMRWGUZfBOYEJeyJIkqGIDMZPwPx24pUMfwSxxI8phr/MbOA==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-linux-x64-musl": {
      "version": "1.32.0",
      "resolved": "https://registry.npmjs.org/lightningcss-linux-x64-musl/-/lightningcss-linux-x64-musl-1.32.0.tgz",
      "integrity": "sha512-bYcLp+Vb0awsiXg/80uCRezCYHNg1/l3mt0gzHnWV9XP1W5sKa5/TCdGWaR/zBM2PeF/HbsQv/j2URNOiVuxWg==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "linux"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-win32-arm64-msvc": {
      "version": "1.32.0",
      "resolved": "https://registry.npmjs.org/lightningcss-win32-arm64-msvc/-/lightningcss-win32-arm64-msvc-1.32.0.tgz",
      "integrity": "sha512-8SbC8BR40pS6baCM8sbtYDSwEVQd4JlFTOlaD3gWGHfThTcABnNDBda6eTZeqbofalIJhFx0qKzgHJmcPTnGdw==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/lightningcss-win32-x64-msvc": {
      "version": "1.32.0",
      "resolved": "https://registry.npmjs.org/lightningcss-win32-x64-msvc/-/lightningcss-win32-x64-msvc-1.32.0.tgz",
      "integrity": "sha512-Amq9B/SoZYdDi1kFrojnoqPLxYhQ4Wo5XiL8EVJrVsB8ARoC1PWW6VGtT0WKCemjy8aC+louJnjS7U18x3b06Q==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MPL-2.0",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">= 12.0.0"
      },
      "funding": {
        "type": "opencollective",
        "url": "https://opencollective.com/parcel"
      }
    },
    "node_modules/locate-path": {
      "version": "6.0.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "p-locate": "^5.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/lodash.merge": {
      "version": "4.6.2",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/loose-envify": {
      "version": "1.4.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "js-tokens": "^3.0.0 || ^4.0.0"
      },
      "bin": {
        "loose-envify": "cli.js"
      }
    },
    "node_modules/lucide-react": {
      "version": "0.468.0",
      "resolved": "https://registry.npmjs.org/lucide-react/-/lucide-react-0.468.0.tgz",
      "integrity": "sha512-6koYRhnM2N0GGZIdXzSeiNwguv1gt/FAjZOiPl76roBi3xKEXa4WmfpxgQwTTL4KipXjefrnf3oV4IsYhi4JFA==",
      "license": "ISC",
      "peerDependencies": {
        "react": "^16.5.1 || ^17.0.0 || ^18.0.0 || ^19.0.0-rc"
      }
    },
    "node_modules/magic-string": {
      "version": "0.30.21",
      "resolved": "https://registry.npmjs.org/magic-string/-/magic-string-0.30.21.tgz",
      "integrity": "sha512-vd2F4YUyEXKGcLHoq+TEyCjxueSeHnFxyyjNp80yg0XV4vUhnDer/lvvlqM/arB5bXQN5K2/3oinyCRyx8T2CQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@jridgewell/sourcemap-codec": "^1.5.5"
      }
    },
    "node_modules/math-intrinsics": {
      "version": "1.1.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/merge2": {
      "version": "1.4.1",
      "resolved": "https://registry.npmjs.org/merge2/-/merge2-1.4.1.tgz",
      "integrity": "sha512-8q7VEgMJW4J8tcfVPy8g09NcQwZdbwFEqhe/WZkoIzjn/3TGDwtOCYtXGxA3O8tPzpczCCDgv+P2P5y00ZJOOg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/micromatch": {
      "version": "4.0.8",
      "resolved": "https://registry.npmjs.org/micromatch/-/micromatch-4.0.8.tgz",
      "integrity": "sha512-PXwfBhYu0hBCPw8Dn0E+WDYb7af3dSLVWKi3HGv84IdF4TyFoC0ysxFd0Goxw7nSv4T/PzEJQxsYsEiFCKo2BA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "braces": "^3.0.3",
        "picomatch": "^2.3.1"
      },
      "engines": {
        "node": ">=8.6"
      }
    },
    "node_modules/micromatch/node_modules/picomatch": {
      "version": "2.3.2",
      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-2.3.2.tgz",
      "integrity": "sha512-V7+vQEJ06Z+c5tSye8S+nHUfI51xoXIXjHQ99cQtKUkQqqO1kO/KCJUfZXuB47h/YBlDhah2H3hdUGXn8ie0oA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8.6"
      },
      "funding": {
        "url": "https://github.com/sponsors/jonschlinkert"
      }
    },
    "node_modules/minimatch": {
      "version": "3.1.5",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "brace-expansion": "^1.1.7"
      },
      "engines": {
        "node": "*"
      }
    },
    "node_modules/minimist": {
      "version": "1.2.8",
      "dev": true,
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/ms": {
      "version": "2.1.3",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/nanoid": {
      "version": "3.3.15",
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "bin": {
        "nanoid": "bin/nanoid.cjs"
      },
      "engines": {
        "node": "^10 || ^12 || ^13.7 || ^14 || >=15.0.1"
      }
    },
    "node_modules/napi-postinstall": {
      "version": "0.3.4",
      "dev": true,
      "license": "MIT",
      "bin": {
        "napi-postinstall": "lib/cli.js"
      },
      "engines": {
        "node": "^12.20.0 || ^14.18.0 || >=16.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/napi-postinstall"
      }
    },
    "node_modules/natural-compare": {
      "version": "1.4.0",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/next": {
      "version": "15.5.18",
      "resolved": "https://registry.npmjs.org/next/-/next-15.5.18.tgz",
      "integrity": "sha512-eKL8zUJkX9Y5lE+RX/2YJoItVdGlIscyVyboeD9wSpp0PaGqjoA4tTpT2qPqz9ax+5IzGESyLSeZ/RCwbSZ2uQ==",
      "license": "MIT",
      "dependencies": {
        "@next/env": "15.5.18",
        "@swc/helpers": "0.5.15",
        "caniuse-lite": "^1.0.30001579",
        "postcss": "8.4.31",
        "styled-jsx": "5.1.6"
      },
      "bin": {
        "next": "dist/bin/next"
      },
      "engines": {
        "node": "^18.18.0 || ^19.8.0 || >= 20.0.0"
      },
      "optionalDependencies": {
        "@next/swc-darwin-arm64": "15.5.18",
        "@next/swc-darwin-x64": "15.5.18",
        "@next/swc-linux-arm64-gnu": "15.5.18",
        "@next/swc-linux-arm64-musl": "15.5.18",
        "@next/swc-linux-x64-gnu": "15.5.18",
        "@next/swc-linux-x64-musl": "15.5.18",
        "@next/swc-win32-arm64-msvc": "15.5.18",
        "@next/swc-win32-x64-msvc": "15.5.18",
        "sharp": "^0.34.3"
      },
      "peerDependencies": {
        "@opentelemetry/api": "^1.1.0",
        "@playwright/test": "^1.51.1",
        "babel-plugin-react-compiler": "*",
        "react": "^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0",
        "react-dom": "^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0",
        "sass": "^1.3.0"
      },
      "peerDependenciesMeta": {
        "@opentelemetry/api": {
          "optional": true
        },
        "@playwright/test": {
          "optional": true
        },
        "babel-plugin-react-compiler": {
          "optional": true
        },
        "sass": {
          "optional": true
        }
      }
    },
    "node_modules/node-exports-info": {
      "version": "1.6.2",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "array.prototype.flatmap": "^1.3.3",
        "es-errors": "^1.3.0",
        "object.entries": "^1.1.9",
        "semver": "^6.3.1"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/node-exports-info/node_modules/semver": {
      "version": "6.3.1",
      "dev": true,
      "license": "ISC",
      "bin": {
        "semver": "bin/semver.js"
      }
    },
    "node_modules/object-assign": {
      "version": "4.1.1",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/object-inspect": {
      "version": "1.13.4",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/object-keys": {
      "version": "1.1.1",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/object.assign": {
      "version": "4.1.7",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.3",
        "define-properties": "^1.2.1",
        "es-object-atoms": "^1.0.0",
        "has-symbols": "^1.1.0",
        "object-keys": "^1.1.1"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/object.entries": {
      "version": "1.1.9",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.4",
        "define-properties": "^1.2.1",
        "es-object-atoms": "^1.1.1"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/object.fromentries": {
      "version": "2.0.8",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.7",
        "define-properties": "^1.2.1",
        "es-abstract": "^1.23.2",
        "es-object-atoms": "^1.0.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/object.fromentries/node_modules/es-abstract": {
      "version": "1.24.2",
      "resolved": "https://registry.npmjs.org/es-abstract/-/es-abstract-1.24.2.tgz",
      "integrity": "sha512-2FpH9Q5i2RRwyEP1AylXe6nYLR5OhaJTZwmlcP0dL/+JCbgg7yyEo/sEK6HeGZRf3dFpWwThaRHVApXSkW3xeg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "array-buffer-byte-length": "^1.0.2",
        "arraybuffer.prototype.slice": "^1.0.4",
        "available-typed-arrays": "^1.0.7",
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.4",
        "data-view-buffer": "^1.0.2",
        "data-view-byte-length": "^1.0.2",
        "data-view-byte-offset": "^1.0.1",
        "es-define-property": "^1.0.1",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.1.1",
        "es-set-tostringtag": "^2.1.0",
        "es-to-primitive": "^1.3.0",
        "function.prototype.name": "^1.1.8",
        "get-intrinsic": "^1.3.0",
        "get-proto": "^1.0.1",
        "get-symbol-description": "^1.1.0",
        "globalthis": "^1.0.4",
        "gopd": "^1.2.0",
        "has-property-descriptors": "^1.0.2",
        "has-proto": "^1.2.0",
        "has-symbols": "^1.1.0",
        "hasown": "^2.0.2",
        "internal-slot": "^1.1.0",
        "is-array-buffer": "^3.0.5",
        "is-callable": "^1.2.7",
        "is-data-view": "^1.0.2",
        "is-negative-zero": "^2.0.3",
        "is-regex": "^1.2.1",
        "is-set": "^2.0.3",
        "is-shared-array-buffer": "^1.0.4",
        "is-string": "^1.1.1",
        "is-typed-array": "^1.1.15",
        "is-weakref": "^1.1.1",
        "math-intrinsics": "^1.1.0",
        "object-inspect": "^1.13.4",
        "object-keys": "^1.1.1",
        "object.assign": "^4.1.7",
        "own-keys": "^1.0.1",
        "regexp.prototype.flags": "^1.5.4",
        "safe-array-concat": "^1.1.3",
        "safe-push-apply": "^1.0.0",
        "safe-regex-test": "^1.1.0",
        "set-proto": "^1.0.0",
        "stop-iteration-iterator": "^1.1.0",
        "string.prototype.trim": "^1.2.10",
        "string.prototype.trimend": "^1.0.9",
        "string.prototype.trimstart": "^1.0.8",
        "typed-array-buffer": "^1.0.3",
        "typed-array-byte-length": "^1.0.3",
        "typed-array-byte-offset": "^1.0.4",
        "typed-array-length": "^1.0.7",
        "unbox-primitive": "^1.1.0",
        "which-typed-array": "^1.1.19"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/object.groupby": {
      "version": "1.0.3",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.7",
        "define-properties": "^1.2.1",
        "es-abstract": "^1.23.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/object.groupby/node_modules/es-abstract": {
      "version": "1.24.2",
      "resolved": "https://registry.npmjs.org/es-abstract/-/es-abstract-1.24.2.tgz",
      "integrity": "sha512-2FpH9Q5i2RRwyEP1AylXe6nYLR5OhaJTZwmlcP0dL/+JCbgg7yyEo/sEK6HeGZRf3dFpWwThaRHVApXSkW3xeg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "array-buffer-byte-length": "^1.0.2",
        "arraybuffer.prototype.slice": "^1.0.4",
        "available-typed-arrays": "^1.0.7",
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.4",
        "data-view-buffer": "^1.0.2",
        "data-view-byte-length": "^1.0.2",
        "data-view-byte-offset": "^1.0.1",
        "es-define-property": "^1.0.1",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.1.1",
        "es-set-tostringtag": "^2.1.0",
        "es-to-primitive": "^1.3.0",
        "function.prototype.name": "^1.1.8",
        "get-intrinsic": "^1.3.0",
        "get-proto": "^1.0.1",
        "get-symbol-description": "^1.1.0",
        "globalthis": "^1.0.4",
        "gopd": "^1.2.0",
        "has-property-descriptors": "^1.0.2",
        "has-proto": "^1.2.0",
        "has-symbols": "^1.1.0",
        "hasown": "^2.0.2",
        "internal-slot": "^1.1.0",
        "is-array-buffer": "^3.0.5",
        "is-callable": "^1.2.7",
        "is-data-view": "^1.0.2",
        "is-negative-zero": "^2.0.3",
        "is-regex": "^1.2.1",
        "is-set": "^2.0.3",
        "is-shared-array-buffer": "^1.0.4",
        "is-string": "^1.1.1",
        "is-typed-array": "^1.1.15",
        "is-weakref": "^1.1.1",
        "math-intrinsics": "^1.1.0",
        "object-inspect": "^1.13.4",
        "object-keys": "^1.1.1",
        "object.assign": "^4.1.7",
        "own-keys": "^1.0.1",
        "regexp.prototype.flags": "^1.5.4",
        "safe-array-concat": "^1.1.3",
        "safe-push-apply": "^1.0.0",
        "safe-regex-test": "^1.1.0",
        "set-proto": "^1.0.0",
        "stop-iteration-iterator": "^1.1.0",
        "string.prototype.trim": "^1.2.10",
        "string.prototype.trimend": "^1.0.9",
        "string.prototype.trimstart": "^1.0.8",
        "typed-array-buffer": "^1.0.3",
        "typed-array-byte-length": "^1.0.3",
        "typed-array-byte-offset": "^1.0.4",
        "typed-array-length": "^1.0.7",
        "unbox-primitive": "^1.1.0",
        "which-typed-array": "^1.1.19"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/object.values": {
      "version": "1.2.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.3",
        "define-properties": "^1.2.1",
        "es-object-atoms": "^1.0.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/obug": {
      "version": "2.1.3",
      "resolved": "https://registry.npmjs.org/obug/-/obug-2.1.3.tgz",
      "integrity": "sha512-9miFgM2OFba7hB+pRgvtV84pYTBaoTHohvmIgiRt6dRIzbwEOIaNaP+dIlGs2fNFoB0SeISs0Jz5WFVRid6Xyg==",
      "dev": true,
      "funding": [
        "https://github.com/sponsors/sxzz",
        "https://opencollective.com/debug"
      ],
      "license": "MIT",
      "engines": {
        "node": ">=12.20.0"
      }
    },
    "node_modules/once": {
      "version": "1.4.0",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "wrappy": "1"
      }
    },
    "node_modules/optionator": {
      "version": "0.9.4",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "deep-is": "^0.1.3",
        "fast-levenshtein": "^2.0.6",
        "levn": "^0.4.1",
        "prelude-ls": "^1.2.1",
        "type-check": "^0.4.0",
        "word-wrap": "^1.2.5"
      },
      "engines": {
        "node": ">= 0.8.0"
      }
    },
    "node_modules/own-keys": {
      "version": "1.0.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "get-intrinsic": "^1.2.6",
        "object-keys": "^1.1.1",
        "safe-push-apply": "^1.0.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/p-limit": {
      "version": "3.1.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "yocto-queue": "^0.1.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/p-locate": {
      "version": "5.0.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "p-limit": "^3.0.2"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/parent-module": {
      "version": "1.0.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "callsites": "^3.0.0"
      },
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/path-exists": {
      "version": "4.0.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/path-is-absolute": {
      "version": "1.0.1",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/path-key": {
      "version": "3.1.1",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/path-parse": {
      "version": "1.0.7",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/pathe": {
      "version": "2.0.3",
      "resolved": "https://registry.npmjs.org/pathe/-/pathe-2.0.3.tgz",
      "integrity": "sha512-WUjGcAqP1gQacoQe+OBJsFA7Ld4DyXuUIjZ5cc75cLHvJ7dtNsTugphxIADwspS+AraAUePCKrSVtPLFj/F88w==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/picocolors": {
      "version": "1.1.1",
      "license": "ISC"
    },
    "node_modules/picomatch": {
      "version": "4.0.5",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=12"
      },
      "funding": {
        "url": "https://github.com/sponsors/jonschlinkert"
      }
    },
    "node_modules/possible-typed-array-names": {
      "version": "1.1.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/postcss": {
      "version": "8.5.10",
      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.5.10.tgz",
      "integrity": "sha512-pMMHxBOZKFU6HgAZ4eyGnwXF/EvPGGqUr0MnZ5+99485wwW41kW91A4LOGxSHhgugZmSChL5AlElNdwlNgcnLQ==",
      "funding": [
        {
          "type": "opencollective",
          "url": "https://opencollective.com/postcss/"
        },
        {
          "type": "tidelift",
          "url": "https://tidelift.com/funding/github/npm/postcss"
        },
        {
          "type": "github",
          "url": "https://github.com/sponsors/ai"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "nanoid": "^3.3.11",
        "picocolors": "^1.1.1",
        "source-map-js": "^1.2.1"
      },
      "engines": {
        "node": "^10 || ^12 || >=14"
      }
    },
    "node_modules/prelude-ls": {
      "version": "1.2.1",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.8.0"
      }
    },
    "node_modules/prisma": {
      "version": "5.22.0",
      "devOptional": true,
      "hasInstallScript": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@prisma/engines": "5.22.0"
      },
      "bin": {
        "prisma": "build/index.js"
      },
      "engines": {
        "node": ">=16.13"
      },
      "optionalDependencies": {
        "fsevents": "2.3.3"
      }
    },
    "node_modules/prop-types": {
      "version": "15.8.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "loose-envify": "^1.4.0",
        "object-assign": "^4.1.1",
        "react-is": "^16.13.1"
      }
    },
    "node_modules/punycode": {
      "version": "2.3.1",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/queue-microtask": {
      "version": "1.2.3",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT"
    },
    "node_modules/react": {
      "version": "19.1.1",
      "resolved": "https://registry.npmjs.org/react/-/react-19.1.1.tgz",
      "integrity": "sha512-w8nqGImo45dmMIfljjMwOGtbmC/mk4CMYhWIicdSflH91J9TyCyczcPFXJzrZ/ZXcgGRFeP6BU0BEJTw6tZdfQ==",
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/react-dom": {
      "version": "19.1.1",
      "resolved": "https://registry.npmjs.org/react-dom/-/react-dom-19.1.1.tgz",
      "integrity": "sha512-Dlq/5LAZgF0Gaz6yiqZCf6VCcZs1ghAJyrsu84Q/GT0gV+mCxbfmKNoGRKBYMJ8IEdGPqu49YWXD02GCknEDkw==",
      "license": "MIT",
      "dependencies": {
        "scheduler": "^0.26.0"
      },
      "peerDependencies": {
        "react": "^19.1.1"
      }
    },
    "node_modules/react-is": {
      "version": "16.13.1",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/reflect.getprototypeof": {
      "version": "1.0.10",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "define-properties": "^1.2.1",
        "es-abstract": "^1.23.9",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.0.0",
        "get-intrinsic": "^1.2.7",
        "get-proto": "^1.0.1",
        "which-builtin-type": "^1.2.1"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/reflect.getprototypeof/node_modules/es-abstract": {
      "version": "1.24.2",
      "resolved": "https://registry.npmjs.org/es-abstract/-/es-abstract-1.24.2.tgz",
      "integrity": "sha512-2FpH9Q5i2RRwyEP1AylXe6nYLR5OhaJTZwmlcP0dL/+JCbgg7yyEo/sEK6HeGZRf3dFpWwThaRHVApXSkW3xeg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "array-buffer-byte-length": "^1.0.2",
        "arraybuffer.prototype.slice": "^1.0.4",
        "available-typed-arrays": "^1.0.7",
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.4",
        "data-view-buffer": "^1.0.2",
        "data-view-byte-length": "^1.0.2",
        "data-view-byte-offset": "^1.0.1",
        "es-define-property": "^1.0.1",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.1.1",
        "es-set-tostringtag": "^2.1.0",
        "es-to-primitive": "^1.3.0",
        "function.prototype.name": "^1.1.8",
        "get-intrinsic": "^1.3.0",
        "get-proto": "^1.0.1",
        "get-symbol-description": "^1.1.0",
        "globalthis": "^1.0.4",
        "gopd": "^1.2.0",
        "has-property-descriptors": "^1.0.2",
        "has-proto": "^1.2.0",
        "has-symbols": "^1.1.0",
        "hasown": "^2.0.2",
        "internal-slot": "^1.1.0",
        "is-array-buffer": "^3.0.5",
        "is-callable": "^1.2.7",
        "is-data-view": "^1.0.2",
        "is-negative-zero": "^2.0.3",
        "is-regex": "^1.2.1",
        "is-set": "^2.0.3",
        "is-shared-array-buffer": "^1.0.4",
        "is-string": "^1.1.1",
        "is-typed-array": "^1.1.15",
        "is-weakref": "^1.1.1",
        "math-intrinsics": "^1.1.0",
        "object-inspect": "^1.13.4",
        "object-keys": "^1.1.1",
        "object.assign": "^4.1.7",
        "own-keys": "^1.0.1",
        "regexp.prototype.flags": "^1.5.4",
        "safe-array-concat": "^1.1.3",
        "safe-push-apply": "^1.0.0",
        "safe-regex-test": "^1.1.0",
        "set-proto": "^1.0.0",
        "stop-iteration-iterator": "^1.1.0",
        "string.prototype.trim": "^1.2.10",
        "string.prototype.trimend": "^1.0.9",
        "string.prototype.trimstart": "^1.0.8",
        "typed-array-buffer": "^1.0.3",
        "typed-array-byte-length": "^1.0.3",
        "typed-array-byte-offset": "^1.0.4",
        "typed-array-length": "^1.0.7",
        "unbox-primitive": "^1.1.0",
        "which-typed-array": "^1.1.19"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/regexp.prototype.flags": {
      "version": "1.5.4",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "define-properties": "^1.2.1",
        "es-errors": "^1.3.0",
        "get-proto": "^1.0.1",
        "gopd": "^1.2.0",
        "set-function-name": "^2.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/resolve": {
      "version": "2.0.0-next.7",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0",
        "is-core-module": "^2.16.2",
        "node-exports-info": "^1.6.0",
        "object-keys": "^1.1.1",
        "path-parse": "^1.0.7",
        "supports-preserve-symlinks-flag": "^1.0.0"
      },
      "bin": {
        "resolve": "bin/resolve"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/resolve-from": {
      "version": "4.0.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/resolve-pkg-maps": {
      "version": "1.0.0",
      "dev": true,
      "license": "MIT",
      "funding": {
        "url": "https://github.com/privatenumber/resolve-pkg-maps?sponsor=1"
      }
    },
    "node_modules/reusify": {
      "version": "1.1.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "iojs": ">=1.0.0",
        "node": ">=0.10.0"
      }
    },
    "node_modules/rimraf": {
      "version": "3.0.2",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "glob": "^7.1.3"
      },
      "bin": {
        "rimraf": "bin.js"
      },
      "funding": {
        "url": "https://github.com/sponsors/isaacs"
      }
    },
    "node_modules/rimraf/node_modules/glob": {
      "version": "7.2.3",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "fs.realpath": "^1.0.0",
        "inflight": "^1.0.4",
        "inherits": "2",
        "minimatch": "^3.1.1",
        "once": "^1.3.0",
        "path-is-absolute": "^1.0.0"
      },
      "engines": {
        "node": "*"
      },
      "funding": {
        "url": "https://github.com/sponsors/isaacs"
      }
    },
    "node_modules/rolldown": {
      "version": "1.1.5",
      "resolved": "https://registry.npmjs.org/rolldown/-/rolldown-1.1.5.tgz",
      "integrity": "sha512-t9z29cJjXf/vxQ8dyhCSpt6H6aSwHTk8cT5I3iy6SMXuFpk5mB6PL6XfC8PCwrPTx93udwKUm9HRteAlTGBLiA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@oxc-project/types": "=0.139.0",
        "@rolldown/pluginutils": "^1.0.0"
      },
      "bin": {
        "rolldown": "bin/cli.mjs"
      },
      "engines": {
        "node": "^20.19.0 || >=22.12.0"
      },
      "optionalDependencies": {
        "@rolldown/binding-android-arm64": "1.1.5",
        "@rolldown/binding-darwin-arm64": "1.1.5",
        "@rolldown/binding-darwin-x64": "1.1.5",
        "@rolldown/binding-freebsd-x64": "1.1.5",
        "@rolldown/binding-linux-arm-gnueabihf": "1.1.5",
        "@rolldown/binding-linux-arm64-gnu": "1.1.5",
        "@rolldown/binding-linux-arm64-musl": "1.1.5",
        "@rolldown/binding-linux-ppc64-gnu": "1.1.5",
        "@rolldown/binding-linux-s390x-gnu": "1.1.5",
        "@rolldown/binding-linux-x64-gnu": "1.1.5",
        "@rolldown/binding-linux-x64-musl": "1.1.5",
        "@rolldown/binding-openharmony-arm64": "1.1.5",
        "@rolldown/binding-wasm32-wasi": "1.1.5",
        "@rolldown/binding-win32-arm64-msvc": "1.1.5",
        "@rolldown/binding-win32-x64-msvc": "1.1.5"
      }
    },
    "node_modules/run-parallel": {
      "version": "1.2.0",
      "dev": true,
      "funding": [
        {
          "type": "github",
          "url": "https://github.com/sponsors/feross"
        },
        {
          "type": "patreon",
          "url": "https://www.patreon.com/feross"
        },
        {
          "type": "consulting",
          "url": "https://feross.org/support"
        }
      ],
      "license": "MIT",
      "dependencies": {
        "queue-microtask": "^1.2.2"
      }
    },
    "node_modules/safe-array-concat": {
      "version": "1.1.4",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.9",
        "call-bound": "^1.0.4",
        "get-intrinsic": "^1.3.0",
        "has-symbols": "^1.1.0",
        "isarray": "^2.0.5"
      },
      "engines": {
        "node": ">=0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/safe-push-apply": {
      "version": "1.0.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0",
        "isarray": "^2.0.5"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/safe-regex-test": {
      "version": "1.1.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.2",
        "es-errors": "^1.3.0",
        "is-regex": "^1.2.1"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/scheduler": {
      "version": "0.26.0",
      "resolved": "https://registry.npmjs.org/scheduler/-/scheduler-0.26.0.tgz",
      "integrity": "sha512-NlHwttCI/l5gCPR3D1nNXtWABUmBwvZpEQiD4IXSbIDq8BzLIK/7Ir5gTFSGZDUu37K5cMNp0hFtzO38sC7gWA==",
      "license": "MIT"
    },
    "node_modules/semver": {
      "version": "7.8.5",
      "devOptional": true,
      "license": "ISC",
      "bin": {
        "semver": "bin/semver.js"
      },
      "engines": {
        "node": ">=10"
      }
    },
    "node_modules/set-function-length": {
      "version": "1.2.2",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "define-data-property": "^1.1.4",
        "es-errors": "^1.3.0",
        "function-bind": "^1.1.2",
        "get-intrinsic": "^1.2.4",
        "gopd": "^1.0.1",
        "has-property-descriptors": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/set-function-name": {
      "version": "2.0.2",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "define-data-property": "^1.1.4",
        "es-errors": "^1.3.0",
        "functions-have-names": "^1.2.3",
        "has-property-descriptors": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/set-proto": {
      "version": "1.0.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "dunder-proto": "^1.0.1",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.0.0"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/sharp": {
      "version": "0.34.5",
      "resolved": "https://registry.npmjs.org/sharp/-/sharp-0.34.5.tgz",
      "integrity": "sha512-Ou9I5Ft9WNcCbXrU9cMgPBcCK8LiwLqcbywW3t4oDV37n1pzpuNLsYiAV8eODnjbtQlSDwZ2cUEeQz4E54Hltg==",
      "hasInstallScript": true,
      "license": "Apache-2.0",
      "optional": true,
      "dependencies": {
        "@img/colour": "^1.0.0",
        "detect-libc": "^2.1.2",
        "semver": "^7.7.3"
      },
      "engines": {
        "node": "^18.17.0 || ^20.3.0 || >=21.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/libvips"
      },
      "optionalDependencies": {
        "@img/sharp-darwin-arm64": "0.34.5",
        "@img/sharp-darwin-x64": "0.34.5",
        "@img/sharp-libvips-darwin-arm64": "1.2.4",
        "@img/sharp-libvips-darwin-x64": "1.2.4",
        "@img/sharp-libvips-linux-arm": "1.2.4",
        "@img/sharp-libvips-linux-arm64": "1.2.4",
        "@img/sharp-libvips-linux-ppc64": "1.2.4",
        "@img/sharp-libvips-linux-riscv64": "1.2.4",
        "@img/sharp-libvips-linux-s390x": "1.2.4",
        "@img/sharp-libvips-linux-x64": "1.2.4",
        "@img/sharp-libvips-linuxmusl-arm64": "1.2.4",
        "@img/sharp-libvips-linuxmusl-x64": "1.2.4",
        "@img/sharp-linux-arm": "0.34.5",
        "@img/sharp-linux-arm64": "0.34.5",
        "@img/sharp-linux-ppc64": "0.34.5",
        "@img/sharp-linux-riscv64": "0.34.5",
        "@img/sharp-linux-s390x": "0.34.5",
        "@img/sharp-linux-x64": "0.34.5",
        "@img/sharp-linuxmusl-arm64": "0.34.5",
        "@img/sharp-linuxmusl-x64": "0.34.5",
        "@img/sharp-wasm32": "0.34.5",
        "@img/sharp-win32-arm64": "0.34.5",
        "@img/sharp-win32-ia32": "0.34.5",
        "@img/sharp-win32-x64": "0.34.5"
      }
    },
    "node_modules/shebang-command": {
      "version": "2.0.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "shebang-regex": "^3.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/shebang-regex": {
      "version": "3.0.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/side-channel": {
      "version": "1.1.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0",
        "object-inspect": "^1.13.4",
        "side-channel-list": "^1.0.1",
        "side-channel-map": "^1.0.1",
        "side-channel-weakmap": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/side-channel-list": {
      "version": "1.0.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0",
        "object-inspect": "^1.13.4"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/side-channel-map": {
      "version": "1.0.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.2",
        "es-errors": "^1.3.0",
        "get-intrinsic": "^1.2.5",
        "object-inspect": "^1.13.3"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/side-channel-weakmap": {
      "version": "1.0.2",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.2",
        "es-errors": "^1.3.0",
        "get-intrinsic": "^1.2.5",
        "object-inspect": "^1.13.3",
        "side-channel-map": "^1.0.1"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/siginfo": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/siginfo/-/siginfo-2.0.0.tgz",
      "integrity": "sha512-ybx0WO1/8bSBLEWXZvEd7gMW3Sn3JFlW3TvX1nREbDLRNQNaeNN8WK0meBwPdAaOI7TtRRRJn/Es1zhrrCHu7g==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/source-map-js": {
      "version": "1.2.1",
      "license": "BSD-3-Clause",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/stable-hash": {
      "version": "0.0.5",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/stackback": {
      "version": "0.0.2",
      "resolved": "https://registry.npmjs.org/stackback/-/stackback-0.0.2.tgz",
      "integrity": "sha512-1XMJE5fQo1jGH6Y/7ebnwPOBEkIEnT4QF32d5R1+VXdXveM0IBMJt8zfaxX1P3QhVwrYe+576+jkANtSS2mBbw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/std-env": {
      "version": "4.2.0",
      "resolved": "https://registry.npmjs.org/std-env/-/std-env-4.2.0.tgz",
      "integrity": "sha512-oCUKSupKTHX53EyjDtuZQ64pjLJ6yYCtpmEw0goYxtjG9KpbRe8KAsl2tBUGU9DyMcJ0RwJ8GqJAFzMXcXW1Rw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/stop-iteration-iterator": {
      "version": "1.1.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "es-errors": "^1.3.0",
        "internal-slot": "^1.1.0"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/string.prototype.includes": {
      "version": "2.0.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.7",
        "define-properties": "^1.2.1",
        "es-abstract": "^1.23.3"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/string.prototype.includes/node_modules/es-abstract": {
      "version": "1.24.2",
      "resolved": "https://registry.npmjs.org/es-abstract/-/es-abstract-1.24.2.tgz",
      "integrity": "sha512-2FpH9Q5i2RRwyEP1AylXe6nYLR5OhaJTZwmlcP0dL/+JCbgg7yyEo/sEK6HeGZRf3dFpWwThaRHVApXSkW3xeg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "array-buffer-byte-length": "^1.0.2",
        "arraybuffer.prototype.slice": "^1.0.4",
        "available-typed-arrays": "^1.0.7",
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.4",
        "data-view-buffer": "^1.0.2",
        "data-view-byte-length": "^1.0.2",
        "data-view-byte-offset": "^1.0.1",
        "es-define-property": "^1.0.1",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.1.1",
        "es-set-tostringtag": "^2.1.0",
        "es-to-primitive": "^1.3.0",
        "function.prototype.name": "^1.1.8",
        "get-intrinsic": "^1.3.0",
        "get-proto": "^1.0.1",
        "get-symbol-description": "^1.1.0",
        "globalthis": "^1.0.4",
        "gopd": "^1.2.0",
        "has-property-descriptors": "^1.0.2",
        "has-proto": "^1.2.0",
        "has-symbols": "^1.1.0",
        "hasown": "^2.0.2",
        "internal-slot": "^1.1.0",
        "is-array-buffer": "^3.0.5",
        "is-callable": "^1.2.7",
        "is-data-view": "^1.0.2",
        "is-negative-zero": "^2.0.3",
        "is-regex": "^1.2.1",
        "is-set": "^2.0.3",
        "is-shared-array-buffer": "^1.0.4",
        "is-string": "^1.1.1",
        "is-typed-array": "^1.1.15",
        "is-weakref": "^1.1.1",
        "math-intrinsics": "^1.1.0",
        "object-inspect": "^1.13.4",
        "object-keys": "^1.1.1",
        "object.assign": "^4.1.7",
        "own-keys": "^1.0.1",
        "regexp.prototype.flags": "^1.5.4",
        "safe-array-concat": "^1.1.3",
        "safe-push-apply": "^1.0.0",
        "safe-regex-test": "^1.1.0",
        "set-proto": "^1.0.0",
        "stop-iteration-iterator": "^1.1.0",
        "string.prototype.trim": "^1.2.10",
        "string.prototype.trimend": "^1.0.9",
        "string.prototype.trimstart": "^1.0.8",
        "typed-array-buffer": "^1.0.3",
        "typed-array-byte-length": "^1.0.3",
        "typed-array-byte-offset": "^1.0.4",
        "typed-array-length": "^1.0.7",
        "unbox-primitive": "^1.1.0",
        "which-typed-array": "^1.1.19"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/string.prototype.matchall": {
      "version": "4.0.12",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.3",
        "define-properties": "^1.2.1",
        "es-abstract": "^1.23.6",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.0.0",
        "get-intrinsic": "^1.2.6",
        "gopd": "^1.2.0",
        "has-symbols": "^1.1.0",
        "internal-slot": "^1.1.0",
        "regexp.prototype.flags": "^1.5.3",
        "set-function-name": "^2.0.2",
        "side-channel": "^1.1.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/string.prototype.matchall/node_modules/es-abstract": {
      "version": "1.24.2",
      "resolved": "https://registry.npmjs.org/es-abstract/-/es-abstract-1.24.2.tgz",
      "integrity": "sha512-2FpH9Q5i2RRwyEP1AylXe6nYLR5OhaJTZwmlcP0dL/+JCbgg7yyEo/sEK6HeGZRf3dFpWwThaRHVApXSkW3xeg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "array-buffer-byte-length": "^1.0.2",
        "arraybuffer.prototype.slice": "^1.0.4",
        "available-typed-arrays": "^1.0.7",
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.4",
        "data-view-buffer": "^1.0.2",
        "data-view-byte-length": "^1.0.2",
        "data-view-byte-offset": "^1.0.1",
        "es-define-property": "^1.0.1",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.1.1",
        "es-set-tostringtag": "^2.1.0",
        "es-to-primitive": "^1.3.0",
        "function.prototype.name": "^1.1.8",
        "get-intrinsic": "^1.3.0",
        "get-proto": "^1.0.1",
        "get-symbol-description": "^1.1.0",
        "globalthis": "^1.0.4",
        "gopd": "^1.2.0",
        "has-property-descriptors": "^1.0.2",
        "has-proto": "^1.2.0",
        "has-symbols": "^1.1.0",
        "hasown": "^2.0.2",
        "internal-slot": "^1.1.0",
        "is-array-buffer": "^3.0.5",
        "is-callable": "^1.2.7",
        "is-data-view": "^1.0.2",
        "is-negative-zero": "^2.0.3",
        "is-regex": "^1.2.1",
        "is-set": "^2.0.3",
        "is-shared-array-buffer": "^1.0.4",
        "is-string": "^1.1.1",
        "is-typed-array": "^1.1.15",
        "is-weakref": "^1.1.1",
        "math-intrinsics": "^1.1.0",
        "object-inspect": "^1.13.4",
        "object-keys": "^1.1.1",
        "object.assign": "^4.1.7",
        "own-keys": "^1.0.1",
        "regexp.prototype.flags": "^1.5.4",
        "safe-array-concat": "^1.1.3",
        "safe-push-apply": "^1.0.0",
        "safe-regex-test": "^1.1.0",
        "set-proto": "^1.0.0",
        "stop-iteration-iterator": "^1.1.0",
        "string.prototype.trim": "^1.2.10",
        "string.prototype.trimend": "^1.0.9",
        "string.prototype.trimstart": "^1.0.8",
        "typed-array-buffer": "^1.0.3",
        "typed-array-byte-length": "^1.0.3",
        "typed-array-byte-offset": "^1.0.4",
        "typed-array-length": "^1.0.7",
        "unbox-primitive": "^1.1.0",
        "which-typed-array": "^1.1.19"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/string.prototype.repeat": {
      "version": "1.0.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "define-properties": "^1.1.3",
        "es-abstract": "^1.17.5"
      }
    },
    "node_modules/string.prototype.repeat/node_modules/es-abstract": {
      "version": "1.24.2",
      "resolved": "https://registry.npmjs.org/es-abstract/-/es-abstract-1.24.2.tgz",
      "integrity": "sha512-2FpH9Q5i2RRwyEP1AylXe6nYLR5OhaJTZwmlcP0dL/+JCbgg7yyEo/sEK6HeGZRf3dFpWwThaRHVApXSkW3xeg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "array-buffer-byte-length": "^1.0.2",
        "arraybuffer.prototype.slice": "^1.0.4",
        "available-typed-arrays": "^1.0.7",
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.4",
        "data-view-buffer": "^1.0.2",
        "data-view-byte-length": "^1.0.2",
        "data-view-byte-offset": "^1.0.1",
        "es-define-property": "^1.0.1",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.1.1",
        "es-set-tostringtag": "^2.1.0",
        "es-to-primitive": "^1.3.0",
        "function.prototype.name": "^1.1.8",
        "get-intrinsic": "^1.3.0",
        "get-proto": "^1.0.1",
        "get-symbol-description": "^1.1.0",
        "globalthis": "^1.0.4",
        "gopd": "^1.2.0",
        "has-property-descriptors": "^1.0.2",
        "has-proto": "^1.2.0",
        "has-symbols": "^1.1.0",
        "hasown": "^2.0.2",
        "internal-slot": "^1.1.0",
        "is-array-buffer": "^3.0.5",
        "is-callable": "^1.2.7",
        "is-data-view": "^1.0.2",
        "is-negative-zero": "^2.0.3",
        "is-regex": "^1.2.1",
        "is-set": "^2.0.3",
        "is-shared-array-buffer": "^1.0.4",
        "is-string": "^1.1.1",
        "is-typed-array": "^1.1.15",
        "is-weakref": "^1.1.1",
        "math-intrinsics": "^1.1.0",
        "object-inspect": "^1.13.4",
        "object-keys": "^1.1.1",
        "object.assign": "^4.1.7",
        "own-keys": "^1.0.1",
        "regexp.prototype.flags": "^1.5.4",
        "safe-array-concat": "^1.1.3",
        "safe-push-apply": "^1.0.0",
        "safe-regex-test": "^1.1.0",
        "set-proto": "^1.0.0",
        "stop-iteration-iterator": "^1.1.0",
        "string.prototype.trim": "^1.2.10",
        "string.prototype.trimend": "^1.0.9",
        "string.prototype.trimstart": "^1.0.8",
        "typed-array-buffer": "^1.0.3",
        "typed-array-byte-length": "^1.0.3",
        "typed-array-byte-offset": "^1.0.4",
        "typed-array-length": "^1.0.7",
        "unbox-primitive": "^1.1.0",
        "which-typed-array": "^1.1.19"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/string.prototype.trim": {
      "version": "1.2.11",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.9",
        "call-bound": "^1.0.4",
        "define-data-property": "^1.1.4",
        "define-properties": "^1.2.1",
        "es-abstract": "^1.24.2",
        "es-object-atoms": "^1.1.2",
        "has-property-descriptors": "^1.0.2",
        "safe-regex-test": "^1.1.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/string.prototype.trim/node_modules/es-abstract": {
      "version": "1.24.2",
      "resolved": "https://registry.npmjs.org/es-abstract/-/es-abstract-1.24.2.tgz",
      "integrity": "sha512-2FpH9Q5i2RRwyEP1AylXe6nYLR5OhaJTZwmlcP0dL/+JCbgg7yyEo/sEK6HeGZRf3dFpWwThaRHVApXSkW3xeg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "array-buffer-byte-length": "^1.0.2",
        "arraybuffer.prototype.slice": "^1.0.4",
        "available-typed-arrays": "^1.0.7",
        "call-bind": "^1.0.8",
        "call-bound": "^1.0.4",
        "data-view-buffer": "^1.0.2",
        "data-view-byte-length": "^1.0.2",
        "data-view-byte-offset": "^1.0.1",
        "es-define-property": "^1.0.1",
        "es-errors": "^1.3.0",
        "es-object-atoms": "^1.1.1",
        "es-set-tostringtag": "^2.1.0",
        "es-to-primitive": "^1.3.0",
        "function.prototype.name": "^1.1.8",
        "get-intrinsic": "^1.3.0",
        "get-proto": "^1.0.1",
        "get-symbol-description": "^1.1.0",
        "globalthis": "^1.0.4",
        "gopd": "^1.2.0",
        "has-property-descriptors": "^1.0.2",
        "has-proto": "^1.2.0",
        "has-symbols": "^1.1.0",
        "hasown": "^2.0.2",
        "internal-slot": "^1.1.0",
        "is-array-buffer": "^3.0.5",
        "is-callable": "^1.2.7",
        "is-data-view": "^1.0.2",
        "is-negative-zero": "^2.0.3",
        "is-regex": "^1.2.1",
        "is-set": "^2.0.3",
        "is-shared-array-buffer": "^1.0.4",
        "is-string": "^1.1.1",
        "is-typed-array": "^1.1.15",
        "is-weakref": "^1.1.1",
        "math-intrinsics": "^1.1.0",
        "object-inspect": "^1.13.4",
        "object-keys": "^1.1.1",
        "object.assign": "^4.1.7",
        "own-keys": "^1.0.1",
        "regexp.prototype.flags": "^1.5.4",
        "safe-array-concat": "^1.1.3",
        "safe-push-apply": "^1.0.0",
        "safe-regex-test": "^1.1.0",
        "set-proto": "^1.0.0",
        "stop-iteration-iterator": "^1.1.0",
        "string.prototype.trim": "^1.2.10",
        "string.prototype.trimend": "^1.0.9",
        "string.prototype.trimstart": "^1.0.8",
        "typed-array-buffer": "^1.0.3",
        "typed-array-byte-length": "^1.0.3",
        "typed-array-byte-offset": "^1.0.4",
        "typed-array-length": "^1.0.7",
        "unbox-primitive": "^1.1.0",
        "which-typed-array": "^1.1.19"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/string.prototype.trimend": {
      "version": "1.0.10",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.9",
        "call-bound": "^1.0.4",
        "define-properties": "^1.2.1",
        "es-object-atoms": "^1.1.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/string.prototype.trimstart": {
      "version": "1.0.8",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.7",
        "define-properties": "^1.2.1",
        "es-object-atoms": "^1.0.0"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/strip-ansi": {
      "version": "6.0.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ansi-regex": "^5.0.1"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/strip-bom": {
      "version": "3.0.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=4"
      }
    },
    "node_modules/strip-json-comments": {
      "version": "3.1.1",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/styled-jsx": {
      "version": "5.1.6",
      "resolved": "https://registry.npmjs.org/styled-jsx/-/styled-jsx-5.1.6.tgz",
      "integrity": "sha512-qSVyDTeMotdvQYoHWLNGwRFJHC+i+ZvdBRYosOFgC+Wg1vx4frN2/RG/NA7SYqqvKNLf39P2LSRA2pu6n0XYZA==",
      "license": "MIT",
      "dependencies": {
        "client-only": "0.0.1"
      },
      "engines": {
        "node": ">= 12.0.0"
      },
      "peerDependencies": {
        "react": ">= 16.8.0 || 17.x.x || ^18.0.0-0 || ^19.0.0-0"
      },
      "peerDependenciesMeta": {
        "@babel/core": {
          "optional": true
        },
        "babel-plugin-macros": {
          "optional": true
        }
      }
    },
    "node_modules/supports-color": {
      "version": "7.2.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "has-flag": "^4.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/supports-preserve-symlinks-flag": {
      "version": "1.0.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/text-table": {
      "version": "0.2.0",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/tinybench": {
      "version": "2.9.0",
      "resolved": "https://registry.npmjs.org/tinybench/-/tinybench-2.9.0.tgz",
      "integrity": "sha512-0+DUvqWMValLmha6lr4kD8iAMK1HzV0/aKnCtWb9v9641TnP/MFb7Pc2bxoxQjTXAErryXVgUOfv2YqNllqGeg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/tinyexec": {
      "version": "1.2.4",
      "resolved": "https://registry.npmjs.org/tinyexec/-/tinyexec-1.2.4.tgz",
      "integrity": "sha512-SHf/r48b7vOrjve9PxJo3MN5v5yuyjHvdUcrQffT3WXMUfnGmHDVbC4k3sHJaJTgZCwpUplIaAo5ANtMyp3YHg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/tinyglobby": {
      "version": "0.2.17",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "fdir": "^6.5.0",
        "picomatch": "^4.0.4"
      },
      "engines": {
        "node": ">=12.0.0"
      },
      "funding": {
        "url": "https://github.com/sponsors/SuperchupuDev"
      }
    },
    "node_modules/tinyrainbow": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/tinyrainbow/-/tinyrainbow-3.1.0.tgz",
      "integrity": "sha512-Bf+ILmBgretUrdJxzXM0SgXLZ3XfiaUuOj/IKQHuTXip+05Xn+uyEYdVg0kYDipTBcLrCVyUzAPz7QmArb0mmw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=14.0.0"
      }
    },
    "node_modules/to-regex-range": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/to-regex-range/-/to-regex-range-5.0.1.tgz",
      "integrity": "sha512-65P7iz6X5yEr1cwcgvQxbbIw7Uk3gOy5dIdtZ4rDveLqhrdJP+Li/Hx6tyK0NEb+2GCyneCMJiGqrADCSNk8sQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-number": "^7.0.0"
      },
      "engines": {
        "node": ">=8.0"
      }
    },
    "node_modules/ts-api-utils": {
      "version": "2.5.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=18.12"
      },
      "peerDependencies": {
        "typescript": ">=4.8.4"
      }
    },
    "node_modules/tsconfig-paths": {
      "version": "3.15.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@types/json5": "^0.0.29",
        "json5": "^1.0.2",
        "minimist": "^1.2.6",
        "strip-bom": "^3.0.0"
      }
    },
    "node_modules/tslib": {
      "version": "2.8.1",
      "license": "0BSD"
    },
    "node_modules/type-check": {
      "version": "0.4.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "prelude-ls": "^1.2.1"
      },
      "engines": {
        "node": ">= 0.8.0"
      }
    },
    "node_modules/type-fest": {
      "version": "0.20.2",
      "dev": true,
      "license": "(MIT OR CC0-1.0)",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/typed-array-buffer": {
      "version": "1.0.3",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.3",
        "es-errors": "^1.3.0",
        "is-typed-array": "^1.1.14"
      },
      "engines": {
        "node": ">= 0.4"
      }
    },
    "node_modules/typed-array-byte-length": {
      "version": "1.0.3",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.8",
        "for-each": "^0.3.3",
        "gopd": "^1.2.0",
        "has-proto": "^1.2.0",
        "is-typed-array": "^1.1.14"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/typed-array-byte-offset": {
      "version": "1.0.4",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "available-typed-arrays": "^1.0.7",
        "call-bind": "^1.0.8",
        "for-each": "^0.3.3",
        "gopd": "^1.2.0",
        "has-proto": "^1.2.0",
        "is-typed-array": "^1.1.15",
        "reflect.getprototypeof": "^1.0.9"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/typed-array-length": {
      "version": "1.0.8",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bind": "^1.0.9",
        "for-each": "^0.3.5",
        "gopd": "^1.2.0",
        "is-typed-array": "^1.1.15",
        "possible-typed-array-names": "^1.1.0",
        "reflect.getprototypeof": "^1.0.10"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/typescript": {
      "version": "5.7.2",
      "dev": true,
      "license": "Apache-2.0",
      "bin": {
        "tsc": "bin/tsc",
        "tsserver": "bin/tsserver"
      },
      "engines": {
        "node": ">=14.17"
      }
    },
    "node_modules/unbox-primitive": {
      "version": "1.1.0",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.3",
        "has-bigints": "^1.0.2",
        "has-symbols": "^1.1.0",
        "which-boxed-primitive": "^1.1.1"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/undici-types": {
      "version": "6.21.0",
      "resolved": "https://registry.npmjs.org/undici-types/-/undici-types-6.21.0.tgz",
      "integrity": "sha512-iwDZqg0QAGrg9Rav5H4n0M64c3mkR59cJ6wQp+7C4nI0gsmExaedaYLNO44eT4AtBBwjbTiGPMlt2Md0T9H9JQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/unrs-resolver": {
      "version": "1.12.2",
      "dev": true,
      "hasInstallScript": true,
      "license": "MIT",
      "dependencies": {
        "napi-postinstall": "^0.3.4"
      },
      "funding": {
        "url": "https://opencollective.com/unrs-resolver"
      },
      "optionalDependencies": {
        "@unrs/resolver-binding-android-arm-eabi": "1.12.2",
        "@unrs/resolver-binding-android-arm64": "1.12.2",
        "@unrs/resolver-binding-darwin-arm64": "1.12.2",
        "@unrs/resolver-binding-darwin-x64": "1.12.2",
        "@unrs/resolver-binding-freebsd-x64": "1.12.2",
        "@unrs/resolver-binding-linux-arm-gnueabihf": "1.12.2",
        "@unrs/resolver-binding-linux-arm-musleabihf": "1.12.2",
        "@unrs/resolver-binding-linux-arm64-gnu": "1.12.2",
        "@unrs/resolver-binding-linux-arm64-musl": "1.12.2",
        "@unrs/resolver-binding-linux-loong64-gnu": "1.12.2",
        "@unrs/resolver-binding-linux-loong64-musl": "1.12.2",
        "@unrs/resolver-binding-linux-ppc64-gnu": "1.12.2",
        "@unrs/resolver-binding-linux-riscv64-gnu": "1.12.2",
        "@unrs/resolver-binding-linux-riscv64-musl": "1.12.2",
        "@unrs/resolver-binding-linux-s390x-gnu": "1.12.2",
        "@unrs/resolver-binding-linux-x64-gnu": "1.12.2",
        "@unrs/resolver-binding-linux-x64-musl": "1.12.2",
        "@unrs/resolver-binding-openharmony-arm64": "1.12.2",
        "@unrs/resolver-binding-wasm32-wasi": "1.12.2",
        "@unrs/resolver-binding-win32-arm64-msvc": "1.12.2",
        "@unrs/resolver-binding-win32-ia32-msvc": "1.12.2",
        "@unrs/resolver-binding-win32-x64-msvc": "1.12.2"
      }
    },
    "node_modules/unrs-resolver/node_modules/@unrs/resolver-binding-android-arm-eabi": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-android-arm-eabi/-/resolver-binding-android-arm-eabi-1.12.2.tgz",
      "integrity": "sha512-g5T90pqg1bo/7mytQx6F4iBNC0Wsh9cu+z9veDbFjc7HjpesJFWD7QMS0NGStXM075+7dJPPVvBbpZlnrdpi/w==",
      "cpu": [
        "arm"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ]
    },
    "node_modules/unrs-resolver/node_modules/@unrs/resolver-binding-android-arm64": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-android-arm64/-/resolver-binding-android-arm64-1.12.2.tgz",
      "integrity": "sha512-YGCRZv/9GLhwmz6mYDeTsm/92BAyR28l6c2ReweVW5pWgfsitWLY8upvfRlGdoyD8HjeTHSYJWyZGD4KJA/nFQ==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "android"
      ]
    },
    "node_modules/unrs-resolver/node_modules/@unrs/resolver-binding-darwin-arm64": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-darwin-arm64/-/resolver-binding-darwin-arm64-1.12.2.tgz",
      "integrity": "sha512-u9DiNT1auQMO20A9SyTuG3wUgQWB9Z7KjAg0uFuCDR1FsAY8A0CG2S6JpHS1xwm/w1G08bjXZDcyOCjv1WAm2w==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ]
    },
    "node_modules/unrs-resolver/node_modules/@unrs/resolver-binding-darwin-x64": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-darwin-x64/-/resolver-binding-darwin-x64-1.12.2.tgz",
      "integrity": "sha512-f7rPLi/T1HVKZu/u6t87lroib16n8vrSzcyxI7lg4BGO9UF26KhQL44sd9eOUgrTYhvRXtWOIZT5PejdPyJfUA==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "darwin"
      ]
    },
    "node_modules/unrs-resolver/node_modules/@unrs/resolver-binding-freebsd-x64": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-freebsd-x64/-/resolver-binding-freebsd-x64-1.12.2.tgz",
      "integrity": "sha512-BpcOjWCJub6nRZUS2zA20pmLvjtqAtGejETaIyRLiZiQf++cbrjltLA5NN/xaXfqeOBOSlMFbemIl5/S5tljmg==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "freebsd"
      ]
    },
    "node_modules/unrs-resolver/node_modules/@unrs/resolver-binding-linux-arm-gnueabihf": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-arm-gnueabihf/-/resolver-binding-linux-arm-gnueabihf-1.12.2.tgz",
      "integrity": "sha512-vZTDvdSISZjJx66OzJqtsOhzifbqRjbmI1Mnu49fQDwog5GtDI4QidRiEAYbZCRj9C8YZEW+3ZjqsyS9GR4k2A==",
      "cpu": [
        "arm"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/unrs-resolver/node_modules/@unrs/resolver-binding-linux-arm-musleabihf": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-arm-musleabihf/-/resolver-binding-linux-arm-musleabihf-1.12.2.tgz",
      "integrity": "sha512-BiPI+IrIlwcW4nLLMM21+B1dFPzd55yAVgVGrdgDjNef+ch03GdxrcyaIz8X9SsQirh/kCQ7mviyWlMxdh2D7g==",
      "cpu": [
        "arm"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/unrs-resolver/node_modules/@unrs/resolver-binding-linux-arm64-gnu": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-arm64-gnu/-/resolver-binding-linux-arm64-gnu-1.12.2.tgz",
      "integrity": "sha512-zJc0H99FEPoFfSrNpa91HYfxzfAJCr502oxNK1cfdC9hlaFI43RT+JFCann9JUgZmLzzntChHyn13Sgn9ljHNg==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/unrs-resolver/node_modules/@unrs/resolver-binding-linux-arm64-musl": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-arm64-musl/-/resolver-binding-linux-arm64-musl-1.12.2.tgz",
      "integrity": "sha512-KQ3Lki6l+Pz1k/eBipN41ES+YUK30beLGb9YqcB1O542cyLCNE6GaxrfcY3T6EezmGGk84wb5XyO9loTM9tkcA==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/unrs-resolver/node_modules/@unrs/resolver-binding-linux-loong64-gnu": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-loong64-gnu/-/resolver-binding-linux-loong64-gnu-1.12.2.tgz",
      "integrity": "sha512-3SJGEh1DborhG6pyxvhPzCT4bbSIVihsvgJc13P1bHG7KLdNDaF9T3gsTwFc7Jw/5Y5/iWOjkEx7Zy0NvCGX3Q==",
      "cpu": [
        "loong64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/unrs-resolver/node_modules/@unrs/resolver-binding-linux-loong64-musl": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-loong64-musl/-/resolver-binding-linux-loong64-musl-1.12.2.tgz",
      "integrity": "sha512-jiuG/Obbel7uw1PwHNFfrkiKhLAF6mnyZ6aWlOAVN9WqKm8v0OFGnciJIHu8+CMvXLQ8AD51LPzAoUfT21D5Ew==",
      "cpu": [
        "loong64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/unrs-resolver/node_modules/@unrs/resolver-binding-linux-ppc64-gnu": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-ppc64-gnu/-/resolver-binding-linux-ppc64-gnu-1.12.2.tgz",
      "integrity": "sha512-q7xRvVpmcfeL+LlZg8Pbbo6QaTZwDU5BaGZbwfhkEsXJn3Was8xYfE0RBH266xZt0rM6B7i8xAYIvjthuUIWHg==",
      "cpu": [
        "ppc64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/unrs-resolver/node_modules/@unrs/resolver-binding-linux-riscv64-gnu": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-riscv64-gnu/-/resolver-binding-linux-riscv64-gnu-1.12.2.tgz",
      "integrity": "sha512-0CVdx6lcnT3Q9inOH8tsMIOJ6ImndllMjqJHg8RLVdB7Vq4SfkEXl9mCSsVNuNA4MCYycRicCUxPCabVHJRr6A==",
      "cpu": [
        "riscv64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/unrs-resolver/node_modules/@unrs/resolver-binding-linux-riscv64-musl": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-riscv64-musl/-/resolver-binding-linux-riscv64-musl-1.12.2.tgz",
      "integrity": "sha512-iOwlRo9vnp6R6ohHQS11n0NnfdXx/omhkocmIfaPRpQhKZ+3BDMkkdRVh53qjkFkpPddf+FETA28NwGN7l5l+w==",
      "cpu": [
        "riscv64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/unrs-resolver/node_modules/@unrs/resolver-binding-linux-s390x-gnu": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-s390x-gnu/-/resolver-binding-linux-s390x-gnu-1.12.2.tgz",
      "integrity": "sha512-HYJtLfXq94q8iZNFT1lknx258wlkkWhZeUXJRqzKBBUJ00CvZ+N33zgbCqimLjsyw5Va6uUxhVa12mI+kaveEw==",
      "cpu": [
        "s390x"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/unrs-resolver/node_modules/@unrs/resolver-binding-linux-x64-gnu": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-x64-gnu/-/resolver-binding-linux-x64-gnu-1.12.2.tgz",
      "integrity": "sha512-mPsUhunKKDih5O96Y6enDQyHc1SqBPlY1E/SfMWDM3EdJ95Z9CArPeCVwCCqbP45ljvivdEk8Fxn+SIb1rDAJQ==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/unrs-resolver/node_modules/@unrs/resolver-binding-linux-x64-musl": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-linux-x64-musl/-/resolver-binding-linux-x64-musl-1.12.2.tgz",
      "integrity": "sha512-azrt6+5ydLd8Vt210AAFis/lZevSfPw93EJRIJG+xPu4WCJ8K0kppCTpMyLPcKT7H15M4Jnt2tMp5bOvCkRC6A==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "linux"
      ]
    },
    "node_modules/unrs-resolver/node_modules/@unrs/resolver-binding-openharmony-arm64": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-openharmony-arm64/-/resolver-binding-openharmony-arm64-1.12.2.tgz",
      "integrity": "sha512-YZ9hP4O0X9PQb8eO980qmLNGH4zT3I9+SZTdt0Pr0YyuGQhYKoOZkV02VzrzyOZJ5xIJ3UFIenKkUkGg8GjgWQ==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "openharmony"
      ]
    },
    "node_modules/unrs-resolver/node_modules/@unrs/resolver-binding-wasm32-wasi": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-wasm32-wasi/-/resolver-binding-wasm32-wasi-1.12.2.tgz",
      "integrity": "sha512-tYFDIkMxSflfEc/h92ZWNsZlHSwgimbNHSO3PL2JWQHfCuC2q316jMyYU9TIWZsFK2bQwyK5VAdYgn8ygPj69A==",
      "cpu": [
        "wasm32"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "dependencies": {
        "@emnapi/core": "1.10.0",
        "@emnapi/runtime": "1.10.0",
        "@napi-rs/wasm-runtime": "^1.1.4"
      },
      "engines": {
        "node": ">=14.0.0"
      }
    },
    "node_modules/unrs-resolver/node_modules/@unrs/resolver-binding-win32-arm64-msvc": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-win32-arm64-msvc/-/resolver-binding-win32-arm64-msvc-1.12.2.tgz",
      "integrity": "sha512-qzNyg3xL0VPQmCaUh+N5jSitce6k+uCBfMDesWRnlULOZaqUkaJ0ybdT+UqlAWJoQjuqfIU/0Ptx9bteN4D82g==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ]
    },
    "node_modules/unrs-resolver/node_modules/@unrs/resolver-binding-win32-ia32-msvc": {
      "version": "1.12.2",
      "resolved": "https://registry.npmjs.org/@unrs/resolver-binding-win32-ia32-msvc/-/resolver-binding-win32-ia32-msvc-1.12.2.tgz",
      "integrity": "sha512-WD9sY00OfpHVGfsnHZoA8jVT+esS/Bg8z8jzxp5BnDCjjwsuKsPQrzswwpFy4J1AUJbXPRfkpcX0mXrzeXW79g==",
      "cpu": [
        "ia32"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ]
    },
    "node_modules/uri-js": {
      "version": "4.4.1",
      "dev": true,
      "license": "BSD-2-Clause",
      "dependencies": {
        "punycode": "^2.1.0"
      }
    },
    "node_modules/vitest": {
      "version": "4.1.10",
      "resolved": "https://registry.npmjs.org/vitest/-/vitest-4.1.10.tgz",
      "integrity": "sha512-R9jUTe5S4Qb0HCd4TNqpC7oGcrMssMRGXLW80ubjWsW9VH5GF8y1Y0SFLY9AbqSk6nt0PnOx4H4WNJYZ13GUPw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@vitest/expect": "4.1.10",
        "@vitest/mocker": "4.1.10",
        "@vitest/pretty-format": "4.1.10",
        "@vitest/runner": "4.1.10",
        "@vitest/snapshot": "4.1.10",
        "@vitest/spy": "4.1.10",
        "@vitest/utils": "4.1.10",
        "es-module-lexer": "^2.0.0",
        "expect-type": "^1.3.0",
        "magic-string": "^0.30.21",
        "obug": "^2.1.1",
        "pathe": "^2.0.3",
        "picomatch": "^4.0.3",
        "std-env": "^4.0.0-rc.1",
        "tinybench": "^2.9.0",
        "tinyexec": "^1.0.2",
        "tinyglobby": "^0.2.15",
        "tinyrainbow": "^3.1.0",
        "vite": "^6.0.0 || ^7.0.0 || ^8.0.0",
        "why-is-node-running": "^2.3.0"
      },
      "bin": {
        "vitest": "vitest.mjs"
      },
      "engines": {
        "node": "^20.0.0 || ^22.0.0 || >=24.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/vitest"
      },
      "peerDependencies": {
        "@edge-runtime/vm": "*",
        "@opentelemetry/api": "^1.9.0",
        "@types/node": "^20.0.0 || ^22.0.0 || >=24.0.0",
        "@vitest/browser-playwright": "4.1.10",
        "@vitest/browser-preview": "4.1.10",
        "@vitest/browser-webdriverio": "4.1.10",
        "@vitest/coverage-istanbul": "4.1.10",
        "@vitest/coverage-v8": "4.1.10",
        "@vitest/ui": "4.1.10",
        "happy-dom": "*",
        "jsdom": "*",
        "vite": "^6.0.0 || ^7.0.0 || ^8.0.0"
      },
      "peerDependenciesMeta": {
        "@edge-runtime/vm": {
          "optional": true
        },
        "@opentelemetry/api": {
          "optional": true
        },
        "@types/node": {
          "optional": true
        },
        "@vitest/browser-playwright": {
          "optional": true
        },
        "@vitest/browser-preview": {
          "optional": true
        },
        "@vitest/browser-webdriverio": {
          "optional": true
        },
        "@vitest/coverage-istanbul": {
          "optional": true
        },
        "@vitest/coverage-v8": {
          "optional": true
        },
        "@vitest/ui": {
          "optional": true
        },
        "happy-dom": {
          "optional": true
        },
        "jsdom": {
          "optional": true
        },
        "vite": {
          "optional": false
        }
      }
    },
    "node_modules/vitest/node_modules/@vitest/mocker": {
      "version": "4.1.10",
      "resolved": "https://registry.npmjs.org/@vitest/mocker/-/mocker-4.1.10.tgz",
      "integrity": "sha512-v0xaezt+DKEmKfaxg133ldzADrwLGd7Ze1MfQQTYfvs8OqZIwbxyxaYURivwV7sWy5fqn3rH5uOrSp07bp44Ow==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@vitest/spy": "4.1.10",
        "estree-walker": "^3.0.3",
        "magic-string": "^0.30.21"
      },
      "funding": {
        "url": "https://opencollective.com/vitest"
      },
      "peerDependencies": {
        "msw": "^2.4.9",
        "vite": "^6.0.0 || ^7.0.0 || ^8.0.0"
      },
      "peerDependenciesMeta": {
        "msw": {
          "optional": true
        },
        "vite": {
          "optional": true
        }
      }
    },
    "node_modules/vitest/node_modules/vite": {
      "version": "8.1.4",
      "resolved": "https://registry.npmjs.org/vite/-/vite-8.1.4.tgz",
      "integrity": "sha512-bTT9PsdWO+MQMNG9ZXIP/qM9wGh37DFxTV/sPq9cFpHr3w4jkgef032PkAL9jAqhk3Nz8NQw3O8n6/xFkqO4QQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "lightningcss": "^1.32.0",
        "picomatch": "^4.0.5",
        "postcss": "^8.5.16",
        "rolldown": "~1.1.4",
        "tinyglobby": "^0.2.17"
      },
      "bin": {
        "vite": "bin/vite.js"
      },
      "engines": {
        "node": "^20.19.0 || >=22.12.0"
      },
      "funding": {
        "url": "https://github.com/vitejs/vite?sponsor=1"
      },
      "optionalDependencies": {
        "fsevents": "~2.3.3"
      },
      "peerDependencies": {
        "@types/node": "^20.19.0 || >=22.12.0",
        "@vitejs/devtools": "^0.3.0",
        "esbuild": "^0.27.0 || ^0.28.0",
        "jiti": ">=1.21.0",
        "less": "^4.0.0",
        "sass": "^1.70.0",
        "sass-embedded": "^1.70.0",
        "stylus": ">=0.54.8",
        "sugarss": "^5.0.0",
        "terser": "^5.16.0",
        "tsx": "^4.8.1",
        "yaml": "^2.4.2"
      },
      "peerDependenciesMeta": {
        "@types/node": {
          "optional": true
        },
        "@vitejs/devtools": {
          "optional": true
        },
        "esbuild": {
          "optional": true
        },
        "jiti": {
          "optional": true
        },
        "less": {
          "optional": true
        },
        "sass": {
          "optional": true
        },
        "sass-embedded": {
          "optional": true
        },
        "stylus": {
          "optional": true
        },
        "sugarss": {
          "optional": true
        },
        "terser": {
          "optional": true
        },
        "tsx": {
          "optional": true
        },
        "yaml": {
          "optional": true
        }
      }
    },
    "node_modules/which": {
      "version": "2.0.2",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "isexe": "^2.0.0"
      },
      "bin": {
        "node-which": "bin/node-which"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/which-boxed-primitive": {
      "version": "1.1.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-bigint": "^1.1.0",
        "is-boolean-object": "^1.2.1",
        "is-number-object": "^1.1.1",
        "is-string": "^1.1.1",
        "is-symbol": "^1.1.1"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/which-builtin-type": {
      "version": "1.2.1",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "call-bound": "^1.0.2",
        "function.prototype.name": "^1.1.6",
        "has-tostringtag": "^1.0.2",
        "is-async-function": "^2.0.0",
        "is-date-object": "^1.1.0",
        "is-finalizationregistry": "^1.1.0",
        "is-generator-function": "^1.0.10",
        "is-regex": "^1.2.1",
        "is-weakref": "^1.0.2",
        "isarray": "^2.0.5",
        "which-boxed-primitive": "^1.1.0",
        "which-collection": "^1.0.2",
        "which-typed-array": "^1.1.16"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/which-collection": {
      "version": "1.0.2",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-map": "^2.0.3",
        "is-set": "^2.0.3",
        "is-weakmap": "^2.0.2",
        "is-weakset": "^2.0.3"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/which-typed-array": {
      "version": "1.1.22",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "available-typed-arrays": "^1.0.7",
        "call-bind": "^1.0.9",
        "call-bound": "^1.0.4",
        "for-each": "^0.3.5",
        "get-proto": "^1.0.1",
        "gopd": "^1.2.0",
        "has-tostringtag": "^1.0.2"
      },
      "engines": {
        "node": ">= 0.4"
      },
      "funding": {
        "url": "https://github.com/sponsors/ljharb"
      }
    },
    "node_modules/why-is-node-running": {
      "version": "2.3.0",
      "resolved": "https://registry.npmjs.org/why-is-node-running/-/why-is-node-running-2.3.0.tgz",
      "integrity": "sha512-hUrmaWBdVDcxvYqnyh09zunKzROWjbZTiNy8dBEjkS7ehEDQibXJ7XvlmtbwuTclUiIyN+CyXQD4Vmko8fNm8w==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "siginfo": "^2.0.0",
        "stackback": "0.0.2"
      },
      "bin": {
        "why-is-node-running": "cli.js"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/word-wrap": {
      "version": "1.2.5",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/wrappy": {
      "version": "1.0.2",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/yocto-queue": {
      "version": "0.1.0",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    }
  }
}
```

### prisma\schema.prisma

`$lang
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model BusinessProfile {
  id                    String           @id @default(cuid())
  name                  String
  googleLocationName    String?
  websiteUrl            String?
  phone                 String?
  industry              String?
  address               String?
  reviewUrl             String?
  detectionSensitivity  Int              @default(65)
  createdAt             DateTime         @default(now())
  updatedAt             DateTime         @updatedAt
  reviews               Review[]
  alerts                Alert[]
  evidencePackets       EvidencePacket[]
  googleCredential      GoogleCredential?
}

model Review {
  id                  String           @id @default(cuid())
  businessProfileId   String
  businessProfile     BusinessProfile  @relation(fields: [businessProfileId], references: [id], onDelete: Cascade)
  googleReviewId      String?          @unique
  reviewerName        String
  reviewerProfileUrl  String?
  rating              Int
  comment             String
  reviewDate          DateTime
  reply               String?
  sourceUrl           String?
  source              String           @default("MANUAL")
  status              String           @default("NEW")
  suspicionScore      Int              @default(0)
  suspicionLevel      String           @default("LOW")
  analyzedAt          DateTime?
  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt
  signals             DetectionSignal[]
  responseDrafts      ResponseDraft[]

  @@index([businessProfileId, reviewDate])
  @@index([businessProfileId, suspicionScore])
  @@index([businessProfileId, status])
}

model DetectionSignal {
  id          String   @id @default(cuid())
  reviewId    String
  review      Review   @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  type        String
  label       String
  explanation String
  weight      Int
  severity    String   @default("WATCH")
  createdAt   DateTime @default(now())
}

model Alert {
  id                 String          @id @default(cuid())
  businessProfileId  String
  businessProfile    BusinessProfile @relation(fields: [businessProfileId], references: [id], onDelete: Cascade)
  title              String
  message            String
  severity           String          @default("INFO")
  createdAt          DateTime        @default(now())
  resolvedAt         DateTime?

  @@index([businessProfileId, createdAt])
}

model ResponseDraft {
  id        String   @id @default(cuid())
  reviewId  String
  review    Review   @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  tone      String   @default("professional")
  content   String
  createdAt DateTime @default(now())
}

model EvidencePacket {
  id                 String          @id @default(cuid())
  businessProfileId  String
  businessProfile    BusinessProfile @relation(fields: [businessProfileId], references: [id], onDelete: Cascade)
  title              String
  summary            String
  reviewIdsJson      String
  contentHtml        String
  createdAt          DateTime        @default(now())

  @@index([businessProfileId, createdAt])
}

model GoogleCredential {
  id                 String          @id @default(cuid())
  businessProfileId  String          @unique
  businessProfile    BusinessProfile @relation(fields: [businessProfileId], references: [id], onDelete: Cascade)
  accessToken        String
  refreshToken       String?
  scope              String?
  tokenType          String?
  expiresAt          DateTime?
  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt
}
```

### prisma\seed.mjs

`$lang
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const profileData = {
  name: "BrightLine Dental Studio",
  googleLocationName: "accounts/000/locations/brightline-demo",
  websiteUrl: "https://brightline.example.com",
  phone: "(555) 014-2030",
  industry: "Dental clinic",
  address: "214 Market Street, Indianapolis, IN",
  reviewUrl: "https://g.page/r/demo-review-link",
  detectionSensitivity: 65
};

const demoReviews = [
  {
    reviewerName: "Maya Chen",
    rating: 5,
    comment: "The hygienist explained everything clearly and the front desk was friendly. Booking was easy and the visit started on time.",
    reviewDate: "2026-07-01T14:20:00.000Z",
    reply: "Thank you, Maya. We appreciate the kind words.",
    source: "DEMO"
  },
  {
    reviewerName: "J Thompson",
    rating: 1,
    comment: "Worst place ever. Avoid this business. Scam service and rude people.",
    reviewDate: "2026-07-04T09:03:00.000Z",
    source: "DEMO",
    reviewerProfileUrl: ""
  },
  {
    reviewerName: "Local Guide 9182",
    rating: 1,
    comment: "Worst place ever. Avoid this business. Scam service and rude people.",
    reviewDate: "2026-07-04T09:24:00.000Z",
    source: "DEMO",
    reviewerProfileUrl: ""
  },
  {
    reviewerName: "Aaron P",
    rating: 2,
    comment: "They called me after I declined their marketing vendor. Now they deserve one star.",
    reviewDate: "2026-07-04T10:01:00.000Z",
    source: "DEMO"
  },
  {
    reviewerName: "Priya Shah",
    rating: 4,
    comment: "Good care and clean office. I had to wait about 10 minutes, but the team apologized and kept me updated.",
    reviewDate: "2026-06-28T17:10:00.000Z",
    reply: "Thank you for the feedback, Priya.",
    source: "DEMO"
  },
  {
    reviewerName: "Noah Miller",
    rating: 1,
    comment: "Bad service.",
    reviewDate: "2026-07-05T12:44:00.000Z",
    source: "DEMO",
    reviewerProfileUrl: ""
  },
  {
    reviewerName: "Elena Garcia",
    rating: 5,
    comment: "I needed a same-day appointment and they helped me quickly. Great communication.",
    reviewDate: "2026-06-24T15:30:00.000Z",
    reply: "Thanks, Elena. We are glad we could help.",
    source: "DEMO"
  },
  {
    reviewerName: "One Star Reviews",
    rating: 1,
    comment: "Your competitor across town is much better. Do not waste your money here.",
    reviewDate: "2026-07-05T13:01:00.000Z",
    source: "DEMO"
  }
];

function levelForScore(score) {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}

function buildDemoSignals(review) {
  const signals = [];
  const comment = review.comment.toLowerCase();

  if (review.rating <= 2) {
    signals.push({
      type: "LOW_RATING",
      label: "Low-star review",
      explanation: "The review is one or two stars, so it has a higher reputation impact and deserves review before a public response.",
      weight: review.rating === 1 ? 14 : 9,
      severity: review.rating === 1 ? "WARNING" : "WATCH"
    });
  }

  if (!review.reviewerProfileUrl || review.reviewerProfileUrl.trim().length < 8) {
    signals.push({
      type: "SPARSE_REVIEWER_METADATA",
      label: "Sparse reviewer metadata",
      explanation: "The reviewer profile URL is missing or incomplete. This does not prove fraud, but it weakens reviewer context.",
      weight: 11,
      severity: "WATCH"
    });
  }

  if (review.rating <= 2 && review.comment.trim().length <= 24) {
    signals.push({
      type: "SHORT_LOW_CONTEXT",
      label: "Short low-context complaint",
      explanation: "The review has very little detail for a low rating, which makes it harder to verify against customer records.",
      weight: 13,
      severity: "WARNING"
    });
  }

  const phraseHits = ["scam", "avoid this business", "worst place ever", "competitor", "declined", "one star"].filter(
    (phrase) => comment.includes(phrase)
  );
  if (phraseHits.length > 0) {
    signals.push({
      type: "SUSPICIOUS_LANGUAGE",
      label: "Suspicious wording",
      explanation: `The review contains high-intensity or attack-like wording: ${phraseHits.join(", ")}.`,
      weight: Math.min(24, 8 + phraseHits.length * 5),
      severity: "WARNING"
    });
  }

  const reviewDate = new Date(review.reviewDate);
  const lowStarBurstCount = demoReviews.filter((candidate) => {
    const candidateDate = new Date(candidate.reviewDate);
    const hours = Math.abs(candidateDate.getTime() - reviewDate.getTime()) / 1000 / 60 / 60;
    return candidate !== review && candidate.rating <= 2 && review.rating <= 2 && hours <= 48;
  }).length;

  if (lowStarBurstCount >= 2) {
    signals.push({
      type: "LOW_STAR_BURST",
      label: "Low-star burst",
      explanation: `${lowStarBurstCount + 1} low-star reviews landed within a 48-hour window.`,
      weight: Math.min(30, 16 + lowStarBurstCount * 4),
      severity: "CRITICAL"
    });
  }

  const repeated = demoReviews.some(
    (candidate) => candidate !== review && candidate.comment.toLowerCase() === review.comment.toLowerCase()
  );
  if (repeated) {
    signals.push({
      type: "REPEATED_WORDING",
      label: "Repeated wording",
      explanation: "This review uses the same wording as another recent review in the demo data.",
      weight: 28,
      severity: "CRITICAL"
    });
  }

  if (!review.reply && review.rating <= 3) {
    signals.push({
      type: "NO_OWNER_RESPONSE",
      label: "No owner response",
      explanation: "There is no public owner reply yet. A careful response can reduce reputational damage while evidence is collected.",
      weight: 6,
      severity: "INFO"
    });
  }

  const suspicionScore = Math.min(
    100,
    signals.reduce((sum, signal) => sum + signal.weight, 0)
  );

  return {
    suspicionScore,
    suspicionLevel: levelForScore(suspicionScore),
    signals
  };
}

async function main() {
  const profile = await prisma.businessProfile.upsert({
    where: { id: "demo-business-profile" },
    update: profileData,
    create: {
      id: "demo-business-profile",
      ...profileData
    }
  });

  await prisma.responseDraft.deleteMany({
    where: {
      review: {
        businessProfileId: profile.id
      }
    }
  });
  await prisma.detectionSignal.deleteMany({
    where: {
      review: {
        businessProfileId: profile.id
      }
    }
  });
  await prisma.alert.deleteMany({ where: { businessProfileId: profile.id } });
  await prisma.evidencePacket.deleteMany({ where: { businessProfileId: profile.id } });
  await prisma.googleCredential.deleteMany({ where: { businessProfileId: profile.id } });
  await prisma.review.deleteMany({ where: { businessProfileId: profile.id } });

  for (const review of demoReviews) {
    const analysis = buildDemoSignals(review);
    await prisma.review.create({
      data: {
        ...review,
        businessProfileId: profile.id,
        reviewDate: new Date(review.reviewDate),
        suspicionScore: analysis.suspicionScore,
        suspicionLevel: analysis.suspicionLevel,
        analyzedAt: new Date(),
        signals: {
          create: analysis.signals
        }
      }
    });
  }

  await prisma.alert.createMany({
    data: [
      {
        businessProfileId: profile.id,
        title: "Low-star review burst detected",
        message: "Four low-star reviews arrived within a 48-hour period. Review them before replying publicly.",
        severity: "CRITICAL"
      },
      {
        businessProfileId: profile.id,
        title: "Repeated wording found",
        message: "Two recent one-star reviews use nearly identical phrasing.",
        severity: "WARNING"
      }
    ]
  });

  console.log("Seeded demo business profile and reviews.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### README.md

`$lang
# Google Fake Review Detector

ReviewShield is a local-first Next.js app for monitoring suspicious Google review patterns, drafting careful public replies, managing review investigation status, and producing printable evidence packets.

## Features

- Dashboard metrics for total reviews, rating average, suspicious review counts, unanswered low reviews, active alerts, and recent evidence packets.
- Manual review entry with immediate analysis.
- CSV import with duplicate skipping, quoted commas, and quoted multiline fields.
- Detection signals for low ratings, sparse reviewer metadata, suspicious wording, generic complaints, bursts, repeated wording, and missing owner replies.
- Review queue filtering by search text, risk level, rating, and actionable status.
- Review detail actions for re-analysis, response draft generation, status updates, and evidence packet creation.
- Alert resolution and reopening.
- Evidence packet generation with escaped HTML and print support.
- Google OAuth token exchange, token refresh, Business Profile review sync, and Google review upsert by review ID.
- Vitest coverage for CSV parsing, detection scoring, and evidence HTML escaping.

## Quick Start

```powershell
npm install
npm run db:push
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

## Verification

```powershell
npx prisma validate
npm run check
npm run lint
npm test
npm run build
npm audit
```

## Google Business Profile Sync

Demo, manual, and CSV modes work without Google credentials. Live Google sync requires:

- A Google Cloud OAuth client.
- Business Profile API access for the authenticated Google account.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in `.env`.
- The business profile setting `Google location name`, using the format `accounts/{accountId}/locations/{locationId}`.

Example `.env`:

```env
DATABASE_URL="file:./dev.db"
APP_BASE_URL="http://localhost:3000"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="http://localhost:3000/api/google/callback"
```

After setting credentials, open Settings, save the Google location name, connect Google, then run Sync reviews.

## Notes

- The default SQLite database is intended for local use. Use persistent database storage before deploying to a serverless or ephemeral environment.
- `.env`, local SQLite files, generated build output, and TypeScript build info are ignored by git.
```

### tests\csv.test.ts

`$lang
import { describe, expect, it } from "vitest";
import { parseReviewsCsv } from "@/lib/csv";

describe("parseReviewsCsv", () => {
  it("parses quoted commas and newlines", () => {
    const reviews = parseReviewsCsv(`reviewerName,rating,comment,reviewDate
Jordan Lee,1,"Bad service, no context
with a second line",2026-07-06`);

    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({
      reviewerName: "Jordan Lee",
      rating: 1,
      comment: "Bad service, no context\nwith a second line"
    });
  });

  it("rejects decimal ratings before Prisma writes", () => {
    expect(() =>
      parseReviewsCsv(`reviewerName,rating,comment,reviewDate
Sam Patel,4.5,Clear communication,2026-07-05`)
    ).toThrow("whole number");
  });
});
```

### tests\detection.test.ts

`$lang
import type { Review } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { analyzeReview } from "@/lib/detection";

function makeReview(overrides: Partial<Review>): Review {
  const now = new Date("2026-07-06T12:00:00.000Z");

  return {
    id: "review-1",
    businessProfileId: "profile-1",
    googleReviewId: null,
    reviewerName: "Reviewer",
    reviewerProfileUrl: null,
    rating: 1,
    comment: "Worst place ever. Avoid this business.",
    reviewDate: now,
    reply: null,
    sourceUrl: null,
    source: "MANUAL",
    status: "NEW",
    suspicionScore: 0,
    suspicionLevel: "LOW",
    analyzedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("analyzeReview", () => {
  it("flags low-context suspicious reviews", () => {
    const review = makeReview({});
    const result = analyzeReview(review, [review]);

    expect(result.score).toBeGreaterThanOrEqual(35);
    expect(result.signals.map((signal) => signal.type)).toContain("SUSPICIOUS_LANGUAGE");
    expect(result.signals.map((signal) => signal.type)).toContain("NO_OWNER_RESPONSE");
  });

  it("detects repeated wording across reviews", () => {
    const review = makeReview({ id: "review-1", reviewerName: "A" });
    const repeated = makeReview({ id: "review-2", reviewerName: "B" });
    const result = analyzeReview(review, [review, repeated]);

    expect(result.signals.map((signal) => signal.type)).toContain("REPEATED_WORDING");
  });
});
```

### tests\evidence.test.ts

`$lang
import type { BusinessProfile, DetectionSignal, Review } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildEvidenceHtml } from "@/lib/evidence";

describe("buildEvidenceHtml", () => {
  it("escapes user-supplied review content", () => {
    const now = new Date("2026-07-06T12:00:00.000Z");
    const profile = {
      id: "profile-1",
      name: "<Clinic>",
      googleLocationName: null,
      websiteUrl: null,
      phone: null,
      industry: null,
      address: null,
      reviewUrl: null,
      detectionSensitivity: 65,
      createdAt: now,
      updatedAt: now
    } satisfies BusinessProfile;
    const review = {
      id: "review-1",
      businessProfileId: profile.id,
      googleReviewId: null,
      reviewerName: "<script>",
      reviewerProfileUrl: null,
      rating: 1,
      comment: "<img src=x onerror=alert(1)>",
      reviewDate: now,
      reply: null,
      sourceUrl: null,
      source: "MANUAL",
      status: "NEW",
      suspicionScore: 80,
      suspicionLevel: "CRITICAL",
      analyzedAt: now,
      createdAt: now,
      updatedAt: now,
      signals: []
    } satisfies Review & { signals: DetectionSignal[] };

    const html = buildEvidenceHtml(profile, [review]);

    expect(html).toContain("&lt;Clinic&gt;");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<script>");
  });
});
```

### tsconfig.json

`$lang
{
  "compilerOptions": {
    "target": "es2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### vitest.config.ts

`$lang
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url))
    }
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
```
