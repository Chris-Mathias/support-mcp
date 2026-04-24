import { z } from "zod";
import { prisma } from "../../lib/prisma.js";

export const listProjectDocumentsInputSchema = z.object({
  projectId: z.string().min(1),
  status: z
    .enum(["PENDING", "PROCESSING", "READY", "FAILED", "UNSUPPORTED"])
    .nullable()
    .optional(),
  onlyReady: z.boolean().optional().default(false),
  fileNameContains: z.string().optional().default(""),
  limit: z.number().int().min(1).max(100).optional().default(20),
  orderBy: z
    .enum(["createdAt_desc", "createdAt_asc", "fileName_asc", "fileName_desc"])
    .optional()
    .default("createdAt_desc"),
});

type ListProjectDocumentsInput = z.infer<
  typeof listProjectDocumentsInputSchema
>;

export async function listProjectDocuments(input: unknown) {
  const parsed = listProjectDocumentsInputSchema.parse(input);

  const project = await prisma.project.findUnique({
    where: { id: parsed.projectId },
    select: { id: true },
  });

  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  const where = {
    projectId: parsed.projectId,
    ...(parsed.status
      ? { processingStatus: parsed.status }
      : parsed.onlyReady
        ? { processingStatus: "READY" as const }
        : {}),
    ...(parsed.fileNameContains?.trim()
      ? {
          fileName: {
            contains: parsed.fileNameContains.trim(),
            mode: "insensitive" as const,
          },
        }
      : {}),
  };

  const documents = await prisma.projectDocument.findMany({
    where,
    orderBy: mapOrderBy(parsed.orderBy),
    take: parsed.limit,
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

  const items = documents.map((doc) => {
    const chunkCount = doc._count.chunks;
    const isUsable = doc.processingStatus === "READY" && chunkCount > 0;

    return {
      documentId: doc.id,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      pageCount: doc.pageCount,
      summary: doc.summary,
      processingStatus: doc.processingStatus,
      processingError: doc.processingError,
      chunkCount,
      isUsable,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  });

  return {
    total: items.length,
    filters: {
      status: parsed.status ?? null,
      onlyReady: parsed.onlyReady,
      fileNameContains: parsed.fileNameContains ?? null,
      limit: parsed.limit,
      orderBy: parsed.orderBy,
    },
    documents: items,
  };
}

function mapOrderBy(orderBy: ListProjectDocumentsInput["orderBy"]) {
  switch (orderBy) {
    case "createdAt_asc":
      return { createdAt: "asc" as const };
    case "fileName_asc":
      return { fileName: "asc" as const };
    case "fileName_desc":
      return { fileName: "desc" as const };
    case "createdAt_desc":
    default:
      return { createdAt: "desc" as const };
  }
}
