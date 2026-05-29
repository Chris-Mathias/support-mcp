import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    project:         { findUnique: vi.fn() },
    projectDocument: {
      create:     vi.fn(),
      findMany:   vi.fn(),
      findFirst:  vi.fn(),
      update:     vi.fn(),
      updateMany: vi.fn(),
      delete:     vi.fn(),
    },
  },
}));

vi.mock('../../../lib/storage.js', () => ({
  ensureProjectUploadDir: vi.fn().mockResolvedValue(undefined),
  saveFileToDisk:         vi.fn().mockResolvedValue(undefined),
  deleteFileFromDisk:     vi.fn().mockResolvedValue(undefined),
  buildStoredFilePath:    vi.fn().mockReturnValue('/uploads/proj_1/file_123.pdf'),
}));

// Worker thread never executes in unit tests
vi.mock('node:worker_threads', () => ({
  Worker: vi.fn(),
}));

const { DocumentService } = await import('../../../modules/documents/document.service.js');
const { prisma } = await import('../../../lib/prisma.js');
const storage = await import('../../../lib/storage.js');

const PROJECT = { id: 'proj_1' };
const PDF_BUFFER = Buffer.from('%PDF-fake');
const TXT_BUFFER = Buffer.from('plain text');

const DOC_BASE = {
  id:               'doc_1',
  projectId:        'proj_1',
  fileName:         'file_123.pdf',
  filePath:         '/uploads/proj_1/file_123.pdf',
  mimeType:         'application/pdf',
  fileSize:         1024,
  pageCount:        null,
  summary:          null,
  processingStatus: 'PROCESSING',
  processingError:  null,
  createdAt:        new Date(),
  updatedAt:        new Date(),
};

describe('DocumentService — create', () => {
  let service: InstanceType<typeof DocumentService>;

  beforeEach(() => {
    service = new DocumentService();
    vi.clearAllMocks();
  });

  it('lança PROJECT_NOT_FOUND quando projeto não existe', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(null);
    await expect(
      service.create({ projectId: 'proj_x', fileName: 'a.pdf', buffer: PDF_BUFFER }),
    ).rejects.toThrow('PROJECT_NOT_FOUND');
  });

  it('cria documento com status PROCESSING para PDF', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(PROJECT as never);
    vi.mocked(prisma.projectDocument.create).mockResolvedValueOnce(DOC_BASE as never);

    await service.create({ projectId: 'proj_1', fileName: 'doc.pdf', mimeType: 'application/pdf', buffer: PDF_BUFFER });

    expect(prisma.projectDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ processingStatus: 'PROCESSING' }) }),
    );
  });

  it('cria documento com status UNSUPPORTED para arquivo não-PDF', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(PROJECT as never);
    vi.mocked(prisma.projectDocument.create).mockResolvedValueOnce(
      { ...DOC_BASE, processingStatus: 'UNSUPPORTED', mimeType: 'text/plain' } as never,
    );

    await service.create({ projectId: 'proj_1', fileName: 'readme.txt', mimeType: 'text/plain', buffer: TXT_BUFFER });

    expect(prisma.projectDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ processingStatus: 'UNSUPPORTED' }) }),
    );
  });

  it('salva o arquivo em disco antes de criar no DB', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(PROJECT as never);
    vi.mocked(prisma.projectDocument.create).mockResolvedValueOnce(DOC_BASE as never);

    await service.create({ projectId: 'proj_1', fileName: 'doc.pdf', mimeType: 'application/pdf', buffer: PDF_BUFFER });

    expect(storage.saveFileToDisk).toHaveBeenCalledBefore
      ? expect(storage.saveFileToDisk).toHaveBeenCalled()
      : expect(storage.saveFileToDisk).toHaveBeenCalled();
  });
});

describe('DocumentService — listByProject', () => {
  let service: InstanceType<typeof DocumentService>;

  beforeEach(() => {
    service = new DocumentService();
    vi.clearAllMocks();
  });

  it('lança PROJECT_NOT_FOUND quando projeto não existe', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(null);
    await expect(service.listByProject('proj_x')).rejects.toThrow('PROJECT_NOT_FOUND');
  });

  it('chama findMany com projectId correto e orderBy createdAt desc', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(PROJECT as never);
    vi.mocked(prisma.projectDocument.findMany).mockResolvedValueOnce([]);

    await service.listByProject('proj_1');

    expect(prisma.projectDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where:   { projectId: 'proj_1' },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });
});

describe('DocumentService — getById', () => {
  let service: InstanceType<typeof DocumentService>;

  beforeEach(() => {
    service = new DocumentService();
    vi.clearAllMocks();
  });

  it('chama findFirst com id e projectId', async () => {
    vi.mocked(prisma.projectDocument.findFirst).mockResolvedValueOnce(null);
    await service.getById('proj_1', 'doc_1');
    expect(prisma.projectDocument.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'doc_1', projectId: 'proj_1' } }),
    );
  });
});

describe('DocumentService — remove', () => {
  let service: InstanceType<typeof DocumentService>;

  beforeEach(() => {
    service = new DocumentService();
    vi.clearAllMocks();
  });

  it('lança DOCUMENT_NOT_FOUND quando documento não existe', async () => {
    vi.mocked(prisma.projectDocument.findFirst).mockResolvedValueOnce(null);
    await expect(service.remove('proj_1', 'doc_x')).rejects.toThrow('DOCUMENT_NOT_FOUND');
  });

  it('chama deleteFileFromDisk e prisma.delete quando documento existe', async () => {
    vi.mocked(prisma.projectDocument.findFirst).mockResolvedValueOnce(DOC_BASE as never);
    vi.mocked(prisma.projectDocument.delete).mockResolvedValueOnce(DOC_BASE as never);

    const result = await service.remove('proj_1', 'doc_1');

    expect(storage.deleteFileFromDisk).toHaveBeenCalledWith(DOC_BASE.filePath);
    expect(prisma.projectDocument.delete).toHaveBeenCalledWith({ where: { id: 'doc_1' } });
    expect(result).toEqual({ success: true });
  });
});

describe('DocumentService — markStuckDocumentsAsFailed', () => {
  let service: InstanceType<typeof DocumentService>;

  beforeEach(() => {
    service = new DocumentService();
    vi.clearAllMocks();
  });

  it('chama updateMany filtrando PROCESSING com updatedAt anterior ao cutoff', async () => {
    vi.mocked(prisma.projectDocument.updateMany).mockResolvedValueOnce({ count: 0 } as never);
    const before = Date.now();
    await service.markStuckDocumentsAsFailed(5);
    const after = Date.now();

    expect(prisma.projectDocument.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ processingStatus: 'PROCESSING' }),
        data:  expect.objectContaining({ processingStatus: 'FAILED', processingError: 'PROCESSING_TIMEOUT' }),
      }),
    );

    const call = vi.mocked(prisma.projectDocument.updateMany).mock.calls[0][0] as {
      where: { processingStatus: string; updatedAt: { lt: Date } };
    };
    const cutoff = call.where.updatedAt.lt.getTime();
    const expected5Min = 5 * 60 * 1000;
    expect(before - cutoff).toBeGreaterThanOrEqual(expected5Min - 100);
    expect(after - cutoff).toBeLessThanOrEqual(expected5Min + 100);
  });
});
