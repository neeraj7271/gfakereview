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
