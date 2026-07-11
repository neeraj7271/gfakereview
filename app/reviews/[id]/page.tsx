import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { badgeClass, formatDateTime, statusClass } from "@/lib/format";
import ReviewActions from "@/components/ReviewActions";
import ReviewStatusSelect from "@/components/ReviewStatusSelect";

export const dynamic = "force-dynamic";

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = await db.review.findUnique({
    where: { id },
    include: {
      businessProfile: true,
      signals: {
        orderBy: { weight: "desc" }
      },
      responseDrafts: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!review) {
    notFound();
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link className="nav-link" href="/reviews">
            <ArrowLeft size={17} aria-hidden="true" />
            Back to reviews
          </Link>
          <h1 className="page-title">{review.reviewerName}</h1>
          <p className="page-kicker">
            {review.rating}-star review posted {formatDateTime(review.reviewDate)}
          </p>
        </div>
        <ReviewActions reviewId={review.id} />
      </header>

      <div className="detail-layout">
        <section className="panel">
          <div className="panel-body">
            <div className="actions">
              <span className="rating">Rating {review.rating} / 5</span>
              <span className={badgeClass(review.suspicionLevel)}>
                {review.suspicionScore} {review.suspicionLevel.toLowerCase()}
              </span>
              <span className={statusClass(review.status)}>{review.status.toLowerCase()}</span>
              <span className="badge badge-info">{review.source.toLowerCase()}</span>
            </div>
            <h2 className="section-title section">Review comment</h2>
            <p className="review-comment">{review.comment}</p>
            {review.reply ? (
              <>
                <h2 className="section-title section">Current owner reply</h2>
                <p className="review-comment muted">{review.reply}</p>
              </>
            ) : (
              <p className="toast">No public owner reply is recorded for this review.</p>
            )}
            {review.sourceUrl ? (
              <p className="help-text">
                <a href={review.sourceUrl} target="_blank" rel="noreferrer">
                  Open source review <ExternalLink size={13} aria-hidden="true" />
                </a>
              </p>
            ) : null}
            <div className="section">
              <ReviewStatusSelect reviewId={review.id} status={review.status} />
            </div>
          </div>
        </section>

        <aside className="grid">
          <section className="panel">
            <div className="panel-body">
              <h2 className="section-title">Detection signals</h2>
              <div className="signal-list section">
                {review.signals.length === 0 ? (
                  <p className="muted">Run analysis to create signal explanations.</p>
                ) : (
                  review.signals.map((signal) => (
                    <article className="signal-item" key={signal.id}>
                      <div className="signal-title">
                        <span>{signal.label}</span>
                        <span className={badgeClass(signal.severity)}>{signal.weight}</span>
                      </div>
                      <p className="signal-text">{signal.explanation}</p>
                    </article>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-body">
              <h2 className="section-title">Response drafts</h2>
              <div className="signal-list section">
                {review.responseDrafts.length === 0 ? (
                  <p className="muted">Generate a draft after reviewing the signals.</p>
                ) : (
                  review.responseDrafts.map((draft) => (
                    <article className="signal-item" key={draft.id}>
                      <div className="signal-title">
                        <span>{draft.tone}</span>
                        <span className="muted">{formatDateTime(draft.createdAt)}</span>
                      </div>
                      <p className="signal-text">{draft.content}</p>
                    </article>
                  ))
                )}
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
