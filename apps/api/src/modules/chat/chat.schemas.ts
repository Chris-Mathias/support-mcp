import { z } from "zod";

export const sessionParamsSchema = z.object({
  sessionId: z.string().min(1),
});

export const projectParamsSchema = z.object({
  projectId: z.string().min(1),
});

export const listMessagesQuerySchema = z.object({
  projectId: z.string().min(1, "projectId é obrigatório"),
});

export const deleteSessionBodySchema = z.object({
  projectId: z.string().min(1, "projectId é obrigatório"),
});

export const createChatSessionSchema = z.object({
  projectId: z.string().min(1, "projectId é obrigatório"),
});

export const createChatMessageSchema = z.object({
  projectId: z.string().min(1, "projectId é obrigatório"),
  role: z.enum(["user", "assistant"]),
  content: z
    .string()
    .min(1, "content é obrigatório")
    .max(4000, "content deve ter no máximo 4000 caracteres"),
});

export type CreateChatSessionInput = z.infer<typeof createChatSessionSchema>;
export type CreateChatMessageInput = z.infer<typeof createChatMessageSchema>;
