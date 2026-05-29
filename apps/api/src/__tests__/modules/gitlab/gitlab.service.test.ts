import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    project:           { findUnique: vi.fn() },
    gitlabIntegration: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('../../../lib/crypto.js', () => ({
  encrypt: vi.fn().mockReturnValue('encrypted_token'),
  decrypt: vi.fn().mockReturnValue('raw_token'),
}));

vi.mock('axios', () => ({ default: { get: vi.fn() } }));

const { GitlabService } = await import('../../../modules/gitlab/gitlab.service.js');
const { prisma } = await import('../../../lib/prisma.js');

const PROJECT = { id: 'proj_1', name: 'Test' };

const INTEGRATION = {
  id:          'int_1',
  projectId:   'proj_1',
  repoUrl:     'https://gitlab.com/grupo/repo',
  projectPath: 'grupo/repo',
  branch:      'main',
  token:       'encrypted_token',
  createdAt:   new Date(),
  updatedAt:   new Date(),
};

const VALID_INPUT = {
  repoUrl:     'https://gitlab.com/grupo/repo',
  projectPath: 'grupo/repo',
  branch:      'main',
  token:       'glpat-abc',
};

describe('GitlabService — createOrUpdateIntegration', () => {
  let service: InstanceType<typeof GitlabService>;

  beforeEach(() => {
    service = new GitlabService();
    vi.clearAllMocks();
  });

  it('lança PROJECT_NOT_FOUND quando projeto não existe', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(null);
    await expect(service.createOrUpdateIntegration('proj_x', VALID_INPUT)).rejects.toThrow('PROJECT_NOT_FOUND');
  });

  it('lança TOKEN_REQUIRED quando não há token e nem integração existente', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(PROJECT as never);
    vi.mocked(prisma.gitlabIntegration.findFirst).mockResolvedValueOnce(null);
    await expect(
      service.createOrUpdateIntegration('proj_1', { ...VALID_INPUT, token: undefined }),
    ).rejects.toThrow('TOKEN_REQUIRED');
  });

  it('lança GITLAB_ACCESS_INVALID quando validação de acesso falha', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(PROJECT as never);
    vi.mocked(prisma.gitlabIntegration.findFirst).mockResolvedValueOnce(null);
    vi.mocked(axios.get).mockRejectedValueOnce(new Error('403'));
    await expect(service.createOrUpdateIntegration('proj_1', VALID_INPUT)).rejects.toThrow('GITLAB_ACCESS_INVALID');
  });

  it('cria nova integração com token encriptado quando acesso é válido', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(PROJECT as never);
    vi.mocked(prisma.gitlabIntegration.findFirst).mockResolvedValueOnce(null);
    vi.mocked(axios.get).mockResolvedValueOnce({ data: [] });
    vi.mocked(prisma.gitlabIntegration.create).mockResolvedValueOnce(INTEGRATION as never);

    const result = await service.createOrUpdateIntegration('proj_1', VALID_INPUT);

    expect(prisma.gitlabIntegration.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ token: 'encrypted_token' }) }),
    );
    expect(result).not.toHaveProperty('token');
    expect(result.tokenConfigured).toBe(true);
  });

  it('atualiza integração existente sem novo token (mantém token armazenado)', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(PROJECT as never);
    vi.mocked(prisma.gitlabIntegration.findFirst).mockResolvedValueOnce(INTEGRATION as never);
    vi.mocked(prisma.gitlabIntegration.update).mockResolvedValueOnce(INTEGRATION as never);

    await service.createOrUpdateIntegration('proj_1', { ...VALID_INPUT, token: undefined });

    expect(prisma.gitlabIntegration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ token: expect.anything() }),
      }),
    );
    expect(prisma.gitlabIntegration.create).not.toHaveBeenCalled();
  });
});

describe('GitlabService — getIntegration', () => {
  let service: InstanceType<typeof GitlabService>;

  beforeEach(() => {
    service = new GitlabService();
    vi.clearAllMocks();
  });

  it('retorna null quando não existe integração', async () => {
    vi.mocked(prisma.gitlabIntegration.findFirst).mockResolvedValueOnce(null);
    expect(await service.getIntegration('proj_x')).toBeNull();
  });

  it('retorna objeto sem campo token e com tokenConfigured: true', async () => {
    vi.mocked(prisma.gitlabIntegration.findFirst).mockResolvedValueOnce(INTEGRATION as never);
    const result = await service.getIntegration('proj_1');
    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty('token');
    expect(result!.tokenConfigured).toBe(true);
  });

  it('tokenConfigured é false quando token está vazio', async () => {
    vi.mocked(prisma.gitlabIntegration.findFirst).mockResolvedValueOnce(
      { ...INTEGRATION, token: '' } as never,
    );
    const result = await service.getIntegration('proj_1');
    expect(result!.tokenConfigured).toBe(false);
  });
});
