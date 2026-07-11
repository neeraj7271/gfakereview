import Link from "next/link";
import { FileText } from "lucide-react";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { getDefaultProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function EvidencePage() {
  const profile = await getDefaultProfile();
  const packets = await db.evidencePacket.findMany({
    where: { businessProfileId: profile.id },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Evidence packets</h1>
          <p className="page-kicker">Printable summaries for internal review or platform escalation.</p>
        </div>
      </header>

      <section className="grid grid-3">
        {packets.length === 0 ? (
          <div className="panel empty">
            <FileText size={24} aria-hidden="true" />
            <p>No packets yet. Create one from a review detail page.</p>
          </div>
        ) : (
          packets.map((packet) => (
            <Link className="card panel-body" href={`/evidence/${packet.id}`} key={packet.id}>
              <strong>{packet.title}</strong>
              <p className="signal-text">{packet.summary}</p>
              <p className="help-text">{formatDateTime(packet.createdAt)}</p>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
