import path from "node:path";
import { PDFParse } from "pdf-parse";
import { prisma } from "../../lib/prisma.js";
import {
  buildStoredFilePath,
  deleteFileFromDisk,
  ensureProjectUploadDir,
  saveFileToDisk,
} from "../../lib/storage.js";

type CreateDocumentInput = {
  projectId: string;
  fileName: string;
  mimeType?: string;
  fileSize?: number;
  buffer: Buffer;
};

type DocumentChunkInput = {
  chunkIndex: number;
  pageNumberStart?: number | null;
  pageNumberEnd?: number | null;
  text: string;
  charCount: number;
};

const MAX_CHUNK_CHARS = 1800;
const MIN_CHUNK_CHARS = 400;

export class DocumentService {
  async create(data: CreateDocumentInput) {
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
      select: { id: true },
    });

    if (!project) {
      throw new Error("PROJECT_NOT_FOUND");
    }

    await ensureProjectUploadDir(project.id);

    const safeFileName = this.buildSafeFileName(data.fileName);
    const storedFilePath = buildStoredFilePath(project.id, safeFileName);

    await saveFileToDisk(storedFilePath, data.buffer);

    const document = await prisma.projectDocument.create({
      data: {
        projectId: project.id,
        fileName: safeFileName,
        filePath: storedFilePath,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
        processingStatus: this.isPdf(data.mimeType, safeFileName)
          ? "PROCESSING"
          : "UNSUPPORTED",
      },
    });

    if (!this.isPdf(data.mimeType, safeFileName)) {
      return document;
    }

    try {
      const parser = new PDFParse({ data: data.buffer });
      const result = await parser.getText();
      const extractedText = (result.text || "").trim();

      await parser.destroy();

      if (!extractedText) {
        return prisma.projectDocument.update({
          where: { id: document.id },
          data: {
            extractedText: "",
            pageCount: null,
            summary: null,
            processingStatus: "UNSUPPORTED",
            processingError: "PDF_TEXT_EXTRACTION_EMPTY",
          },
        });
      }

      const chunks = this.buildChunksFromExtractedText(extractedText);
      const summary = this.buildSummaryFromText(extractedText);
      const pageCount = this.tryExtractPageCount(result);

      await prisma.$transaction([
        prisma.projectDocument.update({
          where: { id: document.id },
          data: {
            extractedText,
            pageCount,
            summary,
            processingStatus: "READY",
            processingError: null,
          },
        }),
        ...(chunks.length > 0
          ? [
              prisma.projectDocumentChunk.createMany({
                data: chunks.map((chunk) => ({
                  documentId: document.id,
                  chunkIndex: chunk.chunkIndex,
                  pageNumberStart: chunk.pageNumberStart ?? null,
                  pageNumberEnd: chunk.pageNumberEnd ?? null,
                  text: chunk.text,
                  charCount: chunk.charCount,
                })),
              }),
            ]
          : []),
      ]);

      return prisma.projectDocument.findUniqueOrThrow({
        where: { id: document.id },
        include: {
          chunks: {
            orderBy: { chunkIndex: "asc" },
          },
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "UNKNOWN_PDF_PROCESSING_ERROR";

      await prisma.projectDocument.update({
        where: { id: document.id },
        data: {
          processingStatus: "FAILED",
          processingError: message,
        },
      });

      throw error;
    }
  }

  async listByProject(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      throw new Error("PROJECT_NOT_FOUND");
    }

    return prisma.projectDocument.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        projectId: true,
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
      },
    });
  }

  async getById(projectId: string, documentId: string) {
    return prisma.projectDocument.findFirst({
      where: {
        id: documentId,
        projectId,
      },
      include: {
        chunks: {
          orderBy: { chunkIndex: "asc" },
        },
      },
    });
  }

  async remove(projectId: string, documentId: string) {
    const document = await prisma.projectDocument.findFirst({
      where: {
        id: documentId,
        projectId,
      },
      select: {
        id: true,
        filePath: true,
      },
    });

    if (!document) {
      throw new Error("DOCUMENT_NOT_FOUND");
    }

    try {
      await deleteFileFromDisk(document.filePath);
    } catch {}

    await prisma.projectDocument.delete({
      where: {
        id: document.id,
      },
    });

    return { success: true };
  }

  async searchChunks(projectId: string, query: string, limit = 10) {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return [];
    }

    return prisma.projectDocumentChunk.findMany({
      where: {
        document: {
          projectId,
          processingStatus: "READY",
        },
        text: {
          contains: normalizedQuery,
          mode: "insensitive",
        },
      },
      include: {
        document: {
          select: {
            id: true,
            fileName: true,
            summary: true,
          },
        },
      },
      take: limit,
      orderBy: {
        chunkIndex: "asc",
      },
    });
  }

  async getChunkExcerpt(
    projectId: string,
    documentId: string,
    chunkIndex: number,
  ) {
    return prisma.projectDocumentChunk.findFirst({
      where: {
        documentId,
        chunkIndex,
        document: {
          projectId,
        },
      },
      include: {
        document: {
          select: {
            id: true,
            fileName: true,
            pageCount: true,
            summary: true,
          },
        },
      },
    });
  }

  private isPdf(mimeType?: string, fileName?: string) {
    return (
      mimeType === "application/pdf" ||
      (fileName ? fileName.toLowerCase().endsWith(".pdf") : false)
    );
  }

  private buildChunksFromExtractedText(text: string): DocumentChunkInput[] {
    const normalizedText = this.normalizeExtractedText(text);

    if (!normalizedText) {
      return [];
    }

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

      const hardSlices = this.sliceLargeText(paragraph, MAX_CHUNK_CHARS);
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

  private normalizeExtractedText(text: string) {
    return text
      .replace(/\r\n/g, "\n")
      .replace(/\t/g, " ")
      .replace(/[ \u00A0]+/g, " ")
      .replace(/\n[ ]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  private sliceLargeText(text: string, maxChars: number) {
    const slices: string[] = [];
    let remaining = text.trim();

    while (remaining.length > maxChars) {
      let splitAt = remaining.lastIndexOf(" ", maxChars);

      if (splitAt < Math.floor(maxChars * 0.6)) {
        splitAt = maxChars;
      }

      const piece = remaining.slice(0, splitAt).trim();
      if (piece) {
        slices.push(piece);
      }

      remaining = remaining.slice(splitAt).trim();
    }

    if (remaining) {
      slices.push(remaining);
    }

    return slices;
  }

  private buildSummaryFromText(text: string) {
    const normalized = this.normalizeExtractedText(text);

    if (!normalized) {
      return null;
    }

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

  private tryExtractPageCount(result: unknown): number | null {
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

  private buildSafeFileName(fileName: string) {
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);

    const normalizedBase = base
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .toLowerCase();

    const timestamp = Date.now();

    return `${normalizedBase}_${timestamp}${ext.toLowerCase()}`;
  }
}
