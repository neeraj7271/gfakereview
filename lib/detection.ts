import type { Review } from "@prisma/client";
import { clamp } from "@/lib/format";

export type SignalSeverity = "INFO" | "WATCH" | "WARNING" | "CRITICAL";
export type SuspicionLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type SignalInput = {
  type: string;
  label: string;
  explanation: string;
  weight: number;
  severity: SignalSeverity;
};

export type DetectionResult = {
  score: number;
  level: SuspicionLevel;
  signals: SignalInput[];
};

const suspiciousPhrases = [
  "scam",
  "fraud",
  "avoid this business",
  "worst place ever",
  "do not waste your money",
  "competitor",
  "marketing vendor",
  "declined",
  "one star"
];

const genericShortPhrases = [
  "bad service",
  "terrible",
  "worst",
  "never again",
  "avoid"
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value: string) {
  return new Set(normalizeText(value).split(" ").filter((token) => token.length > 2));
}

function jaccardSimilarity(left: string, right: string) {
  const a = tokenSet(left);
  const b = tokenSet(right);

  if (!a.size || !b.size) {
    return 0;
  }

  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

function hoursBetween(left: Date, right: Date) {
  return Math.abs(left.getTime() - right.getTime()) / 1000 / 60 / 60;
}

function levelForScore(score: number): SuspicionLevel {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}

export function analyzeReview(review: Review, allReviews: Review[]): DetectionResult {
  const signals: SignalInput[] = [];
  const comment = normalizeText(review.comment);

  if (review.rating <= 2) {
    signals.push({
      type: "LOW_RATING",
      label: "Low-star review",
      explanation: "The review is one or two stars, so it has a higher reputation impact and deserves review before a public response.",
      weight: review.rating === 1 ? 14 : 9,
      severity: review.rating === 1 ? "WARNING" : "WATCH"
    });
  }

  if (!review.reviewerProfileUrl || review.reviewerProfileUrl.trim().length < 8) {
    signals.push({
      type: "SPARSE_REVIEWER_METADATA",
      label: "Sparse reviewer metadata",
      explanation: "The reviewer profile URL is missing or incomplete. This does not prove fraud, but it weakens reviewer context.",
      weight: 11,
      severity: "WATCH"
    });
  }

  if (review.comment.trim().length <= 24 && review.rating <= 2) {
    signals.push({
      type: "SHORT_LOW_CONTEXT",
      label: "Short low-context complaint",
      explanation: "The review has very little detail for a low rating, which makes it harder to verify against customer records.",
      weight: 13,
      severity: "WARNING"
    });
  }

  const phraseHits = suspiciousPhrases.filter((phrase) => comment.includes(phrase));
  if (phraseHits.length > 0) {
    signals.push({
      type: "SUSPICIOUS_LANGUAGE",
      label: "Suspicious wording",
      explanation: `The review contains high-intensity or attack-like wording: ${phraseHits.join(", ")}.`,
      weight: Math.min(24, 8 + phraseHits.length * 5),
      severity: "WARNING"
    });
  }

  const genericHits = genericShortPhrases.filter((phrase) => comment === phrase || comment.includes(phrase));
  if (genericHits.length > 0 && comment.split(" ").length <= 8) {
    signals.push({
      type: "GENERIC_COMPLAINT",
      label: "Generic complaint",
      explanation: "The complaint is broad and hard to match to a specific customer experience.",
      weight: 9,
      severity: "WATCH"
    });
  }

  const lowStarBurstCount = allReviews.filter((candidate) => {
    return (
      candidate.id !== review.id &&
      candidate.rating <= 2 &&
      review.rating <= 2 &&
      hoursBetween(candidate.reviewDate, review.reviewDate) <= 48
    );
  }).length;

  if (lowStarBurstCount >= 2) {
    signals.push({
      type: "LOW_STAR_BURST",
      label: "Low-star burst",
      explanation: `${lowStarBurstCount + 1} low-star reviews landed within a 48-hour window.`,
      weight: Math.min(30, 16 + lowStarBurstCount * 4),
      severity: "CRITICAL"
    });
  }

  const similarReview = allReviews
    .filter((candidate) => candidate.id !== review.id)
    .map((candidate) => ({
      candidate,
      similarity: jaccardSimilarity(review.comment, candidate.comment)
    }))
    .sort((a, b) => b.similarity - a.similarity)[0];

  if (similarReview && similarReview.similarity >= 0.72) {
    signals.push({
      type: "REPEATED_WORDING",
      label: "Repeated wording",
      explanation: `This review is ${Math.round(similarReview.similarity * 100)}% similar to another review from ${similarReview.candidate.reviewerName}.`,
      weight: 28,
      severity: "CRITICAL"
    });
  }

  if (!review.reply && review.rating <= 3) {
    signals.push({
      type: "NO_OWNER_RESPONSE",
      label: "No owner response",
      explanation: "There is no public owner reply yet. A careful response can reduce reputational damage while evidence is collected.",
      weight: 6,
      severity: "INFO"
    });
  }

  const rawScore = signals.reduce((sum, signal) => sum + signal.weight, 0);
  const score = clamp(rawScore, 0, 100);

  return {
    score,
    level: levelForScore(score),
    signals
  };
}

export function analyzeAllReviews(reviews: Review[]) {
  return reviews.map((review) => ({
    review,
    result: analyzeReview(review, reviews)
  }));
}
