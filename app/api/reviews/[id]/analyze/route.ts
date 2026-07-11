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
