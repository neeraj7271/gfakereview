import type { Review } from "@prisma/client";
import { analyzeAllReviews, type DetectionResult } from "@/lib/detection";
import { db } from "@/lib/db";
import { getDefaultProfile } from "@/lib/profile";

type AnalyzedReview = {
  review: Review;
  result: DetectionResult;
};

export async function persistAnalysisResults(analyzed: AnalyzedReview[]) {
  await db.$transaction(async (tx) => {
    for (const item of analyzed) {
      await tx.detectionSignal.deleteMany({ where: { reviewId: item.review.id } });
      await tx.review.update({
        where: { id: item.review.id },
        data: {
          suspicionScore: item.result.score,
          suspicionLevel: item.result.level,
          analyzedAt: new Date(),
          signals: {
            create: item.result.signals
          }
        }
      });
    }
  });
}

async function syncRiskAlert(profileId: string, criticalCount: number, highCount: number, threshold: number) {
  const activeRiskTitles = ["Critical suspicious reviews found", "High-risk review threshold crossed"];
  const now = new Date();

  if (criticalCount === 0 && highCount === 0) {
    await db.alert.updateMany({
      where: {
        businessProfileId: profileId,
        title: { in: activeRiskTitles },
        resolvedAt: null
      },
      data: { resolvedAt: now }
    });
    return;
  }

  const alert =
    criticalCount > 0
      ? {
          title: "Critical suspicious reviews found",
          message: `${criticalCount} review(s) have critical suspicion scores after the latest analysis.`,
          severity: "CRITICAL"
        }
      : {
          title: "High-risk review threshold crossed",
          message: `${highCount} review(s) are at or above your sensitivity threshold of ${threshold}.`,
          severity: "WARNING"
        };

  await db.alert.updateMany({
    where: {
      businessProfileId: profileId,
      title: { in: activeRiskTitles.filter((title) => title !== alert.title) },
      resolvedAt: null
    },
    data: { resolvedAt: now }
  });

  const existing = await db.alert.findFirst({
    where: {
      businessProfileId: profileId,
      title: alert.title,
      resolvedAt: null
    }
  });

  if (existing) {
    await db.alert.update({
      where: { id: existing.id },
      data: {
        message: alert.message,
        severity: alert.severity
      }
    });
    return;
  }

  await db.alert.create({
    data: {
      businessProfileId: profileId,
      ...alert
    }
  });
}

export async function refreshAnalysisForProfile() {
  const profile = await getDefaultProfile();
  const reviews = await db.review.findMany({
    where: { businessProfileId: profile.id },
    orderBy: { reviewDate: "desc" }
  });

  const analyzed = analyzeAllReviews(reviews);
  await persistAnalysisResults(analyzed);

  const criticalCount = analyzed.filter((item) => item.result.score >= 80).length;
  const highCount = analyzed.filter((item) => item.result.score >= profile.detectionSensitivity).length;
  await syncRiskAlert(profile.id, criticalCount, highCount, profile.detectionSensitivity);

  return analyzed.length;
}
