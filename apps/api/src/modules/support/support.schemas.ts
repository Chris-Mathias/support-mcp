import { z } from "zod";

export const sessionParamsSchema = z.object({
  sessionId: z.string().min(1),
});

export const askQuestionSchema = z.object({
  projectId: z.string().min(1, "projectId é obrigatório"),
  question: z.string().min(1, "question é obrigatória").max(4000),
});

export type AskQuestionInput = z.infer<typeof askQuestionSchema>;
