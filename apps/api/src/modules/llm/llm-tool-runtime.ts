import { createMcpClient } from "../../lib/mcp-client.js";
import {
  buildProjectScopedRuntime,
  buildProjectScopedRuntimeByToolName,
} from "@support-mvp/mcp-server/src/tools-registry.js";

type RuntimeContext = {
  projectId: string;
};

export type ProjectScopedRuntimeTools = Record<
  string,
  (args?: Record<string, unknown>) => Promise<string>
>;

/**
 * Cria um runtime de tools MCP com projectId injetado automaticamente
 * e expõe as tools usando runtimeName (camelCase).
 *
 * Exemplo de chaves geradas:
 * - searchProjectDocuments
 * - getDocumentExcerpt
 * - listProjectGitlabFiles
 * - searchProjectGitlabFiles
 * - getGitlabFileExcerpt
 * - readFullGitlabFile
 * - getProjectReadme
 *
 * Este formato é útil para manter compatibilidade com o LlmService atual.
 */
export async function withProjectScopedMcpTools<T>(
  context: RuntimeContext,
  fn: (tools: ProjectScopedRuntimeTools) => Promise<T>,
  options?: {
    onlyNames?: string[];
    excludeNames?: string[];
  },
): Promise<T> {
  const { client, close } = await createMcpClient();

  try {
    const tools = buildProjectScopedRuntime({
      client,
      projectId: context.projectId,
      onlyNames: options?.onlyNames,
      excludeNames: options?.excludeNames,
    });

    return await fn(tools);
  } finally {
    await close();
  }
}

/**
 * Variante alternativa que expõe as tools pelos nomes MCP originais.
 *
 * Exemplo de chaves geradas:
 * - search_project_documents
 * - get_document_excerpt
 * - list_project_gitlab_files
 * - search_project_gitlab_files
 * - get_gitlab_file_excerpt
 * - read_full_gitlab_file
 * - get_project_readme
 *
 * Esta versão tende a simplificar integrações futuras, porque elimina
 * a necessidade de mapear snake_case <-> camelCase.
 */
export async function withProjectScopedMcpToolsByName<T>(
  context: RuntimeContext,
  fn: (tools: ProjectScopedRuntimeTools) => Promise<T>,
  options?: {
    onlyNames?: string[];
    excludeNames?: string[];
  },
): Promise<T> {
  const { client, close } = await createMcpClient();

  try {
    const tools = buildProjectScopedRuntimeByToolName({
      client,
      projectId: context.projectId,
      onlyNames: options?.onlyNames,
      excludeNames: options?.excludeNames,
    });

    return await fn(tools);
  } finally {
    await close();
  }
}