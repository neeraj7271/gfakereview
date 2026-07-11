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
