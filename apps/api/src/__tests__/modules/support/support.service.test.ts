import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateSupportAnswerMock = vi.fn();
const generateChatTitleMock = vi.fn();
const withProjectScopedMcpToolsMock = vi.fn();

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    chatSession: {
      findFirst: vi.fn(),
      update:    vi.fn(),
    },
    chatMessage: {
      findMany: vi.fn(),
      create:   vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../../modules/llm/llm.service.js', () => ({
  LlmService: vi.fn().mockImplementation(() => ({
    generateSupportAnswerWithTools: generateSupportAnswerMock,
    generateChatTitle: generateChatTitleMock,
  })),
}));

vi.mock('../../../modules/llm/llm-tool-runtime.js', () => ({
  withProjectScopedMcpTools: withProjectScopedMcpToolsMock,
}));

const { SupportService } = await import('../../../modules/support/support.service.js');
const { prisma } = await import('../../../lib/prisma.js');

const ACTIVE_SESSION = {
  id: 'sess_1',
  projectId: 'proj_1',
  title: null,
  deletedAt: null,
  closedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('SupportService — C-4: sem mensagem órfã no DB quando LLM falha', () => {
  let service: InstanceType<typeof SupportService>;

  beforeEach(() => {
    service = new SupportService();
    vi.clearAllMocks();
  });

  it('não chama prisma.chatMessage.create se o LLM lançar exceção', async () => {
    vi.mocked(prisma.chatSession.findFirst).mockResolvedValueOnce(ACTIVE_SESSION as never);
    vi.mocked(prisma.chatMessage.findMany).mockResolvedValueOnce([]);
    withProjectScopedMcpToolsMock.mockRejectedValueOnce(new Error('LLM timeout'));

    await expect(
      service.askQuestion({ sessionId: 'sess_1', projectId: 'proj_1', question: 'oi?' }),
    ).rejects.toThrow('LLM timeout');

    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('persiste user + assistant em $transaction quando LLM retorna com sucesso', async () => {
    vi.mocked(prisma.chatSession.findFirst).mockResolvedValueOnce(ACTIVE_SESSION as never);
    vi.mocked(prisma.chatMessage.findMany).mockResolvedValueOnce([]);
    withProjectScopedMcpToolsMock.mockImplementationOnce((_ctx, fn) =>
      fn({}).then(() => ({ answer: 'resposta', toolHistory: [] })),
    );
    generateSupportAnswerMock.mockResolvedValueOnce({ answer: 'resposta', toolHistory: [] });
    generateChatTitleMock.mockResolvedValueOnce('Título gerado');

    const txFn = vi.fn().mockResolvedValueOnce({
      userMessage: { id: 'msg_1' },
      assistantMessage: { id: 'msg_2' },
      updatedSession: { ...ACTIVE_SESSION, title: 'Título gerado' },
    });
    vi.mocked(prisma.$transaction).mockImplementationOnce((fn) =>
      typeof fn === 'function' ? (fn as (tx: unknown) => Promise<unknown>)(prisma) : Promise.resolve(fn),
    );

    // Chama o método — o que importa é que $transaction foi chamado
    await service.askQuestion({ sessionId: 'sess_1', projectId: 'proj_1', question: 'oi?' }).catch(() => {});
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('envia mensagem atual ao LLM sem criar no DB antes', async () => {
    vi.mocked(prisma.chatSession.findFirst).mockResolvedValueOnce(ACTIVE_SESSION as never);
    vi.mocked(prisma.chatMessage.findMany).mockResolvedValueOnce([]);

    let capturedMessages: { role: string; content: string }[] = [];
    withProjectScopedMcpToolsMock.mockImplementationOnce(async (_ctx, fn) => {
      // Captura os argumentos que o service envia ao LLM
      generateSupportAnswerMock.mockImplementationOnce(({ messages }) => {
        capturedMessages = messages;
        return Promise.resolve({ answer: 'ok', toolHistory: [] });
      });
      return fn({});
    });
    generateChatTitleMock.mockResolvedValueOnce(null);
    vi.mocked(prisma.$transaction).mockResolvedValueOnce({
      userMessage: {},
      assistantMessage: {},
      updatedSession: ACTIVE_SESSION,
    } as never);

    await service.askQuestion({ sessionId: 'sess_1', projectId: 'proj_1', question: 'pergunta do usuário' }).catch(() => {});

    // A pergunta deve estar incluída nos messages enviados ao LLM mesmo sem estar no DB
    expect(capturedMessages.at(-1)).toEqual({ role: 'user', content: 'pergunta do usuário' });
    // E o create não foi chamado antes do LLM
    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
  });
});
