import { describe, it, expect } from 'vitest';
import axios from 'axios';
import { getApiErrorMessage } from '../../lib/errors.js';

function makeAxiosError(data?: unknown): axios.AxiosError {
  const err = new axios.AxiosError('Request failed');
  if (data !== undefined) {
    (err as unknown as { response: unknown }).response = { data };
  }
  return err;
}

describe('getApiErrorMessage', () => {
  it('returns the API message from an AxiosError response', () => {
    const err = makeAxiosError({ message: 'Projeto não encontrado' });
    expect(getApiErrorMessage(err, 'fallback')).toBe('Projeto não encontrado');
  });

  it('returns fallback when AxiosError response has no message field', () => {
    const err = makeAxiosError({});
    expect(getApiErrorMessage(err, 'fallback')).toBe('fallback');
  });

  it('returns fallback when AxiosError has no response', () => {
    const err = new axios.AxiosError('Network error');
    expect(getApiErrorMessage(err, 'fallback')).toBe('fallback');
  });

  it('returns fallback for a generic Error', () => {
    expect(getApiErrorMessage(new Error('something'), 'fallback')).toBe('fallback');
  });

  it('returns fallback for null', () => {
    expect(getApiErrorMessage(null, 'fallback')).toBe('fallback');
  });
});
