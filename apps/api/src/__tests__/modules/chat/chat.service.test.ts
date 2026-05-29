import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatService } from '../../../modules/chat/chat.service.js';
import { prisma } from '../../../lib/prisma.js';

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
    },
    chatSession: {
      create:     vi.fn(),
      findMany:   vi.fn(),
      findFirst:  vi.fn(),
      update:     vi.fn(),
      deleteMany: vi.fn(),
    },
    chatMessage: {
      create:   vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

const ACTIVE_SESSION = {
  id: 'sess_1',
  projectId: 'proj_1',
  title: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  closedAt: null,
};

const DELETED_SESSION = { ...ACTIVE_SESSION, deletedAt: new Date() };

describe('ChatService — deletedAt filtering (C-3)', () => {
  let service: ChatService;

  beforeEach(() => {
    service = new ChatService();
    vi.clearAllMocks();
  });

  describe('getSessionById', () => {
    it('returns null for a deleted session', async () => {
      vi.mocked(prisma.chatSession.findFirst).mockResolvedValueOnce(null);
      const result = await service.getSessionById('sess_1');
      expect(result).toBeNull();
      expect(prisma.chatSession.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'sess_1', deletedAt: null } }),
      );
    });
  });

  describe('createMessage', () => {
    it('throws SESSION_NOT_FOUND when session has deletedAt', async () => {
      vi.mocked(prisma.chatSession.findFirst).mockResolvedValueOnce(null);
      await expect(
        service.createMessage('sess_1', { projectId: 'proj_1', role: 'user', content: 'oi' }),
      ).rejects.toThrow('SESSION_NOT_FOUND');
    });

    it('creates message for active session', async () => {
      vi.mocked(prisma.chatSession.findFirst).mockResolvedValueOnce(ACTIVE_SESSION as never);
      vi.mocked(prisma.chatMessage.create).mockResolvedValueOnce({} as never);
      await service.createMessage('sess_1', { projectId: 'proj_1', role: 'user', content: 'oi' });
      expect(prisma.chatMessage.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('listMessages', () => {
    it('throws SESSION_NOT_FOUND when session has deletedAt', async () => {
      vi.mocked(prisma.chatSession.findFirst).mockResolvedValueOnce(null);
      await expect(service.listMessages('sess_1', 'proj_1')).rejects.toThrow('SESSION_NOT_FOUND');
    });
  });

  describe('deleteSession', () => {
    it('throws SESSION_NOT_FOUND when session already has deletedAt', async () => {
      vi.mocked(prisma.chatSession.findFirst).mockResolvedValueOnce(null);
      await expect(service.deleteSession('sess_1', 'proj_1')).rejects.toThrow('SESSION_NOT_FOUND');
    });

    it('sets deletedAt for active session', async () => {
      vi.mocked(prisma.chatSession.findFirst).mockResolvedValueOnce(ACTIVE_SESSION as never);
      vi.mocked(prisma.chatSession.update).mockResolvedValueOnce(DELETED_SESSION as never);
      await service.deleteSession('sess_1', 'proj_1');
      expect(prisma.chatSession.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
    });
  });

  describe('closeSession', () => {
    it('throws SESSION_NOT_FOUND when session has deletedAt', async () => {
      vi.mocked(prisma.chatSession.findFirst).mockResolvedValueOnce(null);
      await expect(service.closeSession('sess_1', 'proj_1')).rejects.toThrow('SESSION_NOT_FOUND');
    });
  });

  describe('loadActiveSession — where clause', () => {
    it('always passes deletedAt: null in the where clause', async () => {
      vi.mocked(prisma.chatSession.findFirst).mockResolvedValueOnce(null);
      await service.listMessages('sess_x', 'proj_1').catch(() => {});
      expect(prisma.chatSession.findFirst).toHaveBeenCalledWith({
        where: { id: 'sess_x', deletedAt: null },
      });
    });
  });
});

describe('ChatService — purgeExpiredSessions (C-8)', () => {
  let service: ChatService;

  beforeEach(() => {
    service = new ChatService();
    vi.clearAllMocks();
  });

  it('chama deleteMany com as três condições OR', async () => {
    vi.mocked(prisma.chatSession.deleteMany).mockResolvedValueOnce({ count: 0 } as never);
    await service.purgeExpiredSessions(30);
    expect(prisma.chatSession.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { deletedAt: { lt: expect.any(Date) } },
          { closedAt: { lt: expect.any(Date) } },
          { AND: [{ messages: { none: {} } }, { createdAt: { lt: expect.any(Date) } }] },
        ],
      },
    });
  });

  it('usa cutoff baseado em retentionDays', async () => {
    vi.mocked(prisma.chatSession.deleteMany).mockResolvedValueOnce({ count: 0 } as never);
    const before = Date.now();
    await service.purgeExpiredSessions(7);
    const after = Date.now();
    const call = vi.mocked(prisma.chatSession.deleteMany).mock.calls[0][0] as {
      where: { OR: Array<{ deletedAt?: { lt: Date } }> };
    };
    const cutoff = call.where.OR[0].deletedAt!.lt.getTime();
    const expected7Days = 7 * 24 * 60 * 60 * 1000;
    expect(before - cutoff).toBeGreaterThanOrEqual(expected7Days - 100);
    expect(after - cutoff).toBeLessThanOrEqual(expected7Days + 100);
  });
});
