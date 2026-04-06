import { z } from "zod";

export const createProjectSchema = z.object({
  name: z
    .string()
    .min(3, "Nome deve ter pelo menos 3 caracteres")
    .max(120, "Nome deve ter no máximo 120 caracteres"),
  description: z
    .string()
    .max(500, "Descrição deve ter no máximo 500 caracteres")
    .optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
