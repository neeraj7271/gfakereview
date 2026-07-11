import ImportReviewsForm from "@/components/ImportReviewsForm";

export default function ImportPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Import reviews</h1>
          <p className="page-kicker">
            Paste CSV review data from Google exports, a spreadsheet, or a manual research file.
          </p>
        </div>
      </header>
      <ImportReviewsForm />
    </div>
  );
}
