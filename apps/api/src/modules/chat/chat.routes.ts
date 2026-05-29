import type { FastifyInstance } from "fastify";
import {
  closeSessionBodySchema,
  createChatMessageSchema,
  createChatSessionSchema,
  deleteSessionBodySchema,
  listMessagesQuerySchema,
  projectParamsSchema,
  sessionParamsSchema,
} from "./chat.schemas.js";
import { ChatService } from "./chat.service.js";

const INVALID_PARAMS = "Parâmetros inválidos";

export async function chatRoutes(app: FastifyInstance) {
  const chatService = new ChatService();
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

  app.get("/projects/:projectId/chat/sessions", async (request, reply) => {
    const parsedParams = projectParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        message: INVALID_PARAMS,
        issues: parsedParams.error.flatten(),
      });
    }

    return chatService.listSessionsByProject(parsedParams.data.projectId);
  });

  app.get("/chat/sessions/:sessionId", async (request, reply) => {
    const parsedParams = sessionParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        message: INVALID_PARAMS,
        issues: parsedParams.error.flatten(),
      });
    }

    const session = await chatService.getSessionById(
      parsedParams.data.sessionId,
    );

    if (!session) {
      return reply.status(404).send({
        message: "Sessão não encontrada",
      });
    }

    return session;
  });

  app.post("/chat/sessions/:sessionId/messages", async (request, reply) => {
    const parsedParams = sessionParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        message: INVALID_PARAMS,
        issues: parsedParams.error.flatten(),
      });
    }

    const parsed = createChatMessageSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Payload inválido",
        issues: parsed.error.flatten(),
      });
    }

    try {
      const message = await chatService.createMessage(
        parsedParams.data.sessionId,
        parsed.data,
      );
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
    const parsedParams = sessionParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        message: INVALID_PARAMS,
        issues: parsedParams.error.flatten(),
      });
    }

    const parsedQuery = listMessagesQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return reply.status(400).send({
        message: INVALID_PARAMS,
        issues: parsedQuery.error.flatten(),
      });
    }

    try {
      const messages = await chatService.listMessages(
        parsedParams.data.sessionId,
        parsedQuery.data.projectId,
      );
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

  app.delete("/chat/sessions/:sessionId", async (request, reply) => {
    const parsedParams = sessionParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        message: INVALID_PARAMS,
        issues: parsedParams.error.flatten(),
      });
    }

    const parsedBody = deleteSessionBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.status(400).send({
        message: "Payload inválido",
        issues: parsedBody.error.flatten(),
      });
    }

    try {
      await chatService.deleteSession(
        parsedParams.data.sessionId,
        parsedBody.data.projectId,
      );
      return reply.status(204).send();
    } catch (error) {
      if (!(error instanceof Error)) throw error;

      if (error.message === "SESSION_NOT_FOUND") {
        return reply.status(404).send({ message: "Sessão não encontrada" });
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
    const parsedParams = sessionParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        message: INVALID_PARAMS,
        issues: parsedParams.error.flatten(),
      });
    }

    const parsedBody = closeSessionBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.status(400).send({
        message: "Payload inválido",
        issues: parsedBody.error.flatten(),
      });
    }

    try {
      const session = await chatService.closeSession(
        parsedParams.data.sessionId,
        parsedBody.data.projectId,
      );
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
