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
