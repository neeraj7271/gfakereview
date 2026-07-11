import ManualReviewForm from "@/components/ManualReviewForm";

export default function AddReviewPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Add review manually</h1>
          <p className="page-kicker">
            Enter one review at a time when you are collecting evidence from screenshots or copied Google review text.
          </p>
        </div>
      </header>
      <ManualReviewForm />
    </div>
  );
}
