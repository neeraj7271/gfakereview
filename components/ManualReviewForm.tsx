"use client";

import { PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ManualReviewForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    reviewerName: "",
    rating: "1",
    comment: "",
    reviewDate: new Date().toISOString().slice(0, 10),
    reply: "",
    sourceUrl: "",
    reviewerProfileUrl: ""
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function update(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/reviews/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const payload = (await response.json()) as { review?: { id: string }; error?: string };
      if (!response.ok || !payload.review) {
        throw new Error(payload.error ?? "Could not create review.");
      }
      router.push(`/reviews/${payload.review.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create review.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-body">
        <div className="form-grid">
          <label className="form-row">
            <span>Reviewer name</span>
            <input
              className="field"
              value={form.reviewerName}
              onChange={(event) => update("reviewerName", event.target.value)}
            />
          </label>
          <label className="form-row">
            <span>Rating</span>
            <select className="select" value={form.rating} onChange={(event) => update("rating", event.target.value)}>
              <option value="1">1 star</option>
              <option value="2">2 stars</option>
              <option value="3">3 stars</option>
              <option value="4">4 stars</option>
              <option value="5">5 stars</option>
            </select>
          </label>
          <label className="form-row">
            <span>Review date</span>
            <input
              className="field"
              type="date"
              value={form.reviewDate}
              onChange={(event) => update("reviewDate", event.target.value)}
            />
          </label>
          <label className="form-row">
            <span>Reviewer profile URL</span>
            <input
              className="field"
              value={form.reviewerProfileUrl}
              onChange={(event) => update("reviewerProfileUrl", event.target.value)}
            />
          </label>
          <label className="form-row">
            <span>Review source URL</span>
            <input
              className="field"
              value={form.sourceUrl}
              onChange={(event) => update("sourceUrl", event.target.value)}
            />
          </label>
          <label className="form-row">
            <span>Existing owner reply</span>
            <input
              className="field"
              value={form.reply}
              onChange={(event) => update("reply", event.target.value)}
            />
          </label>
        </div>
        <label className="form-row section">
          <span>Review comment</span>
          <textarea
            className="textarea"
            value={form.comment}
            onChange={(event) => update("comment", event.target.value)}
          />
        </label>
        <div className="actions section">
          <button className="button" type="button" onClick={submit} disabled={loading}>
            <PlusCircle size={17} aria-hidden="true" />
            {loading ? "Adding..." : "Add and analyze"}
          </button>
        </div>
        {message ? <div className="toast">{message}</div> : null}
      </div>
    </section>
  );
}
