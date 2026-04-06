import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { buildExcerpt } from "../lib/excerpt.js";

export const getDocumentExcerptInputSchema = z.object({
  projectId: z.string().min(1),
  documentId: z.string().min(1),
  query: z.string().min(1),
});

export async function getDocumentExcerpt(input: unknown) {
  const { projectId, documentId, query } =
    getDocumentExcerptInputSchema.parse(input);

  const document = await prisma.projectDocument.findFirst({
    where: {
      id: documentId,
      projectId,
    },
  });

  if (!document) {
    throw new Error("DOCUMENT_NOT_FOUND");
  }

  return {
    projectId,
    documentId: document.id,
    fileName: document.fileName,
    excerpt: buildExcerpt(document.extractedText ?? "", query),
  };
}
