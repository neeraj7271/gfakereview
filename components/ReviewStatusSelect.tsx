"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const statuses = [
  { value: "NEW", label: "New" },
  { value: "REVIEWING", label: "Reviewing" },
  { value: "RESPONDED", label: "Responded" },
  { value: "ESCALATED", label: "Escalated" },
  { value: "DISMISSED", label: "Dismissed" }
];

export default function ReviewStatusSelect({ reviewId, status }: { reviewId: string; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function updateStatus(nextStatus: string) {
    setValue(nextStatus);
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not update status.");
      }

      router.refresh();
    } catch (error) {
      setValue(status);
      setMessage(error instanceof Error ? error.message : "Could not update status.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="form-row status-control">
      <label htmlFor="review-status">Queue status</label>
      <select
        id="review-status"
        className="select"
        value={value}
        onChange={(event) => updateStatus(event.target.value)}
        disabled={loading}
      >
        {statuses.map((item) => (
          <option value={item.value} key={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      {message ? <div className="toast">{message}</div> : null}
    </div>
  );
}
