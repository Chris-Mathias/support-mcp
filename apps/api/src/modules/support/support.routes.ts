import type { FastifyInstance } from "fastify";
import { SupportService } from "./support.service.js";
import { askQuestionSchema, sessionParamsSchema } from "./support.schemas.js";

type SupportRouteOptions = {
  rateLimitLlm: number;
  rateLimitWindow: string;
  allowedOrigins: Set<string>;
};

export async function supportRoutes(app: FastifyInstance, opts: SupportRouteOptions) {
  const supportService = new SupportService();
  const llmRateLimit = { max: opts.rateLimitLlm, timeWindow: opts.rateLimitWindow };
  const { allowedOrigins } = opts;

  app.post("/chat/sessions/:sessionId/ask", { config: { rateLimit: llmRateLimit } }, async (request, reply) => {
    const parsedParams = sessionParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        message: "Parâmetros inválidos",
        issues: parsedParams.error.flatten(),
      });
    }

    const parsed = askQuestionSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Payload inválido",
        issues: parsed.error.flatten(),
      });
    }

    try {
      const result = await supportService.askQuestion({
        sessionId: parsedParams.data.sessionId,
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

  app.post("/chat/sessions/:sessionId/ask/stream", { config: { rateLimit: llmRateLimit } }, async (request, reply) => {
    const parsedParams = sessionParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        message: "Parâmetros inválidos",
        issues: parsedParams.error.flatten(),
      });
    }

    const requestOrigin = request.headers.origin ?? "";
    if (!allowedOrigins.has(requestOrigin)) {
      return reply.status(403).send({ message: "Origem não permitida" });
    }

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
      "Access-Control-Allow-Credentials": "true",
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
          sessionId: parsedParams.data.sessionId,
          projectId: parsed.data.projectId,
          question: parsed.data.question,
          logger: request.log,
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
