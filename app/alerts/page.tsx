import { AlertTriangle } from "lucide-react";
import { db } from "@/lib/db";
import { badgeClass, formatDateTime } from "@/lib/format";
import { getDefaultProfile } from "@/lib/profile";
import AlertActions from "@/components/AlertActions";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const profile = await getDefaultProfile();
  const alerts = await db.alert.findMany({
    where: { businessProfileId: profile.id },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Alerts</h1>
          <p className="page-kicker">Reputation issues that need review before they become customer-facing damage.</p>
        </div>
      </header>

      <section className="grid">
        {alerts.length === 0 ? (
          <div className="panel empty">
            <AlertTriangle size={24} aria-hidden="true" />
            <p>No alerts yet.</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <article className="card panel-body" key={alert.id}>
              <div className="signal-title">
                <span>{alert.title}</span>
                <div className="actions">
                  <span className={badgeClass(alert.resolvedAt ? "info" : alert.severity)}>
                    {alert.resolvedAt ? "resolved" : alert.severity.toLowerCase()}
                  </span>
                  <AlertActions alertId={alert.id} resolved={Boolean(alert.resolvedAt)} />
                </div>
              </div>
              <p className="signal-text">{alert.message}</p>
              <p className="help-text">
                Created {formatDateTime(alert.createdAt)}
                {alert.resolvedAt ? ` - Resolved ${formatDateTime(alert.resolvedAt)}` : ""}
              </p>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
