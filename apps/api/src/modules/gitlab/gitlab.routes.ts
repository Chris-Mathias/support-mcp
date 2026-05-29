import type { FastifyInstance } from "fastify";
import {
  createGitlabIntegrationSchema,
  fileContentQuerySchema,
  listFilesQuerySchema,
  projectParamsSchema,
} from "./gitlab.schemas.js";
import { GitlabService } from "./gitlab.service.js";

const INVALID_PARAMS = "Parâmetros inválidos";

export async function gitlabRoutes(app: FastifyInstance) {
  const gitlabService = new GitlabService();
  app.post(
    "/projects/:projectId/gitlab-integration",
    async (request, reply) => {
      const parsedParams = projectParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({
          message: INVALID_PARAMS,
          issues: parsedParams.error.flatten(),
        });
      }

      const parsed = createGitlabIntegrationSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          message: "Payload inválido",
          issues: parsed.error.flatten(),
        });
      }

      try {
        const integration = await gitlabService.createOrUpdateIntegration(
          parsedParams.data.projectId,
          parsed.data,
        );

        return reply.status(201).send(integration);
      } catch (error) {
        if (!(error instanceof Error)) throw error;

        if (error.message === "PROJECT_NOT_FOUND") {
          return reply.status(404).send({ message: "Projeto não encontrado" });
        }

        if (error.message === "TOKEN_REQUIRED") {
          return reply.status(400).send({
            message: "Token é obrigatório para nova integração.",
          });
        }

        if (error.message === "GITLAB_ACCESS_INVALID") {
          return reply.status(400).send({
            message:
              "Não foi possível validar acesso ao repositório/branch no GitLab",
          });
        }

        throw error;
      }
    },
  );

  app.get("/projects/:projectId/gitlab-integration", async (request, reply) => {
    const parsedParams = projectParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        message: INVALID_PARAMS,
        issues: parsedParams.error.flatten(),
      });
    }

    const integration = await gitlabService.getIntegration(
      parsedParams.data.projectId,
    );

    if (!integration) {
      return reply.status(404).send({
        message: "Integração GitLab não encontrada",
      });
    }

    return integration;
  });

  app.get("/projects/:projectId/gitlab/files", async (request, reply) => {
    const parsedParams = projectParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        message: INVALID_PARAMS,
        issues: parsedParams.error.flatten(),
      });
    }

    const parsedQuery = listFilesQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return reply.status(400).send({
        message: INVALID_PARAMS,
        issues: parsedQuery.error.flatten(),
      });
    }

    try {
      return await gitlabService.listFiles(
        parsedParams.data.projectId,
        parsedQuery.data.path || "",
      );
    } catch (error) {
      if (!(error instanceof Error)) throw error;

      if (error.message === "INTEGRATION_NOT_FOUND") {
        return reply.status(404).send({
          message: "Integração GitLab não encontrada",
        });
      }

      if (error.message === "INTEGRATION_TOKEN_INVALID") {
        return reply.status(400).send({
          message:
            "Token da integração está corrompido. Reconfigure a integração GitLab.",
        });
      }

      throw error;
    }
  });

  app.get(
    "/projects/:projectId/gitlab/file-content",
    async (request, reply) => {
      const parsedParams = projectParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({
          message: INVALID_PARAMS,
          issues: parsedParams.error.flatten(),
        });
      }

      const parsedQuery = fileContentQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        return reply.status(400).send({
          message: INVALID_PARAMS,
          issues: parsedQuery.error.flatten(),
        });
      }

      try {
        return await gitlabService.getFileContent(
          parsedParams.data.projectId,
          parsedQuery.data.filePath,
        );
      } catch (error) {
        if (!(error instanceof Error)) throw error;

        if (error.message === "INTEGRATION_NOT_FOUND") {
          return reply.status(404).send({
            message: "Integração GitLab não encontrada",
          });
        }

        if (error.message === "INTEGRATION_TOKEN_INVALID") {
          return reply.status(400).send({
            message:
              "Token da integração está corrompido. Reconfigure a integração GitLab.",
          });
        }

        throw error;
      }
    },
  );
}
