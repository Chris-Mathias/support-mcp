export type StreamDeltaEvent = {
  delta: string;
  content: string;
};

export type SupportStreamEvent<TDone> =
  | {
      event: "delta";
      data: StreamDeltaEvent;
    }
  | {
      event: "tool_call";
      data: unknown;
    }
  | {
      event: "tool_result";
      data: unknown;
    }
  | {
      event: "done";
      data: TDone;
    }
  | {
      event: "error";
      data: {
        message: string;
      };
    };

function parseSseChunk<TDone>(chunk: string) {
  const lines = chunk.split("\n");
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  try {
    return {
      event,
      data: JSON.parse(dataLines.join("\n")),
    } as SupportStreamEvent<TDone>;
  } catch {
    return null;
  }
}

export async function readSupportStream<TDone>(
  response: Response,
  onEvent: (event: SupportStreamEvent<TDone>) => void,
  signal?: AbortSignal,
) {
  if (!response.ok) {
    throw new Error("STREAM_REQUEST_FAILED");
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    throw new Error("STREAM_INVALID_CONTENT_TYPE");
  }

  if (!response.body) {
    throw new Error("STREAM_BODY_NOT_AVAILABLE");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) break;

      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        if (signal?.aborted) break;
        const parsed = parseSseChunk<TDone>(chunk);
        if (parsed) onEvent(parsed);
      }
    }

    if (!signal?.aborted) {
      buffer += decoder.decode();
      if (buffer.trim()) {
        const parsed = parseSseChunk<TDone>(buffer);
        if (parsed) onEvent(parsed);
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    throw error;
  } finally {
    reader.cancel();
  }
}
