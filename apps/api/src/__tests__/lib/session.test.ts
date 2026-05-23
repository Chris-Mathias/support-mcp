import { describe, it, expect, vi, afterEach } from 'vitest';
import { createSessionToken, verifySessionToken } from '../../lib/session.js';

afterEach(() => vi.unstubAllEnvs());

describe('createSessionToken', () => {
  it('returns string with id.signature format (hex64.hex64)', () => {
    const token = createSessionToken();
    const [id, sig] = token.split('.');
    expect(id).toMatch(/^[0-9a-f]{64}$/);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('verifySessionToken', () => {
  it('returns true for a valid token', () => {
    expect(verifySessionToken(createSessionToken())).toBe(true);
  });

  it('returns false when id is tampered', () => {
    const token = createSessionToken();
    const dot = token.lastIndexOf('.');
    const sig = token.slice(dot);
    const tampered = (token[0] === 'a' ? 'b' : 'a') + token.slice(1, dot) + sig;
    expect(verifySessionToken(tampered)).toBe(false);
  });

  it('returns false when signature is tampered', () => {
    const token = createSessionToken();
    const dot = token.lastIndexOf('.');
    const tampered = token.slice(0, dot) + '.' + '0'.repeat(64);
    expect(verifySessionToken(tampered)).toBe(false);
  });

  it('returns false when token has no dot', () => {
    expect(verifySessionToken('nodothere')).toBe(false);
  });

  it('throws when SESSION_SECRET is shorter than 32 characters', () => {
    vi.stubEnv('SESSION_SECRET', 'short');
    expect(() => createSessionToken()).toThrow();
  });
});
