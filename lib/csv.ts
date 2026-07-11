export type ImportedReviewInput = {
  reviewerName: string;
  rating: number;
  comment: string;
  reviewDate: Date;
  reply?: string;
  sourceUrl?: string;
  reviewerProfileUrl?: string;
};

function parseCsvRecords(input: string) {
  const records: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];

    if (character === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && next === "\n") {
        index += 1;
      }

      row.push(current.trim());
      current = "";
      if (row.some((value) => value.length > 0)) {
        records.push(row);
      }
      row = [];
      continue;
    }

    current += character;
  }

  row.push(current.trim());
  if (row.some((value) => value.length > 0)) {
    records.push(row);
  }

  if (inQuotes) {
    throw new Error("CSV contains an unclosed quoted field.");
  }

  return records;
}

export function parseReviewsCsv(input: string): ImportedReviewInput[] {
  const records = parseCsvRecords(input);

  if (records.length < 2) {
    throw new Error("CSV must include a header row and at least one review row.");
  }

  const headers = records[0].map((header) => header.trim());
  const normalizedHeaders = headers.map((header) => header.toLowerCase());

  function value(row: string[], header: string) {
    const index = normalizedHeaders.indexOf(header.toLowerCase());
    return index >= 0 ? row[index]?.trim() ?? "" : "";
  }

  const required = ["reviewerName", "rating", "comment", "reviewDate"];
  const missing = required.filter((header) => !normalizedHeaders.includes(header.toLowerCase()));
  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(", ")}.`);
  }

  return records.slice(1).map((row, index) => {
    const rating = Number(value(row, "rating"));
    const reviewDate = new Date(value(row, "reviewDate"));

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new Error(`Row ${index + 2} has an invalid rating. Use a whole number from 1 to 5.`);
    }

    if (Number.isNaN(reviewDate.getTime())) {
      throw new Error(`Row ${index + 2} has an invalid reviewDate.`);
    }

    const reviewerName = value(row, "reviewerName");
    const comment = value(row, "comment");

    if (!reviewerName || !comment) {
      throw new Error(`Row ${index + 2} needs reviewerName and comment values.`);
    }

    return {
      reviewerName,
      rating,
      comment,
      reviewDate,
      reply: value(row, "reply") || undefined,
      sourceUrl: value(row, "sourceUrl") || undefined,
      reviewerProfileUrl: value(row, "reviewerProfileUrl") || undefined
    };
  });
}

export const sampleCsv = `reviewerName,rating,comment,reviewDate,reply,sourceUrl,reviewerProfileUrl
Jordan Lee,1,"Worst place ever. Avoid this business.",2026-07-06,,,
Sam Patel,5,"Clear communication and fast service.",2026-07-05,"Thank you, Sam.",,`;
