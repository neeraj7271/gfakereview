import { db } from "@/lib/db";

export async function getDefaultProfile() {
  const existing = await db.businessProfile.findFirst({
    orderBy: { createdAt: "asc" }
  });

  if (existing) {
    return existing;
  }

  return db.businessProfile.create({
    data: {
      name: "Demo Local Business",
      industry: "Local services",
      detectionSensitivity: 65
    }
  });
}
