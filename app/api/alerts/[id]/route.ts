import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDefaultProfile } from "@/lib/profile";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getDefaultProfile();

  try {
    const body = (await request.json()) as { action?: unknown };
    const action = typeof body.action === "string" ? body.action : "resolve";

    if (action !== "resolve" && action !== "reopen") {
      return NextResponse.json({ error: "Unsupported alert action." }, { status: 400 });
    }

    const alert = await db.alert.findFirst({
      where: { id, businessProfileId: profile.id }
    });

    if (!alert) {
      return NextResponse.json({ error: "Alert not found." }, { status: 404 });
    }

    const updated = await db.alert.update({
      where: { id: alert.id },
      data: { resolvedAt: action === "resolve" ? new Date() : null }
    });

    return NextResponse.json({ alert: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update alert." },
      { status: 400 }
    );
  }
}
