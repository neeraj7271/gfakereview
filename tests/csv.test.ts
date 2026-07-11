import { describe, expect, it } from "vitest";
import { parseReviewsCsv } from "@/lib/csv";

describe("parseReviewsCsv", () => {
  it("parses quoted commas and newlines", () => {
    const reviews = parseReviewsCsv(`reviewerName,rating,comment,reviewDate
Jordan Lee,1,"Bad service, no context
with a second line",2026-07-06`);

    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({
      reviewerName: "Jordan Lee",
      rating: 1,
      comment: "Bad service, no context\nwith a second line"
    });
  });

  it("rejects decimal ratings before Prisma writes", () => {
    expect(() =>
      parseReviewsCsv(`reviewerName,rating,comment,reviewDate
Sam Patel,4.5,Clear communication,2026-07-05`)
    ).toThrow("whole number");
  });
});
