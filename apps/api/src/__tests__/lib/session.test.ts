import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  createSessionToken,
  verifySessionToken,
  deleteSessionToken,
  clearSessionCache,
  pruneSessionCache,
} from '../../lib/session.js';

function makePrisma(sessionRow?: { expiresAt: Date } | null) {
  return {
    session: {
      create:      vi.fn().mockResolvedValue({}),
      findUnique:  vi.fn().mockResolvedValue(sessionRow ?? null),
      deleteMany:  vi.fn().mockResolvedValue({}),
    },
  } as unknown as PrismaClient;
}

beforeEach(() => clearSessionCache());
afterEach(() => vi.unstubAllEnvs());

describe('createSessionToken', () => {
  it('returns string with id.signature format (hex64.hex64)', async () => {
    const token = await createSessionToken(makePrisma());
    const [id, sig] = token.split('.');
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it('persists the session hash in the database', async () => {
    const prisma = makePrisma();
    await createSessionToken(prisma);
    expect(prisma.session.create).toHaveBeenCalledOnce();
  });

  it('throws when SESSION_SECRET is shorter than 32 characters', async () => {
    vi.stubEnv('SESSION_SECRET', 'short');
    await expect(createSessionToken(makePrisma())).rejects.toThrow();
  });
});

describe('verifySessionToken', () => {
  it('returns valid:true for a freshly created token (served from cache)', async () => {
    const token = await createSessionToken(makePrisma());
    const result = await verifySessionToken(token, makePrisma());
    expect(result.valid).toBe(true);
  });

  it('returns valid:true from DB when not in cache', async () => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const token = await createSessionToken(makePrisma());
    clearSessionCache();
    const result = await verifySessionToken(token, makePrisma({ expiresAt }));
    expect(result.valid).toBe(true);
  });

  it('returns valid:false when HMAC id is tampered', async () => {
    const token = await createSessionToken(makePrisma());
    const dot = token.lastIndexOf('.');
    const sig = token.slice(dot);
    const tampered = (token[0] === 'a' ? 'b' : 'a') + token.slice(1, dot) + sig;
    const result = await verifySessionToken(tampered, makePrisma());
    expect(result.valid).toBe(false);
  });

  it('returns valid:false when signature is tampered', async () => {
    const token = await createSessionToken(makePrisma());
    const dot = token.lastIndexOf('.');
    const tampered = token.slice(0, dot) + '.' + '0'.repeat(64);
    const result = await verifySessionToken(tampered, makePrisma());
    expect(result.valid).toBe(false);
  });

  it('returns valid:false when token has no dot', async () => {
    const result = await verifySessionToken('nodothere', makePrisma());
    expect(result.valid).toBe(false);
  });

  it('returns valid:false when session is not found in DB', async () => {
    const token = await createSessionToken(makePrisma());
    clearSessionCache();
    const result = await verifySessionToken(token, makePrisma(null));
    expect(result.valid).toBe(false);
  });

  it('returns valid:false for an expired session in DB', async () => {
    const token = await createSessionToken(makePrisma());
    clearSessionCache();
    const result = await verifySessionToken(token, makePrisma({ expiresAt: new Date(Date.now() - 1000) }));
    expect(result.valid).toBe(false);
  });

  it('shouldRenew is true when session expires in less than 3 days', async () => {
    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const token = await createSessionToken(makePrisma());
    clearSessionCache();
    const result = await verifySessionToken(token, makePrisma({ expiresAt }));
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.shouldRenew).toBe(true);
  });

  it('shouldRenew is false when session expires in more than 3 days', async () => {
    const expiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const token = await createSessionToken(makePrisma());
    clearSessionCache();
    const result = await verifySessionToken(token, makePrisma({ expiresAt }));
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.shouldRenew).toBe(false);
  });
});

describe('deleteSessionToken', () => {
  it('calls deleteMany in the database', async () => {
    const prisma = makePrisma();
    const token = await createSessionToken(prisma);
    await deleteSessionToken(token, prisma);
    expect(prisma.session.deleteMany).toHaveBeenCalledOnce();
  });

  it('makes token invalid after deletion (DB returns null)', async () => {
    const token = await createSessionToken(makePrisma());
    await deleteSessionToken(token, makePrisma());
    const result = await verifySessionToken(token, makePrisma(null));
    expect(result.valid).toBe(false);
  });
});

describe('pruneSessionCache', () => {
  it('remove entradas com expiresAt no passado', async () => {
    const token = await createSessionToken(makePrisma());
    pruneSessionCache(Date.now() + 8 * 24 * 60 * 60 * 1000);
    const result = await verifySessionToken(token, makePrisma(null));
    expect(result.valid).toBe(false);
  });

  it('remove entradas com cachedUntil no passado', async () => {
    const token = await createSessionToken(makePrisma());
    pruneSessionCache(Date.now() + 31_000);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const result = await verifySessionToken(token, makePrisma({ expiresAt }));
    expect(result.valid).toBe(true);
  });

  it('não remove entradas ainda válidas', async () => {
    const token = await createSessionToken(makePrisma());
    pruneSessionCache(Date.now());
    const prisma = makePrisma();
    const result = await verifySessionToken(token, prisma);
    expect(result.valid).toBe(true);
    expect(prisma.session.findUnique).not.toHaveBeenCalled();
  });
});
