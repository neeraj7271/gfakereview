import type { BusinessProfile, DetectionSignal, Review } from "@prisma/client";
import { formatDateTime } from "@/lib/format";

type ReviewWithSignals = Review & {
  signals: DetectionSignal[];
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildEvidenceHtml(profile: BusinessProfile, reviews: ReviewWithSignals[]) {
  const criticalCount = reviews.filter((review) => review.suspicionScore >= 80).length;
  const highCount = reviews.filter((review) => review.suspicionScore >= 60).length;
  const averageScore =
    reviews.length > 0
      ? Math.round(reviews.reduce((sum, review) => sum + review.suspicionScore, 0) / reviews.length)
      : 0;

  const rows = reviews
    .map((review) => {
      const signalText = review.signals
        .map((signal) => `${escapeHtml(signal.label)} (${signal.weight})`)
        .join(", ");

      return `<tr>
        <td>${escapeHtml(review.reviewerName)}</td>
        <td>${review.rating}</td>
        <td>${formatDateTime(review.reviewDate)}</td>
        <td>${review.suspicionScore} / ${escapeHtml(review.suspicionLevel)}</td>
        <td>${escapeHtml(signalText || "No signals recorded")}</td>
        <td>${escapeHtml(review.comment)}</td>
      </tr>`;
    })
    .join("");

  const timeline = reviews
    .slice()
    .sort((a, b) => a.reviewDate.getTime() - b.reviewDate.getTime())
    .map(
      (review) =>
        `<li><strong>${formatDateTime(review.reviewDate)}</strong>: ${escapeHtml(
          review.reviewerName
        )} left a ${review.rating}-star review with score ${review.suspicionScore}.</li>`
    )
    .join("");

  return `
    <h1>Suspicious Review Evidence Packet</h1>
    <p><strong>Business:</strong> ${escapeHtml(profile.name)}</p>
    <p><strong>Created:</strong> ${formatDateTime(new Date())}</p>
    <h2>Summary</h2>
    <p>This packet groups ${reviews.length} review(s) for internal review and potential Google escalation. Average suspicion score is ${averageScore}. Critical reviews: ${criticalCount}. High or higher reviews: ${highCount}.</p>
    <h2>Timeline</h2>
    <ol>${timeline}</ol>
    <h2>Review Evidence</h2>
    <table>
      <thead>
        <tr>
          <th>Reviewer</th>
          <th>Rating</th>
          <th>Date</th>
          <th>Risk</th>
          <th>Signals</th>
          <th>Comment</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <h2>Escalation Notes</h2>
    <p>Recommended next action: compare reviewer names and timestamps against customer records, document any mismatch, reply publicly without accusation, and escalate only reviews that violate platform policy or appear coordinated.</p>
  `;
}
