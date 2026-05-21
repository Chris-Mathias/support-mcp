import type { FastifyInstance } from "fastify";
import { SupportService } from "./support.service.js";
import { askQuestionSchema } from "./support.schemas.js";

const supportService = new SupportService();

export async function supportRoutes(app: FastifyInstance) {
  app.post("/chat/sessions/:sessionId/ask", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    const parsed = askQuestionSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Payload inválido",
        issues: parsed.error.flatten(),
      });
    }

    try {
      const result = await supportService.askQuestion({
        sessionId,
        projectId: parsed.data.projectId,
        question: parsed.data.question,
      });

      return reply.send(result);
    } catch (error) {
      if (!(error instanceof Error)) throw error;

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

  app.post("/chat/sessions/:sessionId/ask/stream", async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const requestOrigin =
      typeof request.headers.origin === "string"
        ? request.headers.origin
        : "*";

    const parsed = askQuestionSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Payload inválido",
        issues: parsed.error.flatten(),
      });
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      "Access-Control-Allow-Origin": requestOrigin,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      Vary: "Origin",
      "X-Accel-Buffering": "no",
    });
    reply.raw.flushHeaders?.();

    const sendEvent = (event: string, data: unknown) => {
      if (reply.raw.writableEnded || reply.raw.destroyed) {
        return;
      }

      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const result = await supportService.askQuestionStream(
        {
          sessionId,
          projectId: parsed.data.projectId,
          question: parsed.data.question,
        },
        {
          onTextDelta(delta, content) {
            sendEvent("delta", {
              delta,
              content,
            });
          },
          onToolCall(info) {
            sendEvent("tool_call", info);
          },
          onToolResult(info) {
            sendEvent("tool_result", info);
          },
        },
      );

      sendEvent("done", result);
    } catch (error) {
      if (!(error instanceof Error)) throw error;

      if (error.message === "SESSION_NOT_FOUND") {
        sendEvent("error", {
          message: "Sessão não encontrada",
        });
      } else if (error.message === "PROJECT_SESSION_MISMATCH") {
        sendEvent("error", {
          message: "A sessão informada não pertence ao projeto informado",
        });
      } else {
        sendEvent("error", {
          message: "Não foi possível concluir a resposta do suporte.",
        });
        request.log.error(error);
      }
    } finally {
      if (!reply.raw.writableEnded && !reply.raw.destroyed) {
        reply.raw.end();
      }
    }
  });
}
