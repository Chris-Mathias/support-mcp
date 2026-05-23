import { describe, it, expect, vi, afterEach } from 'vitest';
import { encrypt, decrypt } from '../../lib/crypto.js';

afterEach(() => vi.unstubAllEnvs());

describe('encrypt / decrypt', () => {
  it('roundtrip preserves plaintext', () => {
    expect(decrypt(encrypt('hello world'))).toBe('hello world');
  });

  it('encrypt output has format iv:authTag:ciphertext (exactly 2 colons)', () => {
    expect(encrypt('test').split(':').length).toBe(3);
  });

  it('decrypt throws INVALID_ENCRYPTED_FORMAT when fewer than 3 parts', () => {
    expect(() => decrypt('onlyone:two')).toThrow('INVALID_ENCRYPTED_FORMAT');
  });

  it('decrypt throws on tampered ciphertext (GCM auth tag mismatch)', () => {
    const valid = encrypt('secret');
    const [iv, tag, cipher] = valid.split(':');
    const tampered = [iv, tag, '00' + cipher.slice(2)].join(':');
    expect(() => decrypt(tampered)).toThrow();
  });

  it('throws when ENCRYPTION_KEY has wrong length', () => {
    vi.stubEnv('ENCRYPTION_KEY', 'tooshort');
    expect(() => encrypt('anything')).toThrow();
  });
});
