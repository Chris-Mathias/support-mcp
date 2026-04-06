import { z } from "zod";

export const projectParamsSchema = z.object({
  projectId: z.string().min(1),
});

export const documentParamsSchema = z.object({
  projectId: z.string().min(1),
  documentId: z.string().min(1),
});
