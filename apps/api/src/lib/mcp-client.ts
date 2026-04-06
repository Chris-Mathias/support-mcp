import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export async function createMcpClient() {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "../../apps/mcp-server/src/server.ts"],
  });

  const client = new Client(
    {
      name: "support-mvp-api-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    },
  );

  await client.connect(transport);

  return {
    client,
    close: async () => {
      await client.close();
    },
  };
}
