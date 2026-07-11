import type { BusinessProfile, DetectionSignal, Review } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildEvidenceHtml } from "@/lib/evidence";

describe("buildEvidenceHtml", () => {
  it("escapes user-supplied review content", () => {
    const now = new Date("2026-07-06T12:00:00.000Z");
    const profile = {
      id: "profile-1",
      name: "<Clinic>",
      googleLocationName: null,
      websiteUrl: null,
      phone: null,
      industry: null,
      address: null,
      reviewUrl: null,
      detectionSensitivity: 65,
      createdAt: now,
      updatedAt: now
    } satisfies BusinessProfile;
    const review = {
      id: "review-1",
      businessProfileId: profile.id,
      googleReviewId: null,
      reviewerName: "<script>",
      reviewerProfileUrl: null,
      rating: 1,
      comment: "<img src=x onerror=alert(1)>",
      reviewDate: now,
      reply: null,
      sourceUrl: null,
      source: "MANUAL",
      status: "NEW",
      suspicionScore: 80,
      suspicionLevel: "CRITICAL",
      analyzedAt: now,
      createdAt: now,
      updatedAt: now,
      signals: []
    } satisfies Review & { signals: DetectionSignal[] };

    const html = buildEvidenceHtml(profile, [review]);

    expect(html).toContain("&lt;Clinic&gt;");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<script>");
  });
});
