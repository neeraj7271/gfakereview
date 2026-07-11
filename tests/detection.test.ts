import type { Review } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { analyzeReview } from "@/lib/detection";

function makeReview(overrides: Partial<Review>): Review {
  const now = new Date("2026-07-06T12:00:00.000Z");

  return {
    id: "review-1",
    businessProfileId: "profile-1",
    googleReviewId: null,
    reviewerName: "Reviewer",
    reviewerProfileUrl: null,
    rating: 1,
    comment: "Worst place ever. Avoid this business.",
    reviewDate: now,
    reply: null,
    sourceUrl: null,
    source: "MANUAL",
    status: "NEW",
    suspicionScore: 0,
    suspicionLevel: "LOW",
    analyzedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("analyzeReview", () => {
  it("flags low-context suspicious reviews", () => {
    const review = makeReview({});
    const result = analyzeReview(review, [review]);

    expect(result.score).toBeGreaterThanOrEqual(35);
    expect(result.signals.map((signal) => signal.type)).toContain("SUSPICIOUS_LANGUAGE");
    expect(result.signals.map((signal) => signal.type)).toContain("NO_OWNER_RESPONSE");
  });

  it("detects repeated wording across reviews", () => {
    const review = makeReview({ id: "review-1", reviewerName: "A" });
    const repeated = makeReview({ id: "review-2", reviewerName: "B" });
    const result = analyzeReview(review, [review, repeated]);

    expect(result.signals.map((signal) => signal.type)).toContain("REPEATED_WORDING");
  });
});
