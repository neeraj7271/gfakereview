"use client";

import { FileText, MessageSquareText, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ReviewActions({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  async function run(action: "analyze" | "draft" | "evidence") {
    setLoading(action);
    setMessage("");

    try {
      const endpoint =
        action === "evidence"
          ? "/api/evidence"
          : action === "draft"
            ? `/api/reviews/${reviewId}/draft-reply`
            : `/api/reviews/${reviewId}/analyze`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "evidence" ? JSON.stringify({ reviewIds: [reviewId] }) : undefined
      });
      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Action failed.");
      }

      if (action === "evidence" && payload.id) {
        router.push(`/evidence/${payload.id}`);
        return;
      }

      setMessage(action === "draft" ? "Draft created." : "Review analyzed.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      <div className="actions">
        <button className="button-secondary" type="button" onClick={() => run("analyze")} disabled={Boolean(loading)}>
          <RefreshCw size={17} aria-hidden="true" />
          {loading === "analyze" ? "Analyzing..." : "Analyze"}
        </button>
        <button className="button-secondary" type="button" onClick={() => run("draft")} disabled={Boolean(loading)}>
          <MessageSquareText size={17} aria-hidden="true" />
          {loading === "draft" ? "Drafting..." : "Draft reply"}
        </button>
        <button className="button" type="button" onClick={() => run("evidence")} disabled={Boolean(loading)}>
          <FileText size={17} aria-hidden="true" />
          {loading === "evidence" ? "Creating..." : "Evidence"}
        </button>
      </div>
      {message ? <div className="toast">{message}</div> : null}
    </div>
  );
}
