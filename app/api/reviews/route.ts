import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDefaultProfile } from "@/lib/profile";
import { serializeReview } from "@/lib/serialize";

export async function GET() {
  const profile = await getDefaultProfile();
  const reviews = await db.review.findMany({
    where: { businessProfileId: profile.id },
    orderBy: { reviewDate: "desc" },
    include: {
      signals: true,
      responseDrafts: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  return NextResponse.json({ reviews: reviews.map(serializeReview) });
}
