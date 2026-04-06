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

export class DocumentService {
  async create(data: CreateDocumentInput) {
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
    });

    if (!project) {
      throw new Error("PROJECT_NOT_FOUND");
    }

    await ensureProjectUploadDir(project.id);

    const safeFileName = this.buildSafeFileName(data.fileName);
    const storedFilePath = buildStoredFilePath(project.id, safeFileName);

    await saveFileToDisk(storedFilePath, data.buffer);

    let extractedText: string | undefined = undefined;

    if (
      data.mimeType === "application/pdf" ||
      safeFileName.toLowerCase().endsWith(".pdf")
    ) {
      const parser = new PDFParse({ data: data.buffer });

      const result = await parser.getText();

      extractedText = result.text?.trim() || "";

      await parser.destroy();
    }

    return prisma.projectDocument.create({
      data: {
        projectId: project.id,
        fileName: safeFileName,
        filePath: storedFilePath,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
        extractedText,
      },
    });
  }

  async listByProject(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error("PROJECT_NOT_FOUND");
    }

    return prisma.projectDocument.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getById(projectId: string, documentId: string) {
    const document = await prisma.projectDocument.findFirst({
      where: {
        id: documentId,
        projectId,
      },
    });

    return document;
  }

  async remove(projectId: string, documentId: string) {
    const document = await prisma.projectDocument.findFirst({
      where: {
        id: documentId,
        projectId,
      },
    });

    if (!document) {
      throw new Error("DOCUMENT_NOT_FOUND");
    }

    try {
      await deleteFileFromDisk(document.filePath);
    } catch {
      // MVP: segue mesmo se o arquivo já não existir em disco
    }

    await prisma.projectDocument.delete({
      where: {
        id: document.id,
      },
    });

    return { success: true };
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
