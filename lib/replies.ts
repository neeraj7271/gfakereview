import type { BusinessProfile, Review } from "@prisma/client";

export function draftPublicReply(review: Review, profile: BusinessProfile) {
  const businessName = profile.name;
  const contactLine = profile.phone
    ? `Please contact us at ${profile.phone} so we can look into this directly.`
    : "Please contact our team directly so we can look into this.";

  if (review.suspicionScore >= 60) {
    return [
      `Thank you for sharing feedback about ${businessName}.`,
      "We take reviews seriously, but we are not able to match this description to a recent customer experience from the details provided.",
      contactLine,
      "We want to understand what happened and resolve any legitimate concern."
    ].join(" ");
  }

  if (review.rating <= 2) {
    return [
      `Thank you for bringing this to our attention.`,
      "We are sorry your experience did not meet expectations.",
      contactLine,
      "Your feedback helps us improve how we serve customers."
    ].join(" ");
  }

  return [
    `Thank you for the review and for choosing ${businessName}.`,
    "We appreciate the feedback and will share it with the team."
  ].join(" ");
}
