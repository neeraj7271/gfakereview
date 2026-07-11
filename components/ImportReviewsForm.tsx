"use client";

import { Clipboard, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { sampleCsv } from "@/lib/csv";

export default function ImportReviewsForm() {
  const router = useRouter();
  const [csv, setCsv] = useState(sampleCsv);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/import/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv })
      });
      const payload = (await response.json()) as { imported?: number; skipped?: number; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Import failed.");
      }
      setMessage(`Imported ${payload.imported ?? 0} review(s). Skipped ${payload.skipped ?? 0} duplicate(s).`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-body">
        <div className="form-row">
          <label htmlFor="csv-input">CSV input</label>
          <textarea
            id="csv-input"
            className="textarea"
            value={csv}
            onChange={(event) => setCsv(event.target.value)}
            spellCheck={false}
          />
          <p className="help-text">
            Required columns: reviewerName, rating, comment, reviewDate. Optional columns: reply, sourceUrl, reviewerProfileUrl.
          </p>
        </div>
        <div className="actions section">
          <button className="button" type="button" onClick={submit} disabled={loading}>
            <Upload size={17} aria-hidden="true" />
            {loading ? "Importing..." : "Import reviews"}
          </button>
          <button className="button-secondary" type="button" onClick={() => setCsv(sampleCsv)}>
            <Clipboard size={17} aria-hidden="true" />
            Load sample
          </button>
        </div>
        {message ? <div className="toast">{message}</div> : null}
      </div>
    </section>
  );
}
