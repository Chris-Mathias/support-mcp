import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { buildMcpToolList, executeRegisteredTool } from "./tools-registry.js";

const server = new Server(
  {
    name: "support-mvp-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: buildMcpToolList(),
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await executeRegisteredTool(name, args);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Erro: ${error instanceof Error ? error.message : "erro desconhecido"}`,
        },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
