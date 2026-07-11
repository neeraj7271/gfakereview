export function formatDate(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

export function formatDateTime(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function scoreLabel(score: number) {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 35) return "Medium";
  return "Low";
}

export function badgeClass(level: string) {
  const normalized = level.toLowerCase();
  if (normalized === "critical") return "badge badge-critical";
  if (normalized === "high") return "badge badge-high";
  if (normalized === "medium") return "badge badge-medium";
  if (normalized === "warning") return "badge badge-high";
  if (normalized === "info") return "badge badge-info";
  return "badge badge-low";
}

export function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "escalated") return "badge badge-critical";
  if (normalized === "reviewing") return "badge badge-medium";
  if (normalized === "responded") return "badge badge-info";
  if (normalized === "dismissed") return "badge badge-low";
  return "badge badge-info";
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
