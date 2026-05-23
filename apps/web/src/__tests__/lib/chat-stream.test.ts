import { describe, it, expect, vi } from 'vitest';
import { readSupportStream } from '../../lib/chat-stream.js';
import type { SupportStreamEvent } from '../../lib/chat-stream.js';

function makeResponse(chunks: string[], ok = true): Response {
  let i = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(new TextEncoder().encode(chunks[i++]));
      } else {
        controller.close();
      }
    },
  });
  return { ok, body: stream } as unknown as Response;
}

describe('readSupportStream', () => {
  it('throws STREAM_REQUEST_FAILED when response.ok is false', async () => {
    const res = { ok: false, body: null } as unknown as Response;
    await expect(readSupportStream(res, () => {})).rejects.toThrow('STREAM_REQUEST_FAILED');
  });

  it('throws STREAM_BODY_NOT_AVAILABLE when body is null', async () => {
    const res = { ok: true, body: null } as unknown as Response;
    await expect(readSupportStream(res, () => {})).rejects.toThrow('STREAM_BODY_NOT_AVAILABLE');
  });

  it('calls onEvent with a correctly parsed SSE delta event', async () => {
    const chunk = 'event: delta\ndata: {"delta":"x","content":"x"}\n\n';
    const events: SupportStreamEvent<unknown>[] = [];
    await readSupportStream(makeResponse([chunk]), e => events.push(e));
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ event: 'delta', data: { delta: 'x', content: 'x' } });
  });

  it('does not call onEvent for chunks with invalid JSON', async () => {
    const chunk = 'event: delta\ndata: NOT_VALID_JSON\n\n';
    const onEvent = vi.fn();
    await readSupportStream(makeResponse([chunk]), onEvent);
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('stops processing when AbortSignal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const chunk = 'event: delta\ndata: {"delta":"x","content":"x"}\n\n';
    const onEvent = vi.fn();
    await readSupportStream(makeResponse([chunk]), onEvent, controller.signal);
    expect(onEvent).not.toHaveBeenCalled();
  });
});
