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
