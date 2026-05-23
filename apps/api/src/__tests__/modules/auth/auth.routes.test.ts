import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { authRoutes } from '../../../modules/auth/auth.routes.js';

const app = Fastify({ logger: false });

beforeAll(async () => {
  await app.register(cookie);
  await app.register(authRoutes);
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

  it('returns 401 with wrong password', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/login', body: { password: 'wrong' } });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 with empty body', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/login', body: {} });
    expect(res.statusCode).toBe(400);
  });

  it('returns 500 when APP_PASSWORD is not configured', async () => {
    vi.stubEnv('APP_PASSWORD', '');
    const res = await app.inject({ method: 'POST', url: '/auth/login', body: { password: 'any' } });
    expect(res.statusCode).toBe(500);
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
