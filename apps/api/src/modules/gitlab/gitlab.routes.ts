import type { FastifyInstance } from "fastify";
import { createGitlabIntegrationSchema } from "./gitlab.schemas.js";
import { GitlabService } from "./gitlab.service.js";

const gitlabService = new GitlabService();

export async function gitlabRoutes(app: FastifyInstance) {
  app.post(
    "/projects/:projectId/gitlab-integration",
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const parsed = createGitlabIntegrationSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          message: "Payload inválido",
          issues: parsed.error.flatten(),
        });
      }

      try {
        const integration = await gitlabService.createOrUpdateIntegration(
          projectId,
          parsed.data,
        );

        return reply.status(201).send(integration);
      } catch (error) {
        if (!(error instanceof Error)) throw error;

        if (error.message === "PROJECT_NOT_FOUND") {
          return reply.status(404).send({ message: "Projeto não encontrado" });
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
    const { projectId } = request.params as { projectId: string };

    const integration = await gitlabService.getIntegration(projectId);

    if (!integration) {
      return reply.status(404).send({
        message: "Integração GitLab não encontrada",
      });
    }

    return integration;
  });

  app.get("/projects/:projectId/gitlab/files", async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const { path } = request.query as { path?: string };

    try {
      return await gitlabService.listFiles(projectId, path || "");
    } catch (error) {
      if (error instanceof Error && error.message === "INTEGRATION_NOT_FOUND") {
        return reply.status(404).send({
          message: "Integração GitLab não encontrada",
        });
      }

      throw error;
    }
  });

  app.get(
    "/projects/:projectId/gitlab/file-content",
    async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const { filePath } = request.query as { filePath?: string };

      if (!filePath) {
        return reply.status(400).send({
          message: "filePath é obrigatório",
        });
      }

      try {
        return await gitlabService.getFileContent(projectId, filePath);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "INTEGRATION_NOT_FOUND"
        ) {
          return reply.status(404).send({
            message: "Integração GitLab não encontrada",
          });
        }

        throw error;
      }
    },
  );
}
