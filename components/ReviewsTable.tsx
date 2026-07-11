"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { SerializedReview } from "@/lib/types";
import { badgeClass, formatDate, statusClass } from "@/lib/format";

export default function ReviewsTable({ reviews }: { reviews: SerializedReview[] }) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("ALL");
  const [rating, setRating] = useState("ALL");

  const filtered = useMemo(() => {
    return reviews.filter((review) => {
      const queryMatch =
        query.trim().length === 0 ||
        `${review.reviewerName} ${review.comment}`.toLowerCase().includes(query.toLowerCase());
      const levelMatch = level === "ALL" || review.suspicionLevel === level;
      const ratingMatch = rating === "ALL" || String(review.rating) === rating;
      return queryMatch && levelMatch && ratingMatch;
    });
  }, [level, query, rating, reviews]);

  return (
    <section className="panel">
      <div className="toolbar">
        <div style={{ flex: "1 1 260px" }}>
          <label className="form-row" htmlFor="review-search">
            <span className="muted">Search</span>
            <span style={{ position: "relative", display: "block" }}>
              <Search
                size={16}
                aria-hidden="true"
                style={{ position: "absolute", left: 12, top: 12, color: "var(--muted)" }}
              />
              <input
                id="review-search"
                className="field"
                style={{ paddingLeft: 36 }}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Reviewer or comment search"
              />
            </span>
          </label>
        </div>
        <label className="form-row" htmlFor="level-filter">
          <span className="muted">Risk</span>
          <select id="level-filter" className="select" value={level} onChange={(event) => setLevel(event.target.value)}>
            <option value="ALL">All risk</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </label>
        <label className="form-row" htmlFor="rating-filter">
          <span className="muted">Rating</span>
          <select id="rating-filter" className="select" value={rating} onChange={(event) => setRating(event.target.value)}>
            <option value="ALL">All ratings</option>
            <option value="1">1 star</option>
            <option value="2">2 stars</option>
            <option value="3">3 stars</option>
            <option value="4">4 stars</option>
            <option value="5">5 stars</option>
          </select>
        </label>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Reviewer</th>
              <th>Rating</th>
              <th>Comment</th>
              <th>Risk</th>
              <th>Signals</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((review) => (
              <tr key={review.id}>
                <td>
                  <Link href={`/reviews/${review.id}`}>{review.reviewerName}</Link>
                </td>
                <td>{review.rating}</td>
                <td className="review-comment">{review.comment}</td>
                <td>
                  <span className={badgeClass(review.suspicionLevel)}>
                    {review.suspicionScore} {review.suspicionLevel.toLowerCase()}
                  </span>
                </td>
                <td>{review.signals.length}</td>
                <td>
                  <span className={statusClass(review.status)}>{review.status.toLowerCase()}</span>
                </td>
                <td>{formatDate(review.reviewDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? <div className="empty">No reviews match the selected filters.</div> : null}
      </div>
    </section>
  );
}
