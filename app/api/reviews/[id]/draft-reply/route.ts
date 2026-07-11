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
