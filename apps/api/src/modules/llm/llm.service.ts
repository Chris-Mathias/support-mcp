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

    const toolDefinitions = buildOpenAiToolDefinitions({
      /**
       * Quando você remover as tools de documentos da operação,
       * pode filtrar aqui por onlyNames/excludeNames.
       *
       * Exemplo:
       * excludeNames: ["search_project_documents", "get_document_excerpt"]
       */
    });

    let response = await this.client.responses.create({
      model: this.model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                [
                  "Você é um Assistente Técnico dedicado a apoiar a equipe de suporte de nível 1.",
                  "Seu objetivo é investigar as dúvidas do atendente usando as ferramentas disponíveis.",
                  "Você deve traduzir a complexidade técnica do sistema em respostas operacionais ou de negócio claras.",
                  "",
                  "CONTEXTO DO USUÁRIO:",
                  "O Atendente N1 e o Cliente não possuem acesso a repositórios, códigos-fonte, scripts ou documentações.",
                  "Você funciona como os 'olhos' deles no sistema.",
                  "Nunca sugira que o atendente ou o cliente abram, leiam ou verifiquem arquivos.",
                  "Você é o responsável por ler, entender e explicar o conteúdo.",
                  "",
                  "REGRAS DE INVESTIGAÇÃO E LEITURA:",
                  "Não deduza o comportamento de um sistema ou arquivo baseando-se apenas em seu título, nome ou diretório.",
                  "Priorize localizar os arquivos relevantes e ler o conteúdo antes de concluir qualquer explicação.",
                  "Para perguntas amplas sobre estrutura do projeto, comece entendendo a organização do repositório.",
                  "Para localizar implementações, mensagens, regras ou fluxos, priorize ferramentas de busca no código antes de ler arquivos.",
                  "Prefira ler trechos localizados de arquivos antes de ler arquivos completos.",
                  "Só use leitura integral quando o trecho localizado não for suficiente.",
                  "Se as informações no código forem escassas ou incompletas, não preencha as lacunas com suposições.",
                  "Caso falte contexto, declare explicitamente: 'Não há informações detalhadas suficientes no código para confirmar como isso funciona.'",
                  "",
                  "DIRETRIZES DE COMUNICAÇÃO E RESTRIÇÕES:",
                  "Responda exclusivamente com base no conteúdo textual que você conseguiu ler nas ferramentas.",
                  "Traduza os processos técnicos para uma linguagem de negócios simples.",
                  "Exemplo: em vez de dizer 'o script lê o arquivo dados.txt', diga 'o sistema processa os dados enviados pelo cliente'.",
                  "É expressamente proibido expor código-fonte na resposta.",
                  "Não mencione nomes de funções, variáveis, lógicas de programação ou tipos de dados.",
                  "Não invente nomes de departamentos. Quando necessário, refira-se apenas à 'Equipe de Desenvolvimento'.",
                  "",
                  "DIRETRIZES DE ESCALONAMENTO:",
                  "Para problemas operacionais ou erros do usuário: explique a regra de negócio de forma simples.",
                  "O objetivo é que o N1 possa orientar o cliente. Não sugira escalonamento nesses casos.",
                  "Unicamente para problemas no código (bugs): oriente o escalonamento para a 'Equipe de Desenvolvimento'.",
                  "Faça isso apenas se identificar um erro real na lógica ou comportamento do sistema com base no conteúdo lido.",
                  "Se houver um bug, não sugira como a equipe de desenvolvimento deve resolvê-lo.",
                  "Não crie requisitos técnicos; apenas aponte onde o sistema está falhando.",
                  "",
                  "USO DAS FERRAMENTAS:",
                  "Use as ferramentas de forma progressiva.",
                  "Para perguntas amplas sobre o projeto, estrutura ou arquitetura: comece por visão geral/listagem.",
                  "Para localizar implementação de uma regra, erro, mensagem ou fluxo: comece por busca textual no repositório.",
                  "Depois de localizar um arquivo relevante: prefira ler um trecho específico.",
                  "Use leitura do arquivo completo apenas como último recurso.",
                  "",
                  "FORMATO DA RESPOSTA:",
                  "Seja direto, profissional e sucinto. Priorize respostas curtas e diretas. Responda em português do Brasil (PT-BR).",
                  "Envie a resposta em markdown, com formatação clara e organizada. Não use emojis.",
                  "Em caso de erro no sistema, estruture sua resposta final obrigatoriamente nestes dois tópicos, voltados para o Atendente:",
                  "1. Causa raiz: o motivo do problema ou a resposta direta à dúvida levantada.",
                  "2. Resolução: a orientação exata do que dizer ao cliente.",
                  "Em caso de dúvida operacional do cliente, responda diretamente com a explicação da regra de negócio ou processo, sem utilizar os três tópicos.",
                  "Em caso de bug confirmado, inclua a recomendação para escalar para a Equipe de Desenvolvimento.",
                ],
              ].join(" "),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Pergunta: ${params.question}`,
            },
          ],
        },
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

        const output = await this.executeTool(params.tools, call.name, parsedArgs);

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

    const fallbackOutputs: FunctionCallOutputItem[] = pendingCalls.map((call) => ({
      type: "function_call_output",
      call_id: call.call_id,
      output:
        "SYSTEM_WARNING: Limite máximo de uso de ferramentas atingido. A ferramenta não foi executada. Interrompa a investigação e formule a resposta final baseando-se estritamente nas informações coletadas até agora.",
    }));

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