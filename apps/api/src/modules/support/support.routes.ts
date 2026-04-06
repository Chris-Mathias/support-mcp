import type { FastifyInstance } from 'fastify';
import { askQuestionSchema } from './support.schemas.js';
import { SupportService } from './support.service.js';

const supportService = new SupportService();

export async function supportRoutes(app: FastifyInstance) {
  app.post('/chat/sessions/:sessionId/ask', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };

    const parsed = askQuestionSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: 'Payload inválido',
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

      if (error.message === 'SESSION_NOT_FOUND') {
        return reply.status(404).send({
          message: 'Sessão não encontrada',
        });
      }

      if (error.message === 'PROJECT_SESSION_MISMATCH') {
        return reply.status(409).send({
          message: 'A sessão informada não pertence ao projeto informado',
        });
      }

      throw error;
    }
  });
}