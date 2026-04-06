import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { buildExcerpt } from "../lib/excerpt.js";

export const searchProjectDocumentsInputSchema = z.object({
  projectId: z.string().min(1),
  query: z.string().min(1),
});

export async function searchProjectDocuments(input: unknown) {
  const { projectId, query } = searchProjectDocumentsInputSchema.parse(input);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  const documents = await prisma.projectDocument.findMany({
    where: {
      projectId,
      extractedText: {
        not: null,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const normalizedQuery = query.toLowerCase();

  const results = documents
    .map((doc) => {
      const text = doc.extractedText ?? "";
      const occurrences = text.toLowerCase().split(normalizedQuery).length - 1;

      return {
        documentId: doc.id,
        fileName: doc.fileName,
        score: occurrences,
        excerpt: buildExcerpt(text, query),
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return {
    projectId,
    query,
    total: results.length,
    results,
  };
}
