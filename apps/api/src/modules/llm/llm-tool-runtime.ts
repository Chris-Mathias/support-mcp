import { createMcpClient } from "../../lib/mcp-client.js";
import { buildProjectScopedRuntime } from "@support-mvp/mcp-server/tools-registry.js";

type RuntimeContext = {
  projectId: string;
};

export type ProjectScopedRuntimeTools = Record<
  string,
  (args?: Record<string, unknown>) => Promise<string>
>;

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
