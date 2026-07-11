import Link from "next/link";
import { AlertTriangle, FileDown, Import, PlusCircle, RefreshCw } from "lucide-react";
import { db } from "@/lib/db";
import { badgeClass, formatDate } from "@/lib/format";
import { getDefaultProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await getDefaultProfile();
  const [reviews, alerts, packets] = await Promise.all([
    db.review.findMany({
      where: { businessProfileId: profile.id },
      orderBy: { reviewDate: "desc" },
      include: { signals: true },
      take: 8
    }),
    db.alert.findMany({
      where: { businessProfileId: profile.id, resolvedAt: null },
      orderBy: { createdAt: "desc" },
      take: 4
    }),
    db.evidencePacket.findMany({
      where: { businessProfileId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 3
    })
  ]);

  const totalReviews = await db.review.count({ where: { businessProfileId: profile.id } });
  const suspiciousReviews = await db.review.count({
    where: {
      businessProfileId: profile.id,
      suspicionScore: { gte: profile.detectionSensitivity }
    }
  });
  const unansweredLowReviews = await db.review.count({
    where: {
      businessProfileId: profile.id,
      rating: { lte: 3 },
      reply: null
    }
  });
  const averageRating =
    totalReviews > 0
      ? (
          (await db.review.aggregate({
            where: { businessProfileId: profile.id },
            _avg: { rating: true }
          }))._avg.rating ?? 0
        ).toFixed(1)
      : "0.0";

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Review defense dashboard</h1>
          <p className="page-kicker">
            Monitor suspicious review patterns for {profile.name} and prepare calm, evidence-backed responses.
          </p>
        </div>
        <div className="actions">
          <Link className="button-secondary" href="/import" title="Import reviews">
            <Import size={17} aria-hidden="true" />
            Import
          </Link>
          <Link className="button-secondary" href="/add-review" title="Add review manually">
            <PlusCircle size={17} aria-hidden="true" />
            Add review
          </Link>
          <Link className="button" href="/reviews" title="Analyze reviews">
            <RefreshCw size={17} aria-hidden="true" />
            Review queue
          </Link>
        </div>
      </header>

      <section className="grid grid-4">
        <article className="card metric-card">
          <div className="metric-label">Total reviews</div>
          <div className="metric-value">{totalReviews}</div>
          <div className="metric-note">Across demo, CSV, manual, and Google sources.</div>
        </article>
        <article className="card metric-card">
          <div className="metric-label">Average rating</div>
          <div className="metric-value">{averageRating}</div>
          <div className="metric-note">Use this as reputation context, not a fraud signal.</div>
        </article>
        <article className="card metric-card">
          <div className="metric-label">Suspicious reviews</div>
          <div className="metric-value">{suspiciousReviews}</div>
          <div className="metric-note">At or above threshold {profile.detectionSensitivity}.</div>
        </article>
        <article className="card metric-card">
          <div className="metric-label">Need response</div>
          <div className="metric-value">{unansweredLowReviews}</div>
          <div className="metric-note">Low or neutral reviews without owner replies.</div>
        </article>
      </section>

      <section className="section grid grid-2">
        <div>
          <div className="section-header">
            <h2 className="section-title">Recent review risk</h2>
            <Link className="button-secondary" href="/reviews">
              View all
            </Link>
          </div>
          <div className="panel table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Reviewer</th>
                  <th>Rating</th>
                  <th>Risk</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => (
                  <tr key={review.id}>
                    <td>
                      <Link href={`/reviews/${review.id}`}>{review.reviewerName}</Link>
                    </td>
                    <td>{review.rating}</td>
                    <td>
                      <span className={badgeClass(review.suspicionLevel)}>
                        {review.suspicionScore} {review.suspicionLevel.toLowerCase()}
                      </span>
                    </td>
                    <td>{formatDate(review.reviewDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="section-header">
            <h2 className="section-title">Active alerts</h2>
            <Link className="button-secondary" href="/alerts">
              Open alerts
            </Link>
          </div>
          <div className="grid">
            {alerts.length === 0 ? (
              <div className="panel empty">No active alerts.</div>
            ) : (
              alerts.map((alert) => (
                <article className="card panel-body" key={alert.id}>
                  <div className="signal-title">
                    <span>{alert.title}</span>
                    <span className={badgeClass(alert.severity)}>{alert.severity.toLowerCase()}</span>
                  </div>
                  <p className="signal-text">{alert.message}</p>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">Evidence packets</h2>
          <Link className="button-secondary" href="/evidence">
            <FileDown size={17} aria-hidden="true" />
            Packet library
          </Link>
        </div>
        <div className="grid grid-3">
          {packets.length === 0 ? (
            <div className="panel empty">
              <AlertTriangle size={22} aria-hidden="true" />
              <p>No packets yet. Open a suspicious review to create one.</p>
            </div>
          ) : (
            packets.map((packet) => (
              <Link className="card panel-body" href={`/evidence/${packet.id}`} key={packet.id}>
                <strong>{packet.title}</strong>
                <p className="signal-text">{packet.summary}</p>
                <p className="help-text">{formatDate(packet.createdAt)}</p>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
