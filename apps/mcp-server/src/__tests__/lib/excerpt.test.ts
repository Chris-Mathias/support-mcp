import { describe, it, expect } from 'vitest';
import { buildExcerpt } from '../../lib/excerpt.js';

describe('buildExcerpt', () => {
  it('returns empty string for empty text', () => {
    expect(buildExcerpt('', 'query')).toBe('');
  });

  it('returns empty string for whitespace-only text', () => {
    expect(buildExcerpt('   ', 'query')).toBe('');
  });

  it('returns beginning of text when query is not found', () => {
    const text = 'hello world foo bar';
    expect(buildExcerpt(text, 'notfound')).toBe(text.trim());
  });

  it('returns excerpt containing the query when found', () => {
    expect(buildExcerpt('hello world', 'hello')).toContain('hello');
  });

  it('returns a shorter excerpt than full text for long text with query in middle', () => {
    const text = 'a'.repeat(500) + 'QUERY' + 'b'.repeat(500);
    const result = buildExcerpt(text, 'QUERY');
    expect(result.length).toBeLessThan(text.length);
    expect(result.toLowerCase()).toContain('query');
  });

  it('respects custom radius parameter', () => {
    // query 'cde' at index 2, radius=2: start=0, end=min(10,7)=7 → 'abcdefg'
    expect(buildExcerpt('abcdefghij', 'cde', 2)).toBe('abcdefg');
  });
});
