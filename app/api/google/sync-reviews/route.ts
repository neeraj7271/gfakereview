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
