import type { FastifyInstance } from "fastify";
import {
  documentParamsSchema,
  projectParamsSchema,
} from "./document.schemas.js";
import { DocumentService } from "./document.service.js";

type DocumentRouteOptions = {
  rateLimitUpload: number;
  rateLimitWindow: string;
};

const INVALID_PARAMS = "Parâmetros inválidos";
const MAGIC_PDF = Buffer.from("%PDF-", "ascii");

export async function documentRoutes(app: FastifyInstance, opts: DocumentRouteOptions) {
  const documentService = new DocumentService();
  app.post("/projects/:projectId/documents", { config: { rateLimit: { max: opts.rateLimitUpload, timeWindow: opts.rateLimitWindow } } }, async (request, reply) => {
    const parsedParams = projectParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        message: INVALID_PARAMS,
        issues: parsedParams.error.flatten(),
      });
    }

    const file = await request.file();

    if (!file) {
      return reply.status(400).send({
        message: "Arquivo é obrigatório",
      });
    }

    const buffer = await file.toBuffer();

    if (!buffer.subarray(0, 5).equals(MAGIC_PDF)) {
      return reply.status(415).send({
        message: "Arquivo não é um PDF válido",
      });
    }

    try {
      const document = await documentService.create({
        projectId: parsedParams.data.projectId,
        fileName: file.filename,
        mimeType: file.mimetype,
        fileSize: buffer.length,
        buffer,
      });

      return reply.status(202).send(document);
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
    const parsedParams = projectParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        message: INVALID_PARAMS,
        issues: parsedParams.error.flatten(),
      });
    }

    try {
      return await documentService.listByProject(parsedParams.data.projectId);
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
      const parsedParams = documentParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({
          message: INVALID_PARAMS,
          issues: parsedParams.error.flatten(),
        });
      }

      const document = await documentService.getById(
        parsedParams.data.projectId,
        parsedParams.data.documentId,
      );

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
      const parsedParams = documentParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({
          message: INVALID_PARAMS,
          issues: parsedParams.error.flatten(),
        });
      }

      try {
        const result = await documentService.remove(
          parsedParams.data.projectId,
          parsedParams.data.documentId,
        );
        return reply.send(result);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "DOCUMENT_NOT_FOUND"
        ) {
          return reply.status(404).send({
            message: "Documento não encontrado",
          });
        }

        throw error;
      }
    },
  );
}
