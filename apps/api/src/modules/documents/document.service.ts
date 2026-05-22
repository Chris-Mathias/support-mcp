import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { prisma } from "../../lib/prisma.js";
import type { PdfProcessingResult } from "../../lib/pdf-processor.js";
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

type WorkerMessage =
  | { ok: true; result: PdfProcessingResult }
  | { ok: false; error: string };

function runPdfWorker(buffer: Buffer): Promise<PdfProcessingResult> {
  return new Promise((resolve, reject) => {
    // pdf-worker.mjs é JavaScript puro — carregável sem qualquer loader TypeScript
    // em dev:  src/lib/pdf-worker.mjs  (resolvido por path.resolve relativo ao .ts)
    // em prod: dist/lib/pdf-worker.mjs (copiado pelo build script)
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const workerPath = path.resolve(__dirname, "../../lib/pdf-worker.mjs");

    const worker = new Worker(workerPath, {
      workerData: { buffer },
    });

    worker.on("message", (msg: WorkerMessage) => {
      if (msg.ok) {
        resolve(msg.result);
      } else {
        reject(new Error(msg.error ?? "PDF_WORKER_ERROR"));
      }
    });

    worker.on("error", reject);

    worker.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`PDF worker exited with code ${code}`));
      }
    });
  });
}

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
      const { extractedText, pageCount, chunks, summary } = await runPdfWorker(
        data.buffer,
      );

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

  private buildSafeFileName(fileName: string) {
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);

    const normalizedBase = base
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .toLowerCase();

    const timestamp = Date.now();

    return `${normalizedBase}_${timestamp}${ext.toLowerCase()}`;
  }
}
