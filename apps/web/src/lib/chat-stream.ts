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

  return {
    event,
    data: JSON.parse(dataLines.join("\n")),
  } as SupportStreamEvent<TDone>;
}

export async function readSupportStream<TDone>(
  response: Response,
  onEvent: (event: SupportStreamEvent<TDone>) => void,
) {
  if (!response.ok) {
    throw new Error("STREAM_REQUEST_FAILED");
  }

  if (!response.body) {
    throw new Error("STREAM_BODY_NOT_AVAILABLE");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const parsed = parseSseChunk<TDone>(chunk);

      if (parsed) {
        onEvent(parsed);
      }
    }
  }

  buffer += decoder.decode();

  if (buffer.trim()) {
    const parsed = parseSseChunk<TDone>(buffer);

    if (parsed) {
      onEvent(parsed);
    }
  }
}
