import type { FastifyInstance } from "fastify";
import {
  createChatMessageSchema,
  createChatSessionSchema,
} from "./chat.schemas.js";
import { ChatService } from "./chat.service.js";

const chatService = new ChatService();

export async function chatRoutes(app: FastifyInstance) {
  /**
   * Cria uma nova sessão de chat.
   * @route POST /chat/sessions
   * @param {Object} request.body - Dados para criar a sessão (validado por createChatSessionSchema)
   * @returns {Object} 201 - Sessão criada com sucesso
   * @returns {Object} 400 - Payload inválido
   * @returns {Object} 404 - Projeto não encontrado
   */
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

  /**
   * Lista todas as sessões de chat de um projeto.
   * @route GET /projects/:projectId/chat/sessions
   * @param {string} projectId - ID do projeto (parâmetro da URL)
   * @returns {Array} Lista de sessões do projeto
   */
  app.get("/projects/:projectId/chat/sessions", async (request) => {
    const { projectId } = request.params as { projectId: string };
    return chatService.listSessionsByProject(projectId);
  });

  /**
   * Obtém uma sessão de chat específica pelo ID.
   * @route GET /chat/sessions/:sessionId
   * @param {string} sessionId - ID da sessão (parâmetro da URL)
   * @returns {Object} 200 - Sessão encontrada
   * @returns {Object} 404 - Sessão não encontrada
   */
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

  /**
   * Cria uma nova mensagem em uma sessão de chat.
   * @route POST /chat/sessions/:sessionId/messages
   * @param {string} sessionId - ID da sessão (parâmetro da URL)
   * @param {Object} request.body - Dados da mensagem (validado por createChatMessageSchema)
   * @returns {Object} 201 - Mensagem criada com sucesso
   * @returns {Object} 400 - Payload inválido
   * @returns {Object} 404 - Sessão não encontrada
   * @returns {Object} 409 - Sessão não pertence ao projeto informado
   */
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

  /**
   * Lista todas as mensagens de uma sessão de chat.
   * @route GET /chat/sessions/:sessionId/messages
   * @param {string} sessionId - ID da sessão (parâmetro da URL)
   * @param {string} projectId - ID do projeto (parâmetro de query obrigatório)
   * @returns {Array} 200 - Lista de mensagens
   * @returns {Object} 400 - projectId é obrigatório
   * @returns {Object} 404 - Sessão não encontrada
   * @returns {Object} 409 - Sessão não pertence ao projeto informado
   */
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

  /**
   * Fecha uma sessão de chat.
   * @route PATCH /chat/sessions/:sessionId/close
   * @param {string} sessionId - ID da sessão (parâmetro da URL)
   * @param {string} projectId - ID do projeto (no corpo da requisição, obrigatório)
   * @returns {Object} 200 - Sessão fechada com sucesso
   * @returns {Object} 400 - projectId é obrigatório
   * @returns {Object} 404 - Sessão não encontrada
   * @returns {Object} 409 - Sessão não pertence ao projeto informado
   */
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
