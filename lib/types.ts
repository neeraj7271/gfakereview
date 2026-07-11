export type SerializedSignal = {
  id: string;
  type: string;
  label: string;
  explanation: string;
  weight: number;
  severity: string;
  createdAt: string;
};

export type SerializedDraft = {
  id: string;
  tone: string;
  content: string;
  createdAt: string;
};

export type SerializedReview = {
  id: string;
  reviewerName: string;
  reviewerProfileUrl: string | null;
  rating: number;
  comment: string;
  reviewDate: string;
  reply: string | null;
  sourceUrl: string | null;
  source: string;
  status: string;
  suspicionScore: number;
  suspicionLevel: string;
  analyzedAt: string | null;
  signals: SerializedSignal[];
  responseDrafts: SerializedDraft[];
};
