import type { DetectionSignal, ResponseDraft, Review } from "@prisma/client";
import type { SerializedReview } from "@/lib/types";

type ReviewWithRelations = Review & {
  signals?: DetectionSignal[];
  responseDrafts?: ResponseDraft[];
};

export function serializeReview(review: ReviewWithRelations): SerializedReview {
  return {
    id: review.id,
    reviewerName: review.reviewerName,
    reviewerProfileUrl: review.reviewerProfileUrl,
    rating: review.rating,
    comment: review.comment,
    reviewDate: review.reviewDate.toISOString(),
    reply: review.reply,
    sourceUrl: review.sourceUrl,
    source: review.source,
    status: review.status,
    suspicionScore: review.suspicionScore,
    suspicionLevel: review.suspicionLevel,
    analyzedAt: review.analyzedAt?.toISOString() ?? null,
    signals:
      review.signals?.map((signal) => ({
        id: signal.id,
        type: signal.type,
        label: signal.label,
        explanation: signal.explanation,
        weight: signal.weight,
        severity: signal.severity,
        createdAt: signal.createdAt.toISOString()
      })) ?? [],
    responseDrafts:
      review.responseDrafts?.map((draft) => ({
        id: draft.id,
        tone: draft.tone,
        content: draft.content,
        createdAt: draft.createdAt.toISOString()
      })) ?? []
  };
}
