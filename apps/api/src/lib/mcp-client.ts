import { executeRegisteredTool } from "@support-mvp/mcp-server/tools-registry.js";

export async function createMcpClient() {
  const client = {
    async callTool(input: {
      name: string;
      arguments?: Record<string, unknown>;
    }) {
      return executeRegisteredTool(input.name, input.arguments ?? {});
    },
  };

  return {
    client,
    close: async () => {},
  };
}
