"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type SettingsProfile = {
  name: string;
  googleLocationName: string | null;
  industry: string | null;
  websiteUrl: string | null;
  phone: string | null;
  address: string | null;
  reviewUrl: string | null;
  detectionSensitivity: number;
};

export default function SettingsForm({ profile }: { profile: SettingsProfile }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: profile.name,
    googleLocationName: profile.googleLocationName ?? "",
    industry: profile.industry ?? "",
    websiteUrl: profile.websiteUrl ?? "",
    phone: profile.phone ?? "",
    address: profile.address ?? "",
    reviewUrl: profile.reviewUrl ?? "",
    detectionSensitivity: String(profile.detectionSensitivity)
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
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Save failed.");
      }
      setMessage("Settings saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="form-grid section">
      <label className="form-row">
        <span>Name</span>
        <input className="field" value={form.name} onChange={(event) => update("name", event.target.value)} />
      </label>
      <label className="form-row">
        <span>Industry</span>
        <input className="field" value={form.industry} onChange={(event) => update("industry", event.target.value)} />
      </label>
      <label className="form-row">
        <span>Google location name</span>
        <input
          className="field"
          value={form.googleLocationName}
          onChange={(event) => update("googleLocationName", event.target.value)}
        />
        <p className="help-text">Use the format accounts/123/locations/456.</p>
      </label>
      <label className="form-row">
        <span>Website</span>
        <input className="field" value={form.websiteUrl} onChange={(event) => update("websiteUrl", event.target.value)} />
      </label>
      <label className="form-row">
        <span>Phone</span>
        <input className="field" value={form.phone} onChange={(event) => update("phone", event.target.value)} />
      </label>
      <label className="form-row">
        <span>Address</span>
        <input className="field" value={form.address} onChange={(event) => update("address", event.target.value)} />
      </label>
      <label className="form-row">
        <span>Review link</span>
        <input className="field" value={form.reviewUrl} onChange={(event) => update("reviewUrl", event.target.value)} />
      </label>
      <label className="form-row">
        <span>Suspicion threshold</span>
        <input
          className="field"
          type="number"
          min="0"
          max="100"
          value={form.detectionSensitivity}
          onChange={(event) => update("detectionSensitivity", event.target.value)}
        />
      </label>
      <div className="form-row">
        <span>&nbsp;</span>
        <button className="button" type="button" onClick={submit} disabled={loading}>
          <Save size={17} aria-hidden="true" />
          {loading ? "Saving..." : "Save settings"}
        </button>
      </div>
      {message ? <div className="toast">{message}</div> : null}
    </div>
  );
}
