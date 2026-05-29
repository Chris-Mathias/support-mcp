import OpenAI from "openai";
import type {
  Response,
  ResponseCreateParamsBase,
} from "openai/resources/responses/responses";
import {
  buildOpenAiToolDefinitions,
  snakeToCamel,
} from "@support-mvp/mcp-server/tools-registry.js";
import { systemPrompt } from "./prompt.js";

type RuntimeToolFn = (args?: Record<string, unknown>) => Promise<string>;
type ToolRuntime = Record<string, RuntimeToolFn>;

type ToolCallRecord = {
  tool: string;
  arguments: Record<string, unknown>;
  resultPreview: string;
};

type FunctionCallOutputItem = {
  type: "function_call_output";
  call_id: string;
  output: string;
};

type FunctionCallItem = {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
};

type ChatMessageInput = {
  role: "user" | "assistant";
  content: string;
};

type SupportAnswerHandlers = {
  onTextDelta?: (delta: string, content: string) => void;
  onToolCall?: (info: {
    step: number;
    tool: string;
    arguments: Record<string, unknown>;
  }) => void;
  onToolResult?: (info: {
    step: number;
    tool: string;
    resultPreview: string;
  }) => void;
};

export class LlmService {
  private client: OpenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.LLM_API_KEY;

    if (!apiKey) {
      throw new Error("LLM_API_KEY_NOT_CONFIGURED");
    }

    this.client = new OpenAI({ apiKey });
    this.model = process.env.LLM_MODEL || "gpt-5-nano";
  }

  async generateSupportAnswerWithTools(params: {
    messages: ChatMessageInput[];
    tools: ToolRuntime;
    logger?: { debug: (obj: Record<string, unknown>, msg: string) => void };
  } & SupportAnswerHandlers) {
    const toolHistory: ToolCallRecord[] = [];

    const toolDefinitions = buildOpenAiToolDefinitions({});

    let response: Response;
    try {
      response = await this.createResponse({
        model: this.model,
        input: [
          { role: "system", content: systemPrompt },
          ...params.messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        ],
        tools: toolDefinitions,
      }, params.onTextDelta);
    } catch (err) {
      params.logger?.debug(
        { toolDefinitions, error: err instanceof Error ? err.message : String(err) },
        "llm:tool_definitions_error",
      );
      throw err;
    }

    for (let step = 0; step < 6; step++) {
      const functionCalls = response.output.filter(
        (item): item is FunctionCallItem => item.type === "function_call",
      );

      if (functionCalls.length === 0) {
        return {
          answer: response.output_text.trim(),
          toolHistory,
        };
      }

      const toolOutputs: FunctionCallOutputItem[] = [];

      for (const call of functionCalls) {
        const parsedArgs = safeJsonParse(call.arguments);

        params.logger?.debug({ step, tool: call.name, args: parsedArgs }, "llm tool call");
        params.onToolCall?.({
          step,
          tool: call.name,
          arguments: parsedArgs,
        });

        const output = await this.executeTool(
          params.tools,
          call.name,
          parsedArgs,
        );

        params.logger?.debug({ step, tool: call.name, preview: output.slice(0, 300) }, "llm tool result");

        toolHistory.push({
          tool: call.name,
          arguments: parsedArgs,
          resultPreview: output.slice(0, 1000),
        });
        params.onToolResult?.({
          step,
          tool: call.name,
          resultPreview: output.slice(0, 1000),
        });

        toolOutputs.push({
          type: "function_call_output",
          call_id: call.call_id,
          output,
        });
      }

      response = await this.createResponse({
        model: this.model,
        previous_response_id: response.id,
        input: toolOutputs,
        tools: toolDefinitions,
      }, params.onTextDelta);
    }

    const pendingCalls = response.output.filter(
      (item): item is FunctionCallItem => item.type === "function_call",
    );

    if (pendingCalls.length === 0) {
      return {
        answer: response.output_text.trim(),
        toolHistory,
      };
    }

    const fallbackOutputs: FunctionCallOutputItem[] = pendingCalls.map(
      (call) => ({
        type: "function_call_output",
        call_id: call.call_id,
        output:
          "SYSTEM_WARNING: Limite máximo de uso de ferramentas atingido. A ferramenta não foi executada. Interrompa a investigação e formule a resposta final baseando-se estritamente nas informações coletadas até agora.",
      }),
    );

    const finalResponse = await this.createResponse({
      model: this.model,
      previous_response_id: response.id,
      input: fallbackOutputs,
    }, params.onTextDelta);

    return {
      answer: finalResponse.output_text.trim(),
      toolHistory,
    };
  }

  async generateChatTitle(params: { question: string; answer: string }) {
    const titleModel = process.env.LLM_TITLE_MODEL || "gpt-5-nano";

    const response = await this.client.responses.create({
      model: titleModel,
      input: [
        {
          role: "system",
          content:
            "Você gera títulos curtos para conversas de suporte técnico. Use a pergunta do usuário e a resposta do assistente para entender o assunto principal. Responda apenas com o título, sem aspas, sem ponto final e com no máximo 6 palavras.",
        },
        {
          role: "user",
          content: [
            "Pergunta do usuário:",
            params.question,
            "",
            "Resposta do assistente:",
            params.answer,
          ].join("\n"),
        },
      ],
    });

    return normalizeChatTitle(response.output_text);
  }

  private async executeTool(
    tools: ToolRuntime,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    const fn = tools[toolName] ?? tools[snakeToCamel(toolName)];

    if (!fn) {
      throw new Error(`Tool não suportada no runtime: ${toolName}`);
    }

    try {
      return await fn(args);
    } catch (err) {
      // Return validation errors to the LLM so it can retry with corrected arguments
      if (err instanceof Error && err.name === "ZodError") {
        return JSON.stringify({ error: "INVALID_TOOL_ARGUMENTS", details: err.message });
      }
      throw err;
    }
  }

  private async createResponse(
    params: ResponseCreateParamsBase,
    onTextDelta?: (delta: string, content: string) => void,
  ): Promise<Response> {
    const stream = await this.client.responses.create({
      ...params,
      stream: true,
    });

    let response: Response | null = null;
    let content = "";

    for await (const event of stream) {
      if (
        event.type === "response.output_text.delta" ||
        event.type === "response.refusal.delta"
      ) {
        content += event.delta;
        onTextDelta?.(event.delta, content);
      }

      if (event.type === "response.completed") {
        response = event.response;
      }
    }

    if (!response) {
      throw new Error("LLM_STREAM_INCOMPLETE");
    }

    response.output_text = content;
    return response;
  }
}

function safeJsonParse(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function normalizeChatTitle(value: string) {
  const title = value
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!title) {
    return "Novo chat";
  }

  return title.length > 60 ? `${title.slice(0, 57).trim()}...` : title;
}
