import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { projectRoutes } from '../../../modules/projects/project.routes.js';

const mockService = vi.hoisted(() => ({
  create:  vi.fn(),
  list:    vi.fn(),
  getById: vi.fn(),
}));

vi.mock('../../../modules/projects/project.service.js', () => ({
  ProjectService: vi.fn(() => mockService),
}));

const app = Fastify({ logger: false });

beforeAll(async () => {
  await app.register(projectRoutes);
  await app.ready();

  mockService.create.mockResolvedValue({ id: '1', name: 'Test Project', description: null, createdAt: new Date(), updatedAt: new Date() });
  mockService.list.mockResolvedValue([{ id: '1', name: 'Test Project', description: null, createdAt: new Date(), updatedAt: new Date() }]);
  mockService.getById.mockResolvedValue({ id: '1', name: 'Test Project', description: null, createdAt: new Date(), updatedAt: new Date() });
});

afterAll(() => app.close());

describe('POST /projects', () => {
  it('returns 201 with valid payload', async () => {
    const res = await app.inject({ method: 'POST', url: '/projects', body: { name: 'Test Project' } });
    expect(res.statusCode).toBe(201);
  });

  it('returns 400 when name is too short', async () => {
    const res = await app.inject({ method: 'POST', url: '/projects', body: { name: 'AB' } });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when name is missing', async () => {
    const res = await app.inject({ method: 'POST', url: '/projects', body: {} });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /projects', () => {
  it('returns 200 with an array', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects' });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });
});

describe('GET /projects/:id', () => {
  it('returns 200 when project exists', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/1' });
    expect(res.statusCode).toBe(200);
  });

  it('returns 404 when project does not exist', async () => {
    mockService.getById.mockResolvedValueOnce(null);
    const res = await app.inject({ method: 'GET', url: '/projects/999' });
    expect(res.statusCode).toBe(404);
  });
});
