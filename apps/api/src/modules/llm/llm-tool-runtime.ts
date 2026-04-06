import { createMcpClient } from "../../lib/mcp-client.js";

type RuntimeContext = {
  projectId: string;
};

type TextContent = {
  type: "text";
  text: string;
};

function extractMcpText(content: unknown): string {
  if (!Array.isArray(content)) return "";

  return content
    .filter((item): item is TextContent => {
      return (
        !!item &&
        typeof item === "object" &&
        (item as TextContent).type === "text"
      );
    })
    .map((item) => item.text)
    .join("\n")
    .trim();
}

export async function withProjectScopedMcpTools<T>(
  context: RuntimeContext,
  fn: (tools: {
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
  }) => Promise<T>,
) {
  const { client, close } = await createMcpClient();

  try {
    const tools = {
      searchProjectDocuments: async ({ query }: { query: string }) => {
        const result = await client.callTool({
          name: "search_project_documents",
          arguments: {
            projectId: context.projectId,
            query,
          },
        });

        return extractMcpText(result.content);
      },

      getDocumentExcerpt: async ({
        documentId,
        query,
      }: {
        documentId: string;
        query: string;
      }) => {
        const result = await client.callTool({
          name: "get_document_excerpt",
          arguments: {
            projectId: context.projectId,
            documentId,
            query,
          },
        });

        return extractMcpText(result.content);
      },

      searchProjectGitlabFiles: async ({ query }: { query: string }) => {
        const result = await client.callTool({
          name: "search_project_gitlab_files",
          arguments: {
            projectId: context.projectId,
            query,
          },
        });

        return extractMcpText(result.content);
      },

      getGitlabFileExcerpt: async ({
        filePath,
        query,
      }: {
        filePath: string;
        query: string;
      }) => {
        const result = await client.callTool({
          name: "get_gitlab_file_excerpt",
          arguments: {
            projectId: context.projectId,
            filePath,
            query,
          },
        });

        return extractMcpText(result.content);
      },
    };

    return await fn(tools);
  } finally {
    await close();
  }
}
