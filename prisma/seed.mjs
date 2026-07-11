import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const profileData = {
  name: "BrightLine Dental Studio",
  googleLocationName: "accounts/000/locations/brightline-demo",
  websiteUrl: "https://brightline.example.com",
  phone: "(555) 014-2030",
  industry: "Dental clinic",
  address: "214 Market Street, Indianapolis, IN",
  reviewUrl: "https://g.page/r/demo-review-link",
  detectionSensitivity: 65
};

const demoReviews = [
  {
    reviewerName: "Maya Chen",
    rating: 5,
    comment: "The hygienist explained everything clearly and the front desk was friendly. Booking was easy and the visit started on time.",
    reviewDate: "2026-07-01T14:20:00.000Z",
    reply: "Thank you, Maya. We appreciate the kind words.",
    source: "DEMO"
  },
  {
    reviewerName: "J Thompson",
    rating: 1,
    comment: "Worst place ever. Avoid this business. Scam service and rude people.",
    reviewDate: "2026-07-04T09:03:00.000Z",
    source: "DEMO",
    reviewerProfileUrl: ""
  },
  {
    reviewerName: "Local Guide 9182",
    rating: 1,
    comment: "Worst place ever. Avoid this business. Scam service and rude people.",
    reviewDate: "2026-07-04T09:24:00.000Z",
    source: "DEMO",
    reviewerProfileUrl: ""
  },
  {
    reviewerName: "Aaron P",
    rating: 2,
    comment: "They called me after I declined their marketing vendor. Now they deserve one star.",
    reviewDate: "2026-07-04T10:01:00.000Z",
    source: "DEMO"
  },
  {
    reviewerName: "Priya Shah",
    rating: 4,
    comment: "Good care and clean office. I had to wait about 10 minutes, but the team apologized and kept me updated.",
    reviewDate: "2026-06-28T17:10:00.000Z",
    reply: "Thank you for the feedback, Priya.",
    source: "DEMO"
  },
  {
    reviewerName: "Noah Miller",
    rating: 1,
    comment: "Bad service.",
    reviewDate: "2026-07-05T12:44:00.000Z",
    source: "DEMO",
    reviewerProfileUrl: ""
  },
  {
    reviewerName: "Elena Garcia",
    rating: 5,
    comment: "I needed a same-day appointment and they helped me quickly. Great communication.",
    reviewDate: "2026-06-24T15:30:00.000Z",
    reply: "Thanks, Elena. We are glad we could help.",
    source: "DEMO"
  },
  {
    reviewerName: "One Star Reviews",
    rating: 1,
    comment: "Your competitor across town is much better. Do not waste your money here.",
    reviewDate: "2026-07-05T13:01:00.000Z",
    source: "DEMO"
  }
];

function levelForScore(score) {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}

function buildDemoSignals(review) {
  const signals = [];
  const comment = review.comment.toLowerCase();

  if (review.rating <= 2) {
    signals.push({
      type: "LOW_RATING",
      label: "Low-star review",
      explanation: "The review is one or two stars, so it has a higher reputation impact and deserves review before a public response.",
      weight: review.rating === 1 ? 14 : 9,
      severity: review.rating === 1 ? "WARNING" : "WATCH"
    });
  }

  if (!review.reviewerProfileUrl || review.reviewerProfileUrl.trim().length < 8) {
    signals.push({
      type: "SPARSE_REVIEWER_METADATA",
      label: "Sparse reviewer metadata",
      explanation: "The reviewer profile URL is missing or incomplete. This does not prove fraud, but it weakens reviewer context.",
      weight: 11,
      severity: "WATCH"
    });
  }

  if (review.rating <= 2 && review.comment.trim().length <= 24) {
    signals.push({
      type: "SHORT_LOW_CONTEXT",
      label: "Short low-context complaint",
      explanation: "The review has very little detail for a low rating, which makes it harder to verify against customer records.",
      weight: 13,
      severity: "WARNING"
    });
  }

  const phraseHits = ["scam", "avoid this business", "worst place ever", "competitor", "declined", "one star"].filter(
    (phrase) => comment.includes(phrase)
  );
  if (phraseHits.length > 0) {
    signals.push({
      type: "SUSPICIOUS_LANGUAGE",
      label: "Suspicious wording",
      explanation: `The review contains high-intensity or attack-like wording: ${phraseHits.join(", ")}.`,
      weight: Math.min(24, 8 + phraseHits.length * 5),
      severity: "WARNING"
    });
  }

  const reviewDate = new Date(review.reviewDate);
  const lowStarBurstCount = demoReviews.filter((candidate) => {
    const candidateDate = new Date(candidate.reviewDate);
    const hours = Math.abs(candidateDate.getTime() - reviewDate.getTime()) / 1000 / 60 / 60;
    return candidate !== review && candidate.rating <= 2 && review.rating <= 2 && hours <= 48;
  }).length;

  if (lowStarBurstCount >= 2) {
    signals.push({
      type: "LOW_STAR_BURST",
      label: "Low-star burst",
      explanation: `${lowStarBurstCount + 1} low-star reviews landed within a 48-hour window.`,
      weight: Math.min(30, 16 + lowStarBurstCount * 4),
      severity: "CRITICAL"
    });
  }

  const repeated = demoReviews.some(
    (candidate) => candidate !== review && candidate.comment.toLowerCase() === review.comment.toLowerCase()
  );
  if (repeated) {
    signals.push({
      type: "REPEATED_WORDING",
      label: "Repeated wording",
      explanation: "This review uses the same wording as another recent review in the demo data.",
      weight: 28,
      severity: "CRITICAL"
    });
  }

  if (!review.reply && review.rating <= 3) {
    signals.push({
      type: "NO_OWNER_RESPONSE",
      label: "No owner response",
      explanation: "There is no public owner reply yet. A careful response can reduce reputational damage while evidence is collected.",
      weight: 6,
      severity: "INFO"
    });
  }

  const suspicionScore = Math.min(
    100,
    signals.reduce((sum, signal) => sum + signal.weight, 0)
  );

  return {
    suspicionScore,
    suspicionLevel: levelForScore(suspicionScore),
    signals
  };
}

async function main() {
  const profile = await prisma.businessProfile.upsert({
    where: { id: "demo-business-profile" },
    update: profileData,
    create: {
      id: "demo-business-profile",
      ...profileData
    }
  });

  await prisma.responseDraft.deleteMany({
    where: {
      review: {
        businessProfileId: profile.id
      }
    }
  });
  await prisma.detectionSignal.deleteMany({
    where: {
      review: {
        businessProfileId: profile.id
      }
    }
  });
  await prisma.alert.deleteMany({ where: { businessProfileId: profile.id } });
  await prisma.evidencePacket.deleteMany({ where: { businessProfileId: profile.id } });
  await prisma.googleCredential.deleteMany({ where: { businessProfileId: profile.id } });
  await prisma.review.deleteMany({ where: { businessProfileId: profile.id } });

  for (const review of demoReviews) {
    const analysis = buildDemoSignals(review);
    await prisma.review.create({
      data: {
        ...review,
        businessProfileId: profile.id,
        reviewDate: new Date(review.reviewDate),
        suspicionScore: analysis.suspicionScore,
        suspicionLevel: analysis.suspicionLevel,
        analyzedAt: new Date(),
        signals: {
          create: analysis.signals
        }
      }
    });
  }

  await prisma.alert.createMany({
    data: [
      {
        businessProfileId: profile.id,
        title: "Low-star review burst detected",
        message: "Four low-star reviews arrived within a 48-hour period. Review them before replying publicly.",
        severity: "CRITICAL"
      },
      {
        businessProfileId: profile.id,
        title: "Repeated wording found",
        message: "Two recent one-star reviews use nearly identical phrasing.",
        severity: "WARNING"
      }
    ]
  });

  console.log("Seeded demo business profile and reviews.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
