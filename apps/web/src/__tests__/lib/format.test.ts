import { describe, it, expect } from 'vitest';
import { formatDate, formatFileSize } from '../../lib/format.js';

describe('formatDate', () => {
  it('returns a non-empty string', () => {
    const result = formatDate('2024-01-15T10:00:00Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('formatFileSize', () => {
  it('formats 0 bytes', () => expect(formatFileSize(0)).toBe('0 B'));
  it('formats 512 bytes', () => expect(formatFileSize(512)).toBe('512 B'));
  it('formats 1023 bytes', () => expect(formatFileSize(1023)).toBe('1023 B'));
  it('formats 1024 bytes as KB', () => expect(formatFileSize(1024)).toBe('1.00 KB'));
  it('formats 2048 bytes as KB', () => expect(formatFileSize(2048)).toBe('2.00 KB'));
  it('formats > 1 MB', () => expect(formatFileSize(2 * 1024 * 1024)).toBe('2.00 MB'));
  it('formats null as 0 B', () => expect(formatFileSize(null)).toBe('0 B'));
});
