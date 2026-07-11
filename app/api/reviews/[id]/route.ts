import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDefaultProfile } from "@/lib/profile";
import { serializeReview } from "@/lib/serialize";

const allowedStatuses = new Set(["NEW", "REVIEWING", "RESPONDED", "ESCALATED", "DISMISSED"]);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = await db.review.findUnique({
    where: { id },
    include: {
      signals: true,
      responseDrafts: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!review) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }

  return NextResponse.json({ review: serializeReview(review) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getDefaultProfile();

  try {
    const body = (await request.json()) as { status?: unknown };
    const status = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";

    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ error: "Unsupported review status." }, { status: 400 });
    }

    const review = await db.review.findFirst({
      where: { id, businessProfileId: profile.id }
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found." }, { status: 404 });
    }

    const updated = await db.review.update({
      where: { id: review.id },
      data: { status },
      include: {
        signals: true,
        responseDrafts: {
          orderBy: { createdAt: "desc" }
        }
      }
    });

    return NextResponse.json({ review: serializeReview(updated) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update review status." },
      { status: 400 }
    );
  }
}
