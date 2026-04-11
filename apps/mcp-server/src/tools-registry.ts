// src/tools/tool-registry.ts
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * =========================
 * IMPORTS DAS TOOLS ATUAIS
 * =========================
 *
 * Ajuste os paths se necessário.
 */

import {
  searchProjectDocuments,
  searchProjectDocumentsInputSchema,
} from "./tools/search-project-documents.js";

import {
  getDocumentExcerpt,
  getDocumentExcerptInputSchema,
} from "./tools/get-document-excerpt.js";

import {
  listProjectGitlabFiles,
  listProjectGitlabFilesInputSchema,
} from "./tools/list-project-gitlab-files.js";

import {
  searchProjectGitlabFiles,
  searchProjectGitlabFilesInputSchema,
} from "./tools/search-project-gitlab-files.js";

import {
  getGitlabFileExcerpt,
  getGitlabFileExcerptInputSchema,
} from "./tools/get-gitlab-file-excerpt.js";

import {
  readFullGitlabFile,
  readFullGitlabFileInputSchema,
} from "./tools/read-full-gitlab-file.js";

import {
  getProjectReadme,
  getProjectReadmeInputSchema,
} from "./tools/get-project-readme.js";

/**
 * =========================
 * TIPOS BASE
 * =========================
 */

export type AnyZodSchema = z.ZodTypeAny;

export type ToolHandler<TSchema extends AnyZodSchema = AnyZodSchema> = (
  input: z.infer<TSchema>,
) => Promise<unknown>;

export type RegisteredTool<
  TSchema extends AnyZodSchema = AnyZodSchema,
  TLlmSchema extends AnyZodSchema = TSchema,
> = {
  name: string;
  runtimeName?: string;
  description: string;
  llmDescription?: string;

  /**
   * Schema real da tool no MCP/server.
   * Pode incluir projectId.
   */
  inputSchema: TSchema;

  /**
   * Schema exposto para a LLM.
   * Para tools projectScoped, deve omitir projectId.
   * Se ausente, usa inputSchema.
   */
  llmInputSchema?: TLlmSchema;

  projectScoped?: boolean;
  handler: ToolHandler<TSchema>;
};

export type ToolRegistry = readonly RegisteredTool<any>[];
export type ToolName<TTools extends ToolRegistry = typeof toolRegistry> =
  TTools[number]["name"];

/**
 * =========================
 * HELPERS DE NOME
 * =========================
 */

export function snakeToCamel(value: string): string {
  return value.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

export function camelToSnake(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
}

/**
 * =========================
 * HELPERS DE SCHEMA
 * =========================
 */

function toJsonSchema(schema: AnyZodSchema) {
  const jsonSchema = zodToJsonSchema(schema, {
    target: "jsonSchema7",
    $refStrategy: "none",
  }) as Record<string, unknown>;

  /**
   * Alguns consumidores não gostam de campos extras.
   * Aqui limpamos o resultado para uso tanto no MCP quanto no OpenAI.
   */
  delete jsonSchema.$schema;
  delete jsonSchema.definitions;

  return jsonSchema;
}

/**
 * =========================
 * FACTORY OPCIONAL
 * =========================
 */

export function defineTool<
  TSchema extends AnyZodSchema,
  TLlmSchema extends AnyZodSchema = TSchema,
>(
  tool: RegisteredTool<TSchema, TLlmSchema>,
): RegisteredTool<TSchema, TLlmSchema> {
  return {
    runtimeName: tool.runtimeName ?? snakeToCamel(tool.name),
    ...tool,
  };
}

/**
 * =========================
 * REGISTRO CENTRAL
 * =========================
 *
 * Este array é a fonte única de verdade.
 * Adicionar/remover/alterar uma tool deve acontecer aqui.
 */

export const toolRegistry = [
  defineTool({
    name: "search_project_documents",
    description:
      "Pesquisa por texto no conteúdo dos documentos do projeto. Use para descobrir quais documentos falam sobre um assunto, fluxo, regra ou mensagem.",
    llmDescription:
      "Use para localizar documentos relevantes por assunto. Chame esta tool antes de tentar ler trechos específicos de um documento.",
    inputSchema: searchProjectDocumentsInputSchema,
    llmInputSchema: z.object({
      query: z.string().min(1),
    }),
    projectScoped: true,
    handler: searchProjectDocuments,
  }),

  defineTool({
    name: "get_document_excerpt",
    description:
      "Extrai o trecho mais relevante de um documento específico onde o termo pesquisado aparece. Use após encontrar um documento relevante em uma busca anterior.",
    llmDescription:
      "Use somente depois de já conhecer o documentId. Esta é a forma preferencial de leitura localizada em documentos; evite ler conteúdo amplo sem necessidade.",
    inputSchema: getDocumentExcerptInputSchema,
    llmInputSchema: z.object({
      documentId: z.string().min(1),
      query: z.string().min(1),
    }),
    projectScoped: true,
    handler: getDocumentExcerpt,
  }),

  defineTool({
    name: "list_project_gitlab_files",
    description:
      "Lista caminhos de arquivos do repositório GitLab. Use para entender a estrutura de pastas, mapear módulos ou localizar arquivos por nome/caminho.",
    llmDescription:
      "Use primeiro em perguntas amplas sobre estrutura do projeto, arquitetura ou organização do repositório. Também use quando a busca textual não for suficiente para orientar a navegação.",
    inputSchema: listProjectGitlabFilesInputSchema,
    llmInputSchema: z.object({}),
    projectScoped: true,
    handler: listProjectGitlabFiles,
  }),

  defineTool({
    name: "search_project_gitlab_files",
    description:
      "Pesquisa por um termo dentro do repositório GitLab. Use para localizar onde uma lógica, erro, endpoint, SQL, configuração, serviço ou regra está implementado.",
    llmDescription:
      "Ferramenta principal para localizar implementação no repositório. Prefira esta tool antes de ler arquivos. Use para procurar nomes técnicos, mensagens, tabelas, endpoints, serviços e regras.",
    inputSchema: searchProjectGitlabFilesInputSchema,
    llmInputSchema: z.object({
      query: z.string().min(1),
    }),
    projectScoped: true,
    handler: searchProjectGitlabFiles,
  }),

  defineTool({
    name: "get_gitlab_file_excerpt",
    description:
      "Obtém um trecho relevante de um arquivo específico do GitLab a partir de um termo pesquisado. Use após identificar o arquivo via busca ou navegação.",
    llmDescription:
      "Ferramenta principal de leitura localizada em código. Prefira esta tool em vez de ler o arquivo completo. Use depois de search_project_gitlab_files ou list_project_gitlab_files.",
    inputSchema: getGitlabFileExcerptInputSchema,
    llmInputSchema: z.object({
      filePath: z.string().min(1),
      query: z.string().min(1),
    }),
    projectScoped: true,
    handler: getGitlabFileExcerpt,
  }),

  defineTool({
    name: "read_full_gitlab_file",
    description:
      "Lê o conteúdo integral de um arquivo do repositório GitLab. Use apenas quando o arquivo completo for realmente necessário.",
    llmDescription:
      "Use apenas como último recurso, quando trechos localizados não forem suficientes ou quando o arquivo for pequeno e a visão completa for indispensável. Não use como primeira etapa de inspeção.",
    inputSchema: readFullGitlabFileInputSchema,
    llmInputSchema: z.object({
      filePath: z.string().min(1),
    }),
    projectScoped: true,
    handler: readFullGitlabFile,
  }),

  defineTool({
    name: "get_project_readme",
    description:
      "Obtém o conteúdo do README do repositório GitLab. Use para entender propósito do projeto, setup, comandos e visão geral técnica.",
    llmDescription:
      "Use somente quando a pergunta exigir visão geral do projeto, setup, execução ou contexto inicial de alto nível. Não use como substituto de busca no código.",
    inputSchema: getProjectReadmeInputSchema,
    llmInputSchema: z.object({}),
    projectScoped: true,
    handler: getProjectReadme,
  }),
] as const satisfies ToolRegistry;

/**
 * =========================
 * MAPAS E TIPOS DERIVADOS
 * =========================
 */

export type AppToolName = ToolName<typeof toolRegistry>;
export type AppToolRuntimeName = (typeof toolRegistry)[number]["runtimeName"];

export const toolMap = new Map<AppToolName, (typeof toolRegistry)[number]>(
  toolRegistry.map((tool) => [tool.name as AppToolName, tool]),
);

export const toolMapByRuntimeName = new Map<
  NonNullable<AppToolRuntimeName>,
  (typeof toolRegistry)[number]
>(
  toolRegistry.map((tool) => [
    tool.runtimeName as NonNullable<AppToolRuntimeName>,
    tool,
  ]),
);

/**
 * =========================
 * HELPERS DE CONSULTA
 * =========================
 */

export function getRegisteredTool(name: string) {
  return toolMap.get(name as AppToolName);
}

export function getRegisteredToolByRuntimeName(runtimeName: string) {
  return toolMapByRuntimeName.get(
    runtimeName as NonNullable<AppToolRuntimeName>,
  );
}

export function assertRegisteredTool(name: string) {
  const tool = getRegisteredTool(name);

  if (!tool) {
    throw new Error(`Tool not found: ${name}`);
  }

  return tool;
}

/**
 * =========================
 * EXECUTOR CENTRAL
 * =========================
 *
 * Útil para o server.ts e qualquer outro dispatcher.
 */

export async function executeRegisteredTool(
  name: string,
  args: unknown,
): Promise<unknown> {
  const tool = assertRegisteredTool(name);
  const parsedArgs = tool.inputSchema.parse(args);
  return tool.handler(parsedArgs as any);
}

/**
 * =========================
 * MCP: LIST TOOLS PAYLOAD
 * =========================
 */

export function buildMcpToolList() {
  return toolRegistry.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: toJsonSchema(tool.inputSchema),
  }));
}

/**
 * =========================
 * OPENAI RESPONSES API: TOOLS
 * =========================
 *
 * Gera as function definitions automaticamente.
 */

export function buildOpenAiToolDefinitions(options?: {
  onlyNames?: string[];
  excludeNames?: string[];
}) {
  const onlyNames = options?.onlyNames;
  const excludeNames = new Set(options?.excludeNames ?? []);

  return toolRegistry
    .filter((tool) => {
      if (onlyNames && !onlyNames.includes(tool.name)) return false;
      if (excludeNames.has(tool.name)) return false;
      return true;
    })
    .map((tool) => ({
      type: "function" as const,
      name: tool.name,
      description: tool.llmDescription ?? tool.description,
      parameters: toJsonSchema(tool.llmInputSchema ?? tool.inputSchema),
      strict: true,
    }));
}

/**
 * =========================
 * RUNTIME PROJECT-SCOPED
 * =========================
 *
 * Gera wrappers genéricos para o llm-tool-runtime.ts
 * sem precisar declarar uma função por tool.
 */

type McpClientLike = {
  callTool(input: {
    name: string;
    arguments?: Record<string, unknown>;
  }): Promise<unknown>;
};

type TextContent = {
  type: "text";
  text: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function extractTextFromContentArray(content: unknown): string {
  if (!Array.isArray(content)) return "";

  return content
    .filter((item): item is TextContent => {
      return (
        isRecord(item) && item.type === "text" && typeof item.text === "string"
      );
    })
    .map((item) => item.text)
    .join("\n")
    .trim();
}

/**
 * Normaliza possíveis formatos de retorno do MCP SDK.
 *
 * Casos suportados:
 * - { content: [...] }
 * - { toolResult: ... }
 * - string direta
 * - outros objetos serializáveis
 */
export function extractMcpText(result: unknown): string {
  if (typeof result === "string") {
    return result.trim();
  }

  if (!isRecord(result)) {
    return "";
  }

  /**
   * Caso padrão MCP: retorno com content[]
   */
  if ("content" in result) {
    const text = extractTextFromContentArray(result.content);
    if (text) return text;
  }

  /**
   * Alguns tipos do SDK podem retornar toolResult
   */
  if ("toolResult" in result) {
    const toolResult = result.toolResult;

    if (typeof toolResult === "string") {
      return toolResult.trim();
    }

    const text = extractTextFromContentArray(toolResult);
    if (text) return text;

    if (toolResult !== undefined) {
      try {
        return JSON.stringify(toolResult, null, 2);
      } catch {
        return String(toolResult);
      }
    }
  }

  /**
   * Fallback: serializa o objeto inteiro
   */
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

export function buildProjectScopedRuntime(params: {
  client: McpClientLike;
  projectId: string;
  onlyNames?: string[];
  excludeNames?: string[];
}) {
  const { client, projectId, onlyNames, excludeNames = [] } = params;
  const excludeSet = new Set(excludeNames);

  const selectedTools = toolRegistry.filter((tool) => {
    if (onlyNames && !onlyNames.includes(tool.name)) return false;
    if (excludeSet.has(tool.name)) return false;
    return true;
  });

  const runtime = Object.fromEntries(
    selectedTools.map((tool) => [
      tool.runtimeName!,
      async (args: Record<string, unknown> = {}) => {
        const finalArgs = tool.projectScoped
          ? { ...args, projectId }
          : { ...args };

        const result = await client.callTool({
          name: tool.name,
          arguments: finalArgs,
        });

        return extractMcpText(result);
      },
    ]),
  ) as Record<string, (args?: Record<string, unknown>) => Promise<string>>;

  return runtime;
}

/**
 * =========================
 * RUNTIME DINÂMICO POR NOME MCP
 * =========================
 *
 * Caso você prefira expor os nomes MCP diretamente para a LLM,
 * em vez de camelCase.
 */

export function buildProjectScopedRuntimeByToolName(params: {
  client: McpClientLike;
  projectId: string;
  onlyNames?: string[];
  excludeNames?: string[];
}) {
  const { client, projectId, onlyNames, excludeNames = [] } = params;
  const excludeSet = new Set(excludeNames);

  const selectedTools = toolRegistry.filter((tool) => {
    if (onlyNames && !onlyNames.includes(tool.name)) return false;
    if (excludeSet.has(tool.name)) return false;
    return true;
  });

  const runtime = Object.fromEntries(
    selectedTools.map((tool) => [
      tool.name,
      async (args: Record<string, unknown> = {}) => {
        const finalArgs = tool.projectScoped
          ? { projectId, ...args }
          : { ...args };

        const result = await client.callTool({
          name: tool.name,
          arguments: finalArgs,
        });

        return extractMcpText(result);
      },
    ]),
  ) as Record<string, (args?: Record<string, unknown>) => Promise<string>>;

  return runtime;
}

/**
 * =========================
 * UTILITÁRIOS PARA DEBUG / INSPEÇÃO
 * =========================
 */

export function listToolNames() {
  return toolRegistry.map((tool) => tool.name);
}

export function listRuntimeNames() {
  return toolRegistry.map((tool) => tool.runtimeName);
}

export function getToolMetadata() {
  return toolRegistry.map((tool) => ({
    name: tool.name,
    runtimeName: tool.runtimeName,
    description: tool.description,
    llmDescription: tool.llmDescription,
    projectScoped: !!tool.projectScoped,
  }));
}
