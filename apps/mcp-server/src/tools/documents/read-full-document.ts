import { z } from "zod";
import { prisma } from "../../lib/prisma.js";

const MAX_FULL_DOCUMENT_CHARS = 50_000;

export const readFullDocumentInputSchema = z.object({
  projectId: z.string().min(1),
  documentId: z.string().min(1),
});

export async function readFullDocument(input: unknown) {
  const { projectId, documentId } = readFullDocumentInputSchema.parse(input);

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
      filePath: true,
      mimeType: true,
      fileSize: true,
      pageCount: true,
      summary: true,
      processingStatus: true,
      processingError: true,
      createdAt: true,
      updatedAt: true,
      chunks: {
        orderBy: { chunkIndex: "asc" },
        select: { text: true },
      },
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

  const chunkCount = document._count.chunks;
  const extractedText = normalizeText(
    document.chunks.map((c) => c.text).join("\n\n"),
  );
  const isUsable = document.processingStatus === "READY" && chunkCount > 0;

  if (!isUsable) {
    return {
      document: {
        documentId: document.id,
        fileName: document.fileName,
        mimeType: document.mimeType,
        fileSize: document.fileSize,
        pageCount: document.pageCount,
        summary: document.summary,
        processingStatus: document.processingStatus,
        processingError: document.processingError,
        chunkCount,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      },
      content: null,
      truncated: false,
      notes: buildUnavailableNotes({
        processingStatus: document.processingStatus,
        chunkCount,
      }),
    };
  }

  const shouldTruncate = extractedText.length > MAX_FULL_DOCUMENT_CHARS;
  const returnedText = shouldTruncate
    ? extractedText.slice(0, MAX_FULL_DOCUMENT_CHARS).trim()
    : extractedText;

  return {
    document: {
      documentId: document.id,
      fileName: document.fileName,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      pageCount: document.pageCount,
      summary: document.summary,
      processingStatus: document.processingStatus,
      processingError: document.processingError,
      chunkCount,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    },
    content: returnedText,
    truncated: shouldTruncate,
    contentCharCount: returnedText.length,
    originalCharCount: extractedText.length,
    notes: buildReadNotes({
      shouldTruncate,
      originalCharCount: extractedText.length,
    }),
  };
}

function normalizeText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \u00A0]+/g, " ")
    .replace(/\n[ ]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildUnavailableNotes(params: {
  processingStatus: string;
  chunkCount: number;
}) {
  const notes: string[] = [];

  if (params.processingStatus !== "READY") {
    notes.push(
      `O documento não está disponível para leitura integral porque seu processingStatus é ${params.processingStatus}.`,
    );
  }

  if (params.chunkCount === 0) {
    notes.push("O documento não possui chunks indexados.");
  }

  if (notes.length === 0) {
    notes.push(
      "O documento não está disponível para leitura integral no momento.",
    );
  }

  return notes;
}

function buildReadNotes(params: {
  shouldTruncate: boolean;
  originalCharCount: number;
}) {
  const notes: string[] = [
    "Use leitura integral apenas quando realmente necessário; a inspeção padrão deve ser feita com read_document_excerpt.",
  ];

  if (params.shouldTruncate) {
    notes.push(
      `O conteúdo foi truncado para ${MAX_FULL_DOCUMENT_CHARS} caracteres por segurança operacional. O documento original possui ${params.originalCharCount} caracteres.`,
    );
  }

  return notes;
}
