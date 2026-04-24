import { z } from "zod";
import { prisma } from "../../lib/prisma.js";

export const searchDocumentContentInputSchema = z.object({
  projectId: z.string().min(1),
  query: z.string().min(1),
  documentId: z.string().min(1).nullable().optional(),
  limit: z.number().int().min(1).max(20).optional().default(5),
});

export async function searchDocumentContent(input: unknown) {
  const { projectId, query, documentId, limit } =
    searchDocumentContentInputSchema.parse(input);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });

  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  if (documentId) {
    const document = await prisma.projectDocument.findFirst({
      where: {
        id: documentId,
        projectId,
      },
      select: {
        id: true,
        processingStatus: true,
      },
    });

    if (!document) {
      throw new Error("DOCUMENT_NOT_FOUND");
    }

    if (document.processingStatus !== "READY") {
      return {
        query,
        documentId,
        total: 0,
        results: [],
        notes: ["O documento informado não está com processingStatus READY."],
      };
    }
  }

  const normalizedQuery = normalizeSearchQuery(query);
  const terms = extractSearchTerms(normalizedQuery);

  if (terms.length === 0) {
    return {
      query,
      documentId: documentId ?? null,
      total: 0,
      results: [],
      notes: [
        "A consulta não gerou termos úteis para busca após normalização.",
      ],
    };
  }

  const baseWhere = {
    ...(documentId ? { documentId } : {}),
    document: {
      projectId,
      processingStatus: "READY" as const,
    },
  };

  const exactPhraseMatches = await prisma.projectDocumentChunk.findMany({
    where: {
      ...baseWhere,
      text: {
        contains: query,
        mode: "insensitive",
      },
    },
    include: {
      document: {
        select: {
          id: true,
          fileName: true,
          summary: true,
          pageCount: true,
        },
      },
    },
    take: 50,
    orderBy: [{ documentId: "asc" as const }, { chunkIndex: "asc" as const }],
  });

  const tokenMatches =
    terms.length > 0
      ? await prisma.projectDocumentChunk.findMany({
          where: {
            ...baseWhere,
            OR: terms.map((term) => ({
              text: {
                contains: term,
                mode: "insensitive" as const,
              },
            })),
          },
          include: {
            document: {
              select: {
                id: true,
                fileName: true,
                summary: true,
                pageCount: true,
              },
            },
          },
          take: 200,
          orderBy: [
            { documentId: "asc" as const },
            { chunkIndex: "asc" as const },
          ],
        })
      : [];

  const deduped = dedupeChunks([...exactPhraseMatches, ...tokenMatches]);

  const ranked = deduped
    .map((chunk) => rankChunkMatch(chunk, query, terms))
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.document.fileName !== b.document.fileName) {
        return a.document.fileName.localeCompare(b.document.fileName);
      }
      return a.chunkIndex - b.chunkIndex;
    })
    .slice(0, limit);

  return {
    query,
    documentId: documentId ?? null,
    normalizedQuery,
    terms,
    total: ranked.length,
    results: ranked.map((item) => ({
      documentId: item.document.id,
      fileName: item.document.fileName,
      documentSummary: item.document.summary,
      chunkId: item.id,
      chunkIndex: item.chunkIndex,
      pageNumberStart: item.pageNumberStart,
      pageNumberEnd: item.pageNumberEnd,
      score: item.score,
      matchType: item.matchType,
      matchedTerms: item.matchedTerms,
      excerpt: buildExcerpt(item.text, query, terms, 280),
    })),
  };
}

function normalizeSearchQuery(query: string) {
  return query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function extractSearchTerms(normalizedQuery: string) {
  const stopwords = new Set([
    "a",
    "o",
    "e",
    "de",
    "da",
    "do",
    "das",
    "dos",
    "em",
    "no",
    "na",
    "nos",
    "nas",
    "para",
    "por",
    "com",
    "sem",
    "um",
    "uma",
    "uns",
    "umas",
    "ou",
    "ao",
    "aos",
    "as",
    "os",
    "the",
    "and",
    "for",
    "with",
    "from",
    "into",
    "this",
    "that",
    "your",
    "you",
    "are",
    "was",
    "were",
    "not",
    "can",
    "will",
    "how",
    "what",
    "when",
    "where",
  ]);

  return normalizedQuery
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && !stopwords.has(term));
}

function dedupeChunks<
  T extends {
    id: string;
  },
>(items: T[]) {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }

  return result;
}

function rankChunkMatch(
  chunk: {
    id: string;
    chunkIndex: number;
    pageNumberStart: number | null;
    pageNumberEnd: number | null;
    text: string;
    document: {
      id: string;
      fileName: string;
      summary: string | null;
      pageCount: number | null;
    };
  },
  rawQuery: string,
  terms: string[],
) {
  const loweredText = chunk.text.toLowerCase();
  const loweredRawQuery = rawQuery.toLowerCase();

  const exactOccurrences = countOccurrences(loweredText, loweredRawQuery);

  let score = 0;
  let matchType: "exact_phrase" | "term_match" | "mixed" = "term_match";
  const matchedTerms: string[] = [];

  if (exactOccurrences > 0) {
    score += exactOccurrences * 10;
    matchType = "exact_phrase";
  }

  for (const term of terms) {
    const occurrences = countOccurrences(loweredText, term.toLowerCase());
    if (occurrences > 0) {
      matchedTerms.push(term);
      score += occurrences * 3;
    }
  }

  if (exactOccurrences > 0 && matchedTerms.length > 0) {
    matchType = "mixed";
  }

  if (matchedTerms.length >= 2) {
    score += 4;
  }

  if (matchedTerms.length >= 3) {
    score += 4;
  }

  if (chunk.chunkIndex < 3) {
    score += 1;
  }

  if (chunk.document.fileName.toLowerCase().includes(terms[0] ?? "")) {
    score += 2;
  }

  return {
    ...chunk,
    score,
    matchType,
    matchedTerms,
  };
}

function countOccurrences(text: string, term: string) {
  if (!term) return 0;

  let count = 0;
  let start = 0;

  while (true) {
    const index = text.indexOf(term, start);
    if (index === -1) break;
    count += 1;
    start = index + term.length;
  }

  return count;
}

function buildExcerpt(
  text: string,
  rawQuery: string,
  terms: string[],
  maxLength: number,
) {
  const loweredText = text.toLowerCase();
  const searchCandidates = [rawQuery, ...terms].filter(Boolean);

  let bestIndex = -1;
  let bestNeedle = "";

  for (const candidate of searchCandidates) {
    const index = loweredText.indexOf(candidate.toLowerCase());
    if (index !== -1) {
      bestIndex = index;
      bestNeedle = candidate;
      break;
    }
  }

  if (bestIndex === -1) {
    return truncateWhitespace(text, maxLength);
  }

  const contextBefore = 110;
  const contextAfter = Math.max(
    80,
    maxLength - contextBefore - bestNeedle.length,
  );

  const start = Math.max(0, bestIndex - contextBefore);
  const end = Math.min(
    text.length,
    bestIndex + bestNeedle.length + contextAfter,
  );

  const excerpt = text.slice(start, end).trim();
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";

  return `${prefix}${collapseWhitespace(excerpt)}${suffix}`;
}

function truncateWhitespace(text: string, maxLength: number) {
  const collapsed = collapseWhitespace(text);
  if (collapsed.length <= maxLength) {
    return collapsed;
  }

  return `${collapsed.slice(0, maxLength).trim()}...`;
}

function collapseWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}
