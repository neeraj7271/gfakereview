"use client";

import { CheckCircle2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AlertActions({ alertId, resolved }: { alertId: string; resolved: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function updateAlert() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: resolved ? "reopen" : "resolve" })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not update alert.");
      }

      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update alert.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button className="button-secondary" type="button" onClick={updateAlert} disabled={loading}>
        {resolved ? <RotateCcw size={17} aria-hidden="true" /> : <CheckCircle2 size={17} aria-hidden="true" />}
        {loading ? "Saving..." : resolved ? "Reopen" : "Resolve"}
      </button>
      {message ? <div className="toast">{message}</div> : null}
    </div>
  );
}
