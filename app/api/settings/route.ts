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
