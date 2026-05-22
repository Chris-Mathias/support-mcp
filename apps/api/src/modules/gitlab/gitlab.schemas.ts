import { z } from "zod";

export const projectParamsSchema = z.object({
  projectId: z.string().min(1),
});

export const listFilesQuerySchema = z.object({
  path: z.string().optional(),
});

export const fileContentQuerySchema = z.object({
  filePath: z.string().min(1, "filePath é obrigatório"),
});

export const createGitlabIntegrationSchema = z.object({
  repoUrl: z.string().url("repoUrl inválida"),
  projectPath: z.string().min(1, "projectPath é obrigatório"),
  branch: z.string().min(1, "branch é obrigatória"),
  token: z.string().min(1, "token é obrigatório").optional(),
});

export type CreateGitlabIntegrationInput = z.infer<
  typeof createGitlabIntegrationSchema
>;
