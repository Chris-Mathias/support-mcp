import { workerData, parentPort } from "node:worker_threads";
import { PDFParse } from "pdf-parse";

// ── helpers (inline — sem importar .ts) ───────────────────────────────────────

const MAX_CHUNK_CHARS = 1800;
const MIN_CHUNK_CHARS = 400;

function normalizeExtractedText(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[  ]+/g, " ")
    .replace(/\n[ ]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function tryExtractPageCount(result) {
  if (result && typeof result === "object" && "numpages" in result && typeof result.numpages === "number") {
    return result.numpages;
  }
  return null;
}

function buildSummaryFromText(text) {
  const normalized = normalizeExtractedText(text);
  if (!normalized) return null;

  const lines = normalized.slice(0, 1500).split("\n").map(l => l.trim()).filter(Boolean);
  const selected = [];
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

function sliceLargeText(text, maxChars) {
  const slices = [];
  let remaining = text.trim();
  while (remaining.length > maxChars) {
    let splitAt = remaining.lastIndexOf(" ", maxChars);
    if (splitAt < Math.floor(maxChars * 0.6)) splitAt = maxChars;
    const piece = remaining.slice(0, splitAt).trim();
    if (piece) slices.push(piece);
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) slices.push(remaining);
  return slices;
}

function buildChunksFromExtractedText(text) {
  const normalizedText = normalizeExtractedText(text);
  if (!normalizedText) return [];

  const paragraphs = normalizedText.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);

  if (paragraphs.length === 0) {
    return [{ chunkIndex: 0, pageNumberStart: null, pageNumberEnd: null, text: normalizedText.slice(0, MAX_CHUNK_CHARS), charCount: Math.min(normalizedText.length, MAX_CHUNK_CHARS) }];
  }

  const chunks = [];
  let current = "";
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= MAX_CHUNK_CHARS) { current = candidate; continue; }
    if (current.length >= MIN_CHUNK_CHARS) {
      chunks.push({ chunkIndex, pageNumberStart: null, pageNumberEnd: null, text: current, charCount: current.length });
      chunkIndex++;
      current = "";
    }
    if (paragraph.length <= MAX_CHUNK_CHARS) { current = paragraph; continue; }
    for (const slice of sliceLargeText(paragraph, MAX_CHUNK_CHARS)) {
      chunks.push({ chunkIndex, pageNumberStart: null, pageNumberEnd: null, text: slice, charCount: slice.length });
      chunkIndex++;
    }
    current = "";
  }

  if (current.trim()) {
    chunks.push({ chunkIndex, pageNumberStart: null, pageNumberEnd: null, text: current.trim(), charCount: current.trim().length });
  }

  return chunks;
}

// ── processamento ─────────────────────────────────────────────────────────────

const { buffer } = workerData;

try {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();

  const extractedText = (result.text || "").trim();

  parentPort.postMessage({
    ok: true,
    result: {
      extractedText,
      pageCount: tryExtractPageCount(result),
      chunks: extractedText ? buildChunksFromExtractedText(extractedText) : [],
      summary: extractedText ? buildSummaryFromText(extractedText) : null,
    },
  });
} catch (error) {
  parentPort.postMessage({
    ok: false,
    error: error instanceof Error ? error.message : "UNKNOWN_PDF_PROCESSING_ERROR",
  });
}
