"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AnalyzeAllButton({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function analyze() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/reviews/analyze-all", { method: "POST" });
      const payload = (await response.json()) as { analyzed?: number; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to analyze reviews.");
      }

      setMessage(`Analyzed ${payload.analyzed ?? 0} review(s).`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to analyze reviews.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button className="button" type="button" onClick={analyze} disabled={loading}>
        {loading ? "Analyzing..." : children}
      </button>
      {message ? <div className="toast">{message}</div> : null}
    </div>
  );
}
