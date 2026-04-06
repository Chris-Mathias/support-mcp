import OpenAI from "openai";

type ToolRuntime = {
  searchProjectDocuments: (args: { query: string }) => Promise<string>;
  getDocumentExcerpt: (args: {
    documentId: string;
    query: string;
  }) => Promise<string>;
  searchProjectGitlabFiles: (args: { query: string }) => Promise<string>;
  getGitlabFileExcerpt: (args: {
    filePath: string;
    query: string;
  }) => Promise<string>;
};

type ToolName =
  | "search_project_documents"
  | "get_document_excerpt"
  | "search_project_gitlab_files"
  | "get_gitlab_file_excerpt";

type ToolCallRecord = {
  tool: ToolName;
  arguments: Record<string, unknown>;
  resultPreview: string;
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
    question: string;
    tools: ToolRuntime;
  }) {
    const toolHistory: ToolCallRecord[] = [];

    const toolDefinitions = [
      {
        type: "function" as const,
        name: "search_project_documents",
        description:
          "Busca documentos do projeto por uma consulta textual. Use para procurar termos, módulos, fluxos, mensagens e conceitos.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "Consulta curta e específica para buscar nos documentos do projeto.",
            },
          },
          required: ["query"],
          additionalProperties: false,
        },
        strict: true,
      },
      {
        type: "function" as const,
        name: "get_document_excerpt",
        description:
          "Obtém um trecho de um documento específico do projeto, usando o documentId já descoberto em uma busca anterior.",
        parameters: {
          type: "object",
          properties: {
            documentId: {
              type: "string",
              description:
                "Identificador do documento retornado em busca anterior.",
            },
            query: {
              type: "string",
              description:
                "Termo ou expressão para localizar o trecho mais relevante dentro do documento.",
            },
          },
          required: ["documentId", "query"],
          additionalProperties: false,
        },
        strict: true,
      },
      {
        type: "function" as const,
        name: "search_project_gitlab_files",
        description:
          "Busca arquivos do repositório do projeto por uma consulta textual. Use para procurar serviços, fluxos, tabelas, mensagens, nomes técnicos e SQL.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "Consulta curta e específica para buscar no repositório do projeto.",
            },
          },
          required: ["query"],
          additionalProperties: false,
        },
        strict: true,
      },
      {
        type: "function" as const,
        name: "get_gitlab_file_excerpt",
        description:
          "Obtém um trecho de um arquivo específico do repositório, usando o filePath já descoberto em busca anterior.",
        parameters: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "Caminho do arquivo retornado em busca anterior.",
            },
            query: {
              type: "string",
              description:
                "Termo ou expressão para localizar o trecho mais relevante dentro do arquivo.",
            },
          },
          required: ["filePath", "query"],
          additionalProperties: false,
        },
        strict: true,
      },
    ];

    let response = await this.client.responses.create({
      model: this.model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "Você é um assistente técnico para suporte N1.",
                "Seu trabalho é investigar a pergunta usando as ferramentas disponíveis.",
                "O projeto já foi fixado pelo sistema; você NÃO escolhe projeto.",
                "Você decide quais consultas fazer nas ferramentas e pode refinar as queries.",
                "Faça buscas curtas, específicas e técnicas.",
                "Use primeiro buscas amplas e depois detalhe com trechos específicos quando necessário.",
                "Evite consultas redundantes.",
                "Na resposta final, não exponha código-fonte.",
                "Só inclua SQL se houver evidência clara e se isso ajudar diretamente o suporte.",
                "Se a evidência for insuficiente, diga isso explicitamente.",
                "Responda em português do Brasil.",
              ].join(" "),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Pergunta do atendente: ${params.question}`,
            },
          ],
        },
      ],
      tools: toolDefinitions,
    });

    for (let step = 0; step < 6; step++) {
      const functionCalls = response.output.filter(
        (
          item,
        ): item is {
          type: "function_call";
          call_id: string;
          name: ToolName;
          arguments: string;
        } => item.type === "function_call",
      );

      if (functionCalls.length === 0) {
        return {
          answer: response.output_text.trim(),
          toolHistory,
        };
      }

      const toolOutputs: Array<{
        type: "function_call_output";
        call_id: string;
        output: string;
      }> = [];

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
          output.slice(0, 150),
        );

        toolHistory.push({
          tool: call.name,
          arguments: parsedArgs,
          resultPreview: output.slice(0, 500),
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

    return {
      answer:
        "Não foi possível concluir a investigação com segurança dentro do limite de consultas.",
      toolHistory,
    };
  }

  private async executeTool(
    tools: ToolRuntime,
    toolName: ToolName,
    args: Record<string, unknown>,
  ) {
    switch (toolName) {
      case "search_project_documents":
        return tools.searchProjectDocuments({
          query: String(args.query || ""),
        });

      case "get_document_excerpt":
        return tools.getDocumentExcerpt({
          documentId: String(args.documentId || ""),
          query: String(args.query || ""),
        });

      case "search_project_gitlab_files":
        return tools.searchProjectGitlabFiles({
          query: String(args.query || ""),
        });

      case "get_gitlab_file_excerpt":
        return tools.getGitlabFileExcerpt({
          filePath: String(args.filePath || ""),
          query: String(args.query || ""),
        });

      default:
        throw new Error(`Tool não suportada: ${toolName satisfies never}`);
    }
  }
}

function safeJsonParse(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
