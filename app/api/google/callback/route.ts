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
