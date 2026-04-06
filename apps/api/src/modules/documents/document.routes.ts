import type { FastifyInstance } from "fastify";
import { DocumentService } from "./document.service.js";

const documentService = new DocumentService();

export async function documentRoutes(app: FastifyInstance) {
  app.post("/projects/:projectId/documents", async (request, reply) => {
    const { projectId } = request.params as { projectId: string };

    const file = await request.file();

    if (!file) {
      return reply.status(400).send({
        message: "Arquivo é obrigatório",
      });
    }

    const buffer = await file.toBuffer();

    try {
      const document = await documentService.create({
        projectId,
        fileName: file.filename,
        mimeType: file.mimetype,
        fileSize: buffer.length,
        buffer,
      });

      return reply.status(201).send(document);
    } catch (error) {
      if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
        return reply.status(404).send({
          message: "Projeto não encontrado",
        });
      }

      throw error;
    }
  });

  app.get("/projects/:projectId/documents", async (request, reply) => {
    const { projectId } = request.params as { projectId: string };

    try {
      return await documentService.listByProject(projectId);
    } catch (error) {
      if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
        return reply.status(404).send({
          message: "Projeto não encontrado",
        });
      }

      throw error;
    }
  });

  app.get(
    "/projects/:projectId/documents/:documentId",
    async (request, reply) => {
      const { projectId, documentId } = request.params as {
        projectId: string;
        documentId: string;
      };

      const document = await documentService.getById(projectId, documentId);

      if (!document) {
        return reply.status(404).send({
          message: "Documento não encontrado",
        });
      }

      return document;
    },
  );

  app.delete(
    "/projects/:projectId/documents/:documentId",
    async (request, reply) => {
      const { projectId, documentId } = request.params as {
        projectId: string;
        documentId: string;
      };

      try {
        const result = await documentService.remove(projectId, documentId);
        return reply.send(result);
      } catch (error) {
        if (error instanceof Error && error.message === "DOCUMENT_NOT_FOUND") {
          return reply.status(404).send({
            message: "Documento não encontrado",
          });
        }

        throw error;
      }
    },
  );
}
