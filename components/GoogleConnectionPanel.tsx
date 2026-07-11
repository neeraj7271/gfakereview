"use client";

import { KeyRound, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function GoogleConnectionPanel() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleStatus = params.get("google");
    const googleMessage = params.get("message");

    if (googleStatus === "connected") {
      setMessage("Google OAuth is connected. Run sync to import reviews.");
    } else if (googleStatus === "error") {
      setMessage(googleMessage ?? "Google OAuth failed.");
    }
  }, []);

  async function connect() {
    setLoading("connect");
    setMessage("");
    try {
      const response = await fetch("/api/google/auth-url");
      const payload = (await response.json()) as { configured: boolean; authUrl?: string; message?: string };
      if (!response.ok || !payload.configured || !payload.authUrl) {
        throw new Error(payload.message ?? "Google OAuth is not configured.");
      }

      window.location.href = payload.authUrl;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google OAuth is not configured.");
      setLoading(null);
    }
  }

  async function sync() {
    setLoading("sync");
    setMessage("");
    try {
      const response = await fetch("/api/google/sync-reviews", { method: "POST" });
      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Google sync failed.");
      }

      setMessage(payload.message ?? "Google reviews synced.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google sync failed.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="panel">
      <div className="panel-body">
        <h2 className="section-title">
          <KeyRound size={18} aria-hidden="true" /> Google connection
        </h2>
        <p className="help-text">
          Demo, manual, and CSV modes work without Google. Live Google sync requires OAuth credentials, Business Profile API access,
          and the Google location name.
        </p>
        <div className="actions section">
          <button className="button-secondary" type="button" onClick={connect} disabled={Boolean(loading)}>
            <KeyRound size={17} aria-hidden="true" />
            {loading === "connect" ? "Connecting..." : "Connect Google"}
          </button>
          <button className="button" type="button" onClick={sync} disabled={Boolean(loading)}>
            <RefreshCw size={17} aria-hidden="true" />
            {loading === "sync" ? "Syncing..." : "Sync reviews"}
          </button>
        </div>
        {message ? <div className="toast">{message}</div> : null}
      </div>
    </section>
  );
}
