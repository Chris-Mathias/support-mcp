import { prisma } from "../../lib/prisma.js";
import { createMcpClient } from "../../lib/mcp-client.js";
import { LlmService } from "../llm/llm.service.js";
import { sanitizeAssistantOutput } from "../safety/output-policy.js";

type AskQuestionParams = {
  sessionId: string;
  projectId: string;
  question: string;
};

type MpcTextContent = {
  type: "text";
  text: string;
};

export class SupportService {
  private llmService = new LlmService();

  async askQuestion(params: AskQuestionParams) {
    const session = await prisma.chatSession.findUnique({
      where: { id: params.sessionId },
    });

    if (!session) {
      throw new Error("SESSION_NOT_FOUND");
    }

    if (session.projectId !== params.projectId) {
      throw new Error("PROJECT_SESSION_MISMATCH");
    }

    await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: "user",
        content: params.question,
      },
    });

    const { client, close } = await createMcpClient();

    try {
      const documentSearch = await client.callTool({
        name: "search_project_documents",
        arguments: {
          projectId: params.projectId,
          query: params.question,
        },
      });

      const gitlabSearch = await client.callTool({
        name: "search_project_gitlab_files",
        arguments: {
          projectId: params.projectId,
          query: params.question,
        },
      });

      const docText = this.extractText(documentSearch.content);
      const gitlabText = this.extractText(gitlabSearch.content);

      const rawAnswer = await this.llmService.generateSupportAnswer({
        question: params.question,
        projectId: params.projectId,
        documentSearchText: docText,
        gitlabSearchText: gitlabText,
      });

      const safeAnswer = sanitizeAssistantOutput(rawAnswer);

      const assistantMessage = await prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: "assistant",
          content: safeAnswer,
        },
      });

      return {
        answer: safeAnswer,
        assistantMessage,
      };
    } finally {
      await close();
    }
  }

  private extractText(content: unknown): string {
    if (!Array.isArray(content)) return "";

    const textParts = content
      .filter((item): item is MpcTextContent => {
        return (
          !!item &&
          typeof item === "object" &&
          (item as MpcTextContent).type === "text"
        );
      })
      .map((item) => item.text);

    return textParts.join("\n").trim();
  }
}
