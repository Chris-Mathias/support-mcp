// src/tools/tool-registry.ts
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * =================
 * IMPORTS DAS TOOLS
 * =================
 */

import {
  getRepositoryOverview,
  getRepositoryOverviewInputSchema,
} from "./tools/repository/get-repository-overview.js";

import {
  listRepositoryTree,
  listRepositoryTreeInputSchema,
} from "./tools/repository/list-repository-tree.js";

import {
  searchRepositoryContent,
  searchRepositoryContentInputSchema,
} from "./tools/repository/search-repository-content.js";

import {
  readFileExcerpt,
  readFileExcerptInputSchema,
} from "./tools/repository/read-file-excerpt.js";

import {
  readFullFile,
  readFullFileInputSchema,
} from "./tools/repository/read-full-file.js";

import {
  getDocumentOverview,
  getDocumentOverviewInputSchema,
} from "./tools/documents/get-document-overview.js";

import {
  listProjectDocuments,
  listProjectDocumentsInputSchema,
} from "./tools/documents/list-project-documents.js";

import {
  searchDocumentContent,
  searchDocumentContentInputSchema,
} from "./tools/documents/search-document-content.js";

import {
  readDocumentExcerpt,
  readDocumentExcerptInputSchema,
} from "./tools/documents/read-document-excerpt.js";

import {
  readFullDocument,
  readFullDocumentInputSchema,
} from "./tools/documents/read-full-document.js";

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
  /**
   * Tools para pesquisa e leitura de repositórios de código no Gitlab
   */
  defineTool({
    name: "get_repository_overview",
    description:
      "Retorna um panorama estrutural do repositório GitLab, incluindo README da raiz, linguagens predominantes, diretórios centrais, arquivos importantes, possíveis entrypoints e sinais arquiteturais.",
    llmDescription:
      "Use no início de uma investigação para entender a estrutura do sistema e identificar onde procurar. Esta é a tool padrão para obter contexto inicial do repositório. Não use para localizar implementações específicas, mensagens de erro ou trechos de código; para isso, prefira a tool de busca no repositório.",
    inputSchema: getRepositoryOverviewInputSchema,
    llmInputSchema: z.object({}),
    projectScoped: true,
    handler: getRepositoryOverview,
  }),

  defineTool({
    name: "list_repository_tree",
    description:
      "Lista arquivos e diretórios do repositório GitLab de forma estrutural, com suporte a caminho e profundidade para navegação de subárvores.",
    llmDescription:
      "Use para navegar na estrutura do repositório ou de um diretório específico quando for necessário entender a organização dos módulos. Sempre informe path, depth, includeFiles e includeDirectories. Use path vazio para a raiz. Não use para localizar strings, implementações ou mensagens de erro; nesses casos, use a tool de busca no repositório.",
    inputSchema: listRepositoryTreeInputSchema,
    llmInputSchema: z.object({
      path: z.string().trim(),
      depth: z.number().int().min(1).max(5),
      includeFiles: z.boolean(),
      includeDirectories: z.boolean(),
    }),
    projectScoped: true,
    handler: listRepositoryTree,
  }),

  defineTool({
    name: "search_repository_content",
    description:
      "Busca conteúdo textual no repositório GitLab para localizar implementações, símbolos, mensagens de erro, endpoints, configurações e strings relevantes.",
    llmDescription:
      "Use para localizar rapidamente onde um comportamento, erro, símbolo, endpoint, tabela, configuração ou texto aparece no repositório. Sempre informe query, pathPrefix, fileGlobs e maxResults. Use string vazia em pathPrefix quando quiser buscar no repositório inteiro e use array vazio em fileGlobs quando não quiser filtrar por padrão de arquivo. Após encontrar resultados promissores, prefira ler trechos com a tool de excerpt.",
    inputSchema: searchRepositoryContentInputSchema,
    llmInputSchema: z.object({
      query: z.string().min(1),
      pathPrefix: z.string(),
      fileGlobs: z.array(z.string()),
      maxResults: z.number().int().min(1).max(20),
    }),
    projectScoped: true,
    handler: searchRepositoryContent,
  }),

  defineTool({
    name: "read_file_excerpt",
    description:
      "Lê um trecho específico de um arquivo do repositório GitLab, por faixa de linhas, linha âncora ou primeira ocorrência de uma query.",
    llmDescription:
      "Use como forma padrão de inspeção de código, configuração ou documentação após localizar um arquivo relevante. Prefira esta tool em vez de ler o arquivo inteiro. Sempre informe filePath, query, startLine, endLine, anchorLine, before e after. Use query vazia quando não quiser buscar por texto. Use 0 em startLine, endLine e anchorLine quando não quiser usar esses modos.",
    inputSchema: readFileExcerptInputSchema,
    llmInputSchema: z.object({
      filePath: z.string().min(1),
      query: z.string(),
      startLine: z.number().int().min(0),
      endLine: z.number().int().min(0),
      anchorLine: z.number().int().min(0),
      before: z.number().int().min(0).max(200),
      after: z.number().int().min(0).max(200),
    }),
    projectScoped: true,
    handler: readFileExcerpt,
  }),

  defineTool({
    name: "read_full_file",
    description:
      "Lê o conteúdo completo de um arquivo do repositório GitLab e retorna também metadados úteis, como tamanho, quantidade de linhas e tipo estimado do arquivo.",
    llmDescription:
      "Use apenas quando o conteúdo integral do arquivo for realmente necessário para entender configuração, documentação curta, migration, script ou arquivo pequeno. Não use como forma padrão de inspeção de código; prefira read_file_excerpt para leitura localizada.",
    inputSchema: readFullFileInputSchema,
    llmInputSchema: z.object({
      filePath: z.string().min(1),
    }),
    projectScoped: true,
    handler: readFullFile,
  }),

  /**
   * Tools para pesquisa e leitura de documentos do projeto (arquivos PDF)
   */
  defineTool({
    name: "get_document_overview",
    description:
      "Retorna uma visão geral de um documento do projeto, incluindo metadados, status de processamento, resumo, tipo estimado do documento, palavras-chave, seções detectadas e prévias iniciais de chunks.",
    llmDescription:
      "Use após identificar um documento relevante para entender rapidamente o que ele contém e como navegar nele. Esta é a tool padrão para inspeção inicial de um documento específico antes de buscar termos internos ou abrir trechos mais direcionados. Sempre informe documentId, includeChunkPreviews e maxChunkPreviews. Use true em includeChunkPreviews quando quiser ver uma amostra dos primeiros trechos. Não use esta tool para localizar ocorrências específicas de erros, strings, procedimentos ou termos internos; para isso, prefira a tool de busca de conteúdo documental.",
    inputSchema: getDocumentOverviewInputSchema,
    llmInputSchema: z.object({
      documentId: z.string().min(1),
      includeChunkPreviews: z.boolean(),
      maxChunkPreviews: z.number().int().min(1).max(10),
    }),
    projectScoped: true,
    handler: getDocumentOverview,
  }),

  defineTool({
    name: "list_project_documents",
    description:
      "Lista os documentos do projeto já ingeridos pelo sistema, retornando metadados úteis para navegação, como nome do arquivo, status de processamento, quantidade de chunks, número de páginas, resumo curto e datas de criação e atualização.",
    llmDescription:
      "Use no início da investigação documental para descobrir quais PDFs e documentos estão disponíveis no projeto e quais estão prontos para uso. Esta é a tool padrão para obter contexto inicial dos documentos antes de abrir um documento específico ou buscar conteúdo textual. Prefira documentos com isUsable igual a true. Sempre informe status, onlyReady, fileNameContains, limit e orderBy. Use null em status quando não quiser filtrar por estado. Use false em onlyReady quando quiser listar tudo. Use string vazia em fileNameContains quando não quiser filtrar por nome. Não use esta tool para localizar termos, erros, procedimentos ou trechos internos do documento; para isso, prefira a tool de busca de conteúdo documental.",
    inputSchema: listProjectDocumentsInputSchema,
    llmInputSchema: z.object({
      status: z
        .enum(["PENDING", "PROCESSING", "READY", "FAILED", "UNSUPPORTED"])
        .nullable(),
      onlyReady: z.boolean(),
      fileNameContains: z.string(),
      limit: z.number().int().min(1).max(100),
      orderBy: z.enum([
        "createdAt_desc",
        "createdAt_asc",
        "fileName_asc",
        "fileName_desc",
      ]),
    }),
    projectScoped: true,
    handler: listProjectDocuments,
  }),

  defineTool({
    name: "search_document_content",
    description:
      "Busca conteúdo textual nos chunks dos documentos do projeto para localizar termos, erros, procedimentos, mensagens, conceitos funcionais e trechos relevantes.",
    llmDescription:
      "Use para localizar rapidamente em quais documentos e trechos um termo, erro, procedimento, configuração funcional ou conceito aparece. Esta é a tool padrão para busca textual documental. Sempre informe query, documentId e limit. Use null em documentId quando quiser buscar em todos os documentos do projeto. Após encontrar resultados promissores, prefira abrir trechos específicos com read_document_excerpt em vez de ler o documento inteiro.",
    inputSchema: searchDocumentContentInputSchema,
    llmInputSchema: z.object({
      query: z.string().min(1),
      documentId: z.string().min(1).nullable(),
      limit: z.number().int().min(1).max(20),
    }),
    projectScoped: true,
    handler: searchDocumentContent,
  }),

  defineTool({
    name: "read_document_excerpt",
    description:
      "Lê um trecho localizado de um documento do projeto, usando como âncora um chunk específico, um índice de chunk ou a primeira ocorrência relevante de uma query, com suporte a expansão por chunks vizinhos.",
    llmDescription:
      "Use como forma padrão de inspeção documental após identificar um documento ou um resultado promissor de busca. Prefira esta tool em vez de ler o documento inteiro. Sempre informe documentId, chunkId, chunkIndex, query, before e after. Use null em chunkId quando não quiser ancorar por id. Use null em chunkIndex quando não quiser ancorar por índice. Use string vazia em query quando não quiser buscar por texto. Use 0 em before e after quando não quiser expandir para chunks vizinhos. A prioridade de resolução é chunkId, depois chunkIndex, depois query; se nada for informado, a tool retorna o início do documento.",
    inputSchema: readDocumentExcerptInputSchema,
    llmInputSchema: z.object({
      documentId: z.string().min(1),
      chunkId: z.string().min(1).nullable(),
      chunkIndex: z.number().int().min(0).nullable(),
      query: z.string(),
      before: z.number().int().min(0).max(10),
      after: z.number().int().min(0).max(10),
    }),
    projectScoped: true,
    handler: readDocumentExcerpt,
  }),

  defineTool({
    name: "read_full_document",
    description:
      "Lê o conteúdo integral extraído de um documento do projeto e retorna também metadados úteis, como status de processamento, tamanho, quantidade de chunks e número de páginas.",
    llmDescription:
      "Use apenas quando o conteúdo integral do documento for realmente necessário para entender um manual curto, uma política, uma especificação pequena ou um documento com poucos trechos relevantes. Não use como forma padrão de inspeção documental; prefira read_document_excerpt para leitura localizada. Sempre informe documentId.",
    inputSchema: readFullDocumentInputSchema,
    llmInputSchema: z.object({
      documentId: z.string().min(1),
    }),
    projectScoped: true,
    handler: readFullDocument,
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
