import { z } from "zod";
import { prisma } from "../../lib/prisma.js";

export const readDocumentExcerptInputSchema = z.object({
  projectId: z.string().min(1),
  documentId: z.string().min(1),
  chunkId: z.string().min(1).nullable().optional(),
  chunkIndex: z.number().int().min(0).nullable().optional(),
  query: z.string().optional().default(""),
  before: z.number().int().min(0).max(10).optional().default(0),
  after: z.number().int().min(0).max(10).optional().default(0),
});

export async function readDocumentExcerpt(input: unknown) {
  const { projectId, documentId, chunkId, chunkIndex, query, before, after } =
    readDocumentExcerptInputSchema.parse(input);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });

  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  const document = await prisma.projectDocument.findFirst({
    where: {
      id: documentId,
      projectId,
    },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      pageCount: true,
      summary: true,
      processingStatus: true,
      processingError: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          chunks: true,
        },
      },
    },
  });

  if (!document) {
    throw new Error("DOCUMENT_NOT_FOUND");
  }

  if (document.processingStatus !== "READY") {
    return {
      document: {
        documentId: document.id,
        fileName: document.fileName,
        processingStatus: document.processingStatus,
        processingError: document.processingError,
        chunkCount: document._count.chunks,
      },
      excerpt: null,
      notes: [
        "O documento não está com processingStatus READY e não pode ser lido de forma navegável no MVP.",
      ],
    };
  }

  const resolution = await resolveAnchorChunk({
    documentId,
    chunkId: chunkId ?? null,
    chunkIndex: chunkIndex ?? null,
    query: query.trim(),
  });

  if (!resolution.anchorChunk) {
    return {
      document: {
        documentId: document.id,
        fileName: document.fileName,
        processingStatus: document.processingStatus,
        processingError: document.processingError,
        chunkCount: document._count.chunks,
      },
      excerpt: null,
      notes: [
        resolution.note ?? "Nenhum trecho correspondente foi encontrado.",
      ],
    };
  }

  const startIndex = Math.max(0, resolution.anchorChunk.chunkIndex - before);
  const endIndex = resolution.anchorChunk.chunkIndex + after;

  const chunks = await prisma.projectDocumentChunk.findMany({
    where: {
      documentId,
      chunkIndex: {
        gte: startIndex,
        lte: endIndex,
      },
    },
    orderBy: {
      chunkIndex: "asc",
    },
    select: {
      id: true,
      chunkIndex: true,
      pageNumberStart: true,
      pageNumberEnd: true,
      text: true,
      charCount: true,
      createdAt: true,
    },
  });

  const joinedText = chunks.map((chunk) => chunk.text).join("\n\n");
  const pageRange = buildPageRange(chunks);

  return {
    document: {
      documentId: document.id,
      fileName: document.fileName,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      pageCount: document.pageCount,
      summary: document.summary,
      processingStatus: document.processingStatus,
      chunkCount: document._count.chunks,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    },
    excerpt: {
      mode: resolution.mode,
      query: query.trim() || null,
      anchor: {
        chunkId: resolution.anchorChunk.id,
        chunkIndex: resolution.anchorChunk.chunkIndex,
        pageNumberStart: resolution.anchorChunk.pageNumberStart,
        pageNumberEnd: resolution.anchorChunk.pageNumberEnd,
      },
      range: {
        startChunkIndex:
          chunks[0]?.chunkIndex ?? resolution.anchorChunk.chunkIndex,
        endChunkIndex:
          chunks[chunks.length - 1]?.chunkIndex ??
          resolution.anchorChunk.chunkIndex,
        before,
        after,
        totalChunksReturned: chunks.length,
        pageRange,
      },
      text: joinedText,
      chunks: chunks.map((chunk) => ({
        chunkId: chunk.id,
        chunkIndex: chunk.chunkIndex,
        pageNumberStart: chunk.pageNumberStart,
        pageNumberEnd: chunk.pageNumberEnd,
        charCount: chunk.charCount,
      })),
    },
  };
}

async function resolveAnchorChunk(params: {
  documentId: string;
  chunkId: string | null;
  chunkIndex: number | null;
  query: string;
}) {
  if (params.chunkId) {
    const chunk = await prisma.projectDocumentChunk.findFirst({
      where: {
        id: params.chunkId,
        documentId: params.documentId,
      },
      select: {
        id: true,
        chunkIndex: true,
        pageNumberStart: true,
        pageNumberEnd: true,
        text: true,
      },
    });

    if (chunk) {
      return {
        mode: "chunk_id" as const,
        anchorChunk: chunk,
        note: null,
      };
    }

    return {
      mode: "chunk_id" as const,
      anchorChunk: null,
      note: "O chunkId informado não pertence ao documento.",
    };
  }

  if (params.chunkIndex !== null && params.chunkIndex !== undefined) {
    const chunk = await prisma.projectDocumentChunk.findFirst({
      where: {
        documentId: params.documentId,
        chunkIndex: params.chunkIndex,
      },
      select: {
        id: true,
        chunkIndex: true,
        pageNumberStart: true,
        pageNumberEnd: true,
        text: true,
      },
    });

    if (chunk) {
      return {
        mode: "chunk_index" as const,
        anchorChunk: chunk,
        note: null,
      };
    }

    return {
      mode: "chunk_index" as const,
      anchorChunk: null,
      note: "O chunkIndex informado não foi encontrado no documento.",
    };
  }

  if (params.query) {
    const chunks = await prisma.projectDocumentChunk.findMany({
      where: {
        documentId: params.documentId,
        text: {
          contains: params.query,
          mode: "insensitive",
        },
      },
      orderBy: {
        chunkIndex: "asc",
      },
      take: 20,
      select: {
        id: true,
        chunkIndex: true,
        pageNumberStart: true,
        pageNumberEnd: true,
        text: true,
      },
    });

    if (chunks.length > 0) {
      const ranked = chunks
        .map((chunk) => ({
          chunk,
          score: rankChunkForAnchor(chunk.text, params.query),
        }))
        .sort((a, b) => b.score - a.score);

      return {
        mode: "query" as const,
        anchorChunk: ranked[0].chunk,
        note: null,
      };
    }

    const normalizedTerms = extractTerms(params.query);

    if (normalizedTerms.length > 0) {
      const fallbackChunks = await prisma.projectDocumentChunk.findMany({
        where: {
          documentId: params.documentId,
          OR: normalizedTerms.map((term) => ({
            text: {
              contains: term,
              mode: "insensitive" as const,
            },
          })),
        },
        orderBy: {
          chunkIndex: "asc",
        },
        take: 50,
        select: {
          id: true,
          chunkIndex: true,
          pageNumberStart: true,
          pageNumberEnd: true,
          text: true,
        },
      });

      if (fallbackChunks.length > 0) {
        const ranked = fallbackChunks
          .map((chunk) => ({
            chunk,
            score: rankChunkForAnchor(chunk.text, params.query),
          }))
          .sort((a, b) => b.score - a.score);

        return {
          mode: "query" as const,
          anchorChunk: ranked[0].chunk,
          note: null,
        };
      }
    }

    return {
      mode: "query" as const,
      anchorChunk: null,
      note: "Nenhum trecho foi encontrado para a query informada neste documento.",
    };
  }

  const firstChunk = await prisma.projectDocumentChunk.findFirst({
    where: {
      documentId: params.documentId,
    },
    orderBy: {
      chunkIndex: "asc",
    },
    select: {
      id: true,
      chunkIndex: true,
      pageNumberStart: true,
      pageNumberEnd: true,
      text: true,
    },
  });

  if (firstChunk) {
    return {
      mode: "initial" as const,
      anchorChunk: firstChunk,
      note: null,
    };
  }

  return {
    mode: "initial" as const,
    anchorChunk: null,
    note: "O documento não possui chunks disponíveis para leitura.",
  };
}

function rankChunkForAnchor(text: string, rawQuery: string) {
  const loweredText = text.toLowerCase();
  const loweredQuery = rawQuery.toLowerCase();

  let score = 0;

  const exactCount = countOccurrences(loweredText, loweredQuery);
  score += exactCount * 10;

  const terms = extractTerms(rawQuery);
  const matchedTerms = new Set<string>();

  for (const term of terms) {
    const count = countOccurrences(loweredText, term.toLowerCase());
    if (count > 0) {
      matchedTerms.add(term);
      score += count * 3;
    }
  }

  if (matchedTerms.size >= 2) {
    score += 4;
  }

  if (matchedTerms.size >= 3) {
    score += 4;
  }

  return score;
}

function countOccurrences(text: string, needle: string) {
  if (!needle) return 0;

  let count = 0;
  let start = 0;

  while (true) {
    const index = text.indexOf(needle, start);
    if (index === -1) break;
    count += 1;
    start = index + needle.length;
  }

  return count;
}

function extractTerms(query: string) {
  const normalized = query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

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
    "not",
    "can",
    "will",
  ]);

  return normalized
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && !stopwords.has(term));
}

function buildPageRange(
  chunks: Array<{
    pageNumberStart: number | null;
    pageNumberEnd: number | null;
  }>,
) {
  const starts = chunks
    .map((chunk) => chunk.pageNumberStart)
    .filter((value): value is number => value !== null);

  const ends = chunks
    .map((chunk) => chunk.pageNumberEnd)
    .filter((value): value is number => value !== null);

  if (starts.length === 0 && ends.length === 0) {
    return null;
  }

  const start = starts.length > 0 ? Math.min(...starts) : null;
  const end = ends.length > 0 ? Math.max(...ends) : start;

  return {
    start,
    end,
  };
}
