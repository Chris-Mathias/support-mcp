export type DocumentChunkInput = {
  chunkIndex: number;
  pageNumberStart?: number | null;
  pageNumberEnd?: number | null;
  text: string;
  charCount: number;
};

export type PdfProcessingResult = {
  extractedText: string;
  pageCount: number | null;
  chunks: DocumentChunkInput[];
  summary: string | null;
};

const MAX_CHUNK_CHARS = 1800;
const MIN_CHUNK_CHARS = 400;

export function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[  ]+/g, " ")
    .replace(/\n[ ]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function tryExtractPageCount(result: unknown): number | null {
  if (
    result &&
    typeof result === "object" &&
    "numpages" in result &&
    typeof (result as { numpages?: unknown }).numpages === "number"
  ) {
    return (result as { numpages: number }).numpages;
  }
  return null;
}

export function buildSummaryFromText(text: string): string | null {
  const normalized = normalizeExtractedText(text);

  if (!normalized) return null;

  const intro = normalized.slice(0, 1500);
  const lines = intro
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const selected: string[] = [];
  let total = 0;

  for (const line of lines) {
    if (line.length < 20) continue;
    selected.push(line);
    total += line.length;
    if (selected.length >= 3 || total >= 400) break;
  }

  const summary = selected.join(" ").trim();
  return summary || normalized.slice(0, 400);
}

export function buildChunksFromExtractedText(
  text: string,
): DocumentChunkInput[] {
  const normalizedText = normalizeExtractedText(text);

  if (!normalizedText) return [];

  const paragraphs = normalizedText
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return [
      {
        chunkIndex: 0,
        pageNumberStart: null,
        pageNumberEnd: null,
        text: normalizedText.slice(0, MAX_CHUNK_CHARS),
        charCount: Math.min(normalizedText.length, MAX_CHUNK_CHARS),
      },
    ];
  }

  const chunks: DocumentChunkInput[] = [];
  let current = "";
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

    if (candidate.length <= MAX_CHUNK_CHARS) {
      current = candidate;
      continue;
    }

    if (current.length >= MIN_CHUNK_CHARS) {
      chunks.push({
        chunkIndex,
        pageNumberStart: null,
        pageNumberEnd: null,
        text: current,
        charCount: current.length,
      });
      chunkIndex += 1;
      current = "";
    }

    if (paragraph.length <= MAX_CHUNK_CHARS) {
      current = paragraph;
      continue;
    }

    const hardSlices = sliceLargeText(paragraph, MAX_CHUNK_CHARS);
    for (const slice of hardSlices) {
      chunks.push({
        chunkIndex,
        pageNumberStart: null,
        pageNumberEnd: null,
        text: slice,
        charCount: slice.length,
      });
      chunkIndex += 1;
    }
    current = "";
  }

  if (current.trim()) {
    chunks.push({
      chunkIndex,
      pageNumberStart: null,
      pageNumberEnd: null,
      text: current.trim(),
      charCount: current.trim().length,
    });
  }

  return chunks;
}

function sliceLargeText(text: string, maxChars: number): string[] {
  const slices: string[] = [];
  let remaining = text.trim();

  while (remaining.length > maxChars) {
    let splitAt = remaining.lastIndexOf(" ", maxChars);

    if (splitAt < Math.floor(maxChars * 0.6)) {
      splitAt = maxChars;
    }

    const piece = remaining.slice(0, splitAt).trim();
    if (piece) slices.push(piece);

    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) slices.push(remaining);

  return slices;
}
