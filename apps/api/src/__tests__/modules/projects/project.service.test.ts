import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectService } from '../../../modules/projects/project.service.js';
import { prisma } from '../../../lib/prisma.js';

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    project: {
      create:     vi.fn(),
      findMany:   vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

describe('ProjectService', () => {
  let service: ProjectService;

  beforeEach(() => {
    service = new ProjectService();
    vi.clearAllMocks();
  });

  it('create() calls prisma.project.create with correct data', async () => {
    vi.mocked(prisma.project.create).mockResolvedValueOnce({} as never);
    await service.create({ name: 'Test' });
    expect(prisma.project.create).toHaveBeenCalledWith({
      data: { name: 'Test', description: undefined },
    });
  });

  it('list() calls prisma.project.findMany with orderBy createdAt desc', async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValueOnce([]);
    await service.list();
    expect(prisma.project.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
    });
  });

  it('getById() calls prisma.project.findUnique with correct where clause', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(null);
    await service.getById('abc');
    expect(prisma.project.findUnique).toHaveBeenCalledWith({
      where: { id: 'abc' },
    });
  });

  it('getById() returns null when findUnique returns null', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(null);
    expect(await service.getById('missing')).toBeNull();
  });
});
