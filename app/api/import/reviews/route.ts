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
