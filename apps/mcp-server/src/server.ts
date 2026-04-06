import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import {
  searchProjectDocuments,
  searchProjectDocumentsInputSchema,
} from "./tools/search-project-documents.js";
import {
  getDocumentExcerpt,
  getDocumentExcerptInputSchema,
} from "./tools/get-document-excerpt.js";
import { searchProjectGitlabFiles } from "./tools/search-project-gitlab-files.js";
import { getGitlabFileExcerpt } from "./tools/get-gitlab-file-excerpt.js";

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
    tools: [
      {
        name: "search_project_documents",
        description:
          "Busca documentos PDF de um projeto por texto, sempre filtrando por projectId.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string" },
            query: { type: "string" },
          },
          required: ["projectId", "query"],
        },
      },
      {
        name: "get_document_excerpt",
        description:
          "Retorna trecho de um documento específico de um projeto, sempre filtrando por projectId.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string" },
            documentId: { type: "string" },
            query: { type: "string" },
          },
          required: ["projectId", "documentId", "query"],
        },
      },
      {
        name: "search_project_gitlab_files",
        description:
          "Busca arquivos do GitLab associados ao projeto, sempre filtrando por projectId.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string" },
            query: { type: "string" },
          },
          required: ["projectId", "query"],
        },
      },
      {
        name: "get_gitlab_file_excerpt",
        description:
          "Retorna trecho de um arquivo GitLab do projeto, sempre filtrando por projectId.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string" },
            filePath: { type: "string" },
            query: { type: "string" },
          },
          required: ["projectId", "filePath", "query"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "search_project_documents": {
        const validated = searchProjectDocumentsInputSchema.parse(args);
        const result = await searchProjectDocuments(validated);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_document_excerpt": {
        const validated = getDocumentExcerptInputSchema.parse(args);
        const result = await getDocumentExcerpt(validated);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "search_project_gitlab_files": {
        const result = await searchProjectGitlabFiles(args);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_gitlab_file_excerpt": {
        const result = await getGitlabFileExcerpt(args);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Tool not found: ${name}`);
    }
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
