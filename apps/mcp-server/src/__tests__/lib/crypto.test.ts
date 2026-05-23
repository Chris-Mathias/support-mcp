import { describe, it, expect, vi, afterEach } from 'vitest';
import { createCipheriv, randomBytes } from 'node:crypto';
import { decrypt } from '../../lib/crypto.js';

afterEach(() => vi.unstubAllEnvs());

function makeEncrypted(plaintext: string): string {
  const key = Buffer.from('a'.repeat(64), 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
}

describe('decrypt', () => {
  it('decrypts data encrypted with the same key', () => {
    expect(decrypt(makeEncrypted('hello world'))).toBe('hello world');
  });

  it('throws INVALID_ENCRYPTED_FORMAT when fewer than 3 parts', () => {
    expect(() => decrypt('onlyone:two')).toThrow('INVALID_ENCRYPTED_FORMAT');
  });

  it('throws on tampered ciphertext (GCM auth tag mismatch)', () => {
    const valid = makeEncrypted('secret');
    const [iv, tag, cipher] = valid.split(':');
    const tampered = [iv, tag, '00' + cipher.slice(2)].join(':');
    expect(() => decrypt(tampered)).toThrow();
  });

  it('throws when ENCRYPTION_KEY has wrong length', () => {
    vi.stubEnv('ENCRYPTION_KEY', 'tooshort');
    expect(() => decrypt(makeEncrypted('anything'))).toThrow();
  });
});
