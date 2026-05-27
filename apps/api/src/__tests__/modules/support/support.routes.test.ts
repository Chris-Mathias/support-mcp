import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';

const askQuestionMock = vi.fn();
const askQuestionStreamMock = vi.fn();

vi.mock('../../../modules/support/support.service.js', () => ({
  SupportService: vi.fn().mockImplementation(() => ({
    askQuestion: askQuestionMock,
    askQuestionStream: askQuestionStreamMock,
  })),
}));

const { supportRoutes } = await import('../../../modules/support/support.routes.js');

const ALLOWED = 'https://app.exemplo.com';
const OTHER_ALLOWED = 'https://staging.exemplo.com';

const app = Fastify({ logger: false });

beforeAll(async () => {
  await app.register(supportRoutes, {
    rateLimitLlm: 100,
    rateLimitWindow: '1m',
    allowedOrigins: new Set([ALLOWED, OTHER_ALLOWED]),
  });
  await app.ready();
});

afterAll(() => app.close());

const validBody = { projectId: 'proj_1', question: 'oi?' };
const url = '/chat/sessions/sess_1/ask/stream';

describe('POST /chat/sessions/:sessionId/ask/stream — origin enforcement', () => {
  it('returns 403 when Origin header is absent', async () => {
    const res = await app.inject({ method: 'POST', url, payload: validBody });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ message: 'Origem não permitida' });
    expect(askQuestionStreamMock).not.toHaveBeenCalled();
  });

  it('returns 403 when Origin is not in allowedOrigins', async () => {
    const res = await app.inject({
      method: 'POST',
      url,
      headers: { origin: 'https://attacker.example' },
      payload: validBody,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ message: 'Origem não permitida' });
    expect(askQuestionStreamMock).not.toHaveBeenCalled();
  });

  it('reflects the request Origin (not the first allowed) when Origin is allowed', async () => {
    askQuestionStreamMock.mockResolvedValueOnce({
      answer: 'ok',
      toolHistory: [],
    });

    const res = await app.inject({
      method: 'POST',
      url,
      headers: { origin: OTHER_ALLOWED },
      payload: validBody,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(OTHER_ALLOWED);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(askQuestionStreamMock).toHaveBeenCalledTimes(1);
  });
});
