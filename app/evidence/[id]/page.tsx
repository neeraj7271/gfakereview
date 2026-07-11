import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function EvidenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const packet = await db.evidencePacket.findUnique({
    where: { id }
  });

  if (!packet) {
    notFound();
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{packet.title}</h1>
          <p className="page-kicker">{formatDateTime(packet.createdAt)}</p>
        </div>
        <div className="actions">
          <PrintButton />
        </div>
      </header>
      <article className="print-page" dangerouslySetInnerHTML={{ __html: packet.contentHtml }} />
    </div>
  );
}