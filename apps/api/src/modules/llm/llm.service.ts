import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import {
  buildOpenAiToolDefinitions,
  snakeToCamel,
} from "@support-mvp/mcp-server/src/tools-registry.js";

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const promptPath = path.resolve(__dirname, "prompt.txt");
const systemPrompt: string = fs.readFileSync(promptPath, "utf-8");

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
  }) {
    const toolHistory: ToolCallRecord[] = [];

    const toolDefinitions = buildOpenAiToolDefinitions({});

    let response = await this.client.responses.create({
      model: this.model,
      input: [
        { role: "system", content: systemPrompt },
        ...params.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      ],
      tools: toolDefinitions,
    });

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

        console.log(`\n[Passo ${step}] LLM chamou a ferramenta: ${call.name}`);
        console.log(`[Passo ${step}] Argumentos enviados:`, parsedArgs);

        const output = await this.executeTool(
          params.tools,
          call.name,
          parsedArgs,
        );

        console.log(
          `[Passo ${step}] Resposta da ferramenta (preview):`,
          output.slice(0, 300),
        );

        toolHistory.push({
          tool: call.name,
          arguments: parsedArgs,
          resultPreview: output.slice(0, 1000),
        });

        toolOutputs.push({
          type: "function_call_output",
          call_id: call.call_id,
          output,
        });
      }

      response = await this.client.responses.create({
        model: this.model,
        previous_response_id: response.id,
        input: toolOutputs,
        tools: toolDefinitions,
      });
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

    const finalResponse = await this.client.responses.create({
      model: this.model,
      previous_response_id: response.id,
      input: fallbackOutputs,
    });

    return {
      answer: finalResponse.output_text.trim(),
      toolHistory,
    };
  }

  private async executeTool(
    tools: ToolRuntime,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    /**
     * Primeiro tenta pelo nome MCP direto.
     * Ex.: tools["search_project_gitlab_files"]
     */
    const directTool = tools[toolName];
    if (directTool) {
      return directTool(args);
    }

    /**
     * Compatibilidade com runtime camelCase.
     * Ex.: search_project_gitlab_files -> searchProjectGitlabFiles
     */
    const runtimeName = snakeToCamel(toolName);
    const camelTool = tools[runtimeName];
    if (camelTool) {
      return camelTool(args);
    }

    throw new Error(`Tool não suportada no runtime: ${toolName}`);
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
