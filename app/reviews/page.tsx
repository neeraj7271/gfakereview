import Link from "next/link";
import { PlusCircle, RefreshCw } from "lucide-react";
import { db } from "@/lib/db";
import { getDefaultProfile } from "@/lib/profile";
import { serializeReview } from "@/lib/serialize";
import ReviewsTable from "@/components/ReviewsTable";
import AnalyzeAllButton from "@/components/AnalyzeAllButton";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const profile = await getDefaultProfile();
  const reviews = await db.review.findMany({
    where: { businessProfileId: profile.id },
    orderBy: [{ suspicionScore: "desc" }, { reviewDate: "desc" }],
    include: {
      signals: true,
      responseDrafts: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Review queue</h1>
          <p className="page-kicker">Filter, inspect, and re-score suspicious reviews before responding.</p>
        </div>
        <div className="actions">
          <Link className="button-secondary" href="/add-review">
            <PlusCircle size={17} aria-hidden="true" />
            Add review
          </Link>
          <AnalyzeAllButton>
            <RefreshCw size={17} aria-hidden="true" />
            Re-score all
          </AnalyzeAllButton>
        </div>
      </header>
      <ReviewsTable reviews={reviews.map(serializeReview)} />
    </div>
  );
}
