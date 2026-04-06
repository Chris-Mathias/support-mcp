import type { FastifyInstance } from "fastify";
import {
  createChatMessageSchema,
  createChatSessionSchema,
} from "./chat.schemas.js";
import { ChatService } from "./chat.service.js";

const chatService = new ChatService();

export async function chatRoutes(app: FastifyInstance) {
  app.post("/chat/sessions", async (request, reply) => {
    const parsed = createChatSessionSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Payload inválido",
        issues: parsed.error.flatten(),
      });
    }

    try {
      const session = await chatService.createSession(parsed.data);
      return reply.status(201).send(session);
    } catch (error) {
      if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
        return reply.status(404).send({
          message: "Projeto não encontrado",
        });
      }

      throw error;
    }
  });

  app.get("/projects/:projectId/chat/sessions", async (request) => {
    const { projectId } = request.params as { projectId: string };
    return chatService.listSessionsByProject(projectId);
  });

  app.get("/chat/sessions/:sessionId", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    const session = await chatService.getSessionById(sessionId);

    if (!session) {
      return reply.status(404).send({
        message: "Sessão não encontrada",
      });
    }

    return session;
  });

  app.post("/chat/sessions/:sessionId/messages", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const parsed = createChatMessageSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Payload inválido",
        issues: parsed.error.flatten(),
      });
    }

    try {
      const message = await chatService.createMessage(sessionId, parsed.data);
      return reply.status(201).send(message);
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }

      if (error.message === "SESSION_NOT_FOUND") {
        return reply.status(404).send({
          message: "Sessão não encontrada",
        });
      }

      if (error.message === "PROJECT_SESSION_MISMATCH") {
        return reply.status(409).send({
          message: "A sessão informada não pertence ao projeto informado",
        });
      }

      throw error;
    }
  });

  app.get("/chat/sessions/:sessionId/messages", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const { projectId } = request.query as { projectId?: string };

    if (!projectId) {
      return reply.status(400).send({
        message: "projectId é obrigatório",
      });
    }

    try {
      const messages = await chatService.listMessages(sessionId, projectId);
      return messages;
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }

      if (error.message === "SESSION_NOT_FOUND") {
        return reply.status(404).send({
          message: "Sessão não encontrada",
        });
      }

      if (error.message === "PROJECT_SESSION_MISMATCH") {
        return reply.status(409).send({
          message: "A sessão informada não pertence ao projeto informado",
        });
      }

      throw error;
    }
  });

  app.patch("/chat/sessions/:sessionId/close", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const { projectId } = request.body as { projectId?: string };

    if (!projectId) {
      return reply.status(400).send({
        message: "projectId é obrigatório",
      });
    }

    try {
      const session = await chatService.closeSession(sessionId, projectId);
      return session;
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }

      if (error.message === "SESSION_NOT_FOUND") {
        return reply.status(404).send({
          message: "Sessão não encontrada",
        });
      }

      if (error.message === "PROJECT_SESSION_MISMATCH") {
        return reply.status(409).send({
          message: "A sessão informada não pertence ao projeto informado",
        });
      }

      throw error;
    }
  });
}
