import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { authRoutes } from '../../../modules/auth/auth.routes.js';

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    session: {
      create:     vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
  },
}));

const app = Fastify({ logger: false });

beforeAll(async () => {
  await app.register(cookie);
  await app.register(authRoutes, { rateLimitLogin: 5, rateLimitLoginWindow: "15m" });
  await app.ready();
});

afterAll(() => app.close());
afterEach(() => vi.unstubAllEnvs());

describe('POST /auth/login', () => {
  it('returns 200 and sets session cookie with correct password', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/login', body: { password: 'test-password' } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['set-cookie']).toMatch(/session=/);
  });

  it('sets Secure flag on cookie when NODE_ENV=production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = await app.inject({ method: 'POST', url: '/auth/login', body: { password: 'test-password' } });
    expect(res.statusCode).toBe(200);
    const cookie = res.headers['set-cookie'];
    const cookieStr = Array.isArray(cookie) ? cookie.join(';') : cookie ?? '';
    expect(cookieStr).toMatch(/Secure/);
  });

  it('omits Secure flag on cookie outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const res = await app.inject({ method: 'POST', url: '/auth/login', body: { password: 'test-password' } });
    expect(res.statusCode).toBe(200);
    const cookie = res.headers['set-cookie'];
    const cookieStr = Array.isArray(cookie) ? cookie.join(';') : cookie ?? '';
    expect(cookieStr).not.toMatch(/Secure/);
  });

  it('returns 401 with wrong password', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/login', body: { password: 'wrong' } });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 with empty body', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/login', body: {} });
    expect(res.statusCode).toBe(400);
  });

});

describe('POST /auth/logout', () => {
  it('returns 200', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/logout' });
    expect(res.statusCode).toBe(200);
  });
});

describe('GET /auth/me', () => {
  it('returns 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/me' });
    expect(res.statusCode).toBe(200);
  });
});
