import { prisma } from "../../lib/prisma.js";
import { LlmService } from "../llm/llm.service.js";
import { withProjectScopedMcpTools } from "../llm/llm-tool-runtime.js";

type AskQuestionParams = {
  sessionId: string;
  projectId: string;
  question: string;
  logger?: { debug: (obj: Record<string, unknown>, msg: string) => void };
};

type AskQuestionStreamHandlers = {
  onTextDelta?: (delta: string, content: string) => void;
  onToolCall?: (info: {
    step: number;
    tool: string;
    arguments: Record<string, unknown>;
  }) => void;
  onToolResult?: (info: {
    step: number;
    tool: string;
    resultPreview: string;
  }) => void;
};

export class SupportService {
  private llmService = new LlmService();

  async askQuestion(params: AskQuestionParams) {
    return this.answerQuestion(params);
  }

  async askQuestionStream(
    params: AskQuestionParams,
    handlers: AskQuestionStreamHandlers,
  ) {
    return this.answerQuestion(params, handlers);
  }

  private async answerQuestion(
    params: AskQuestionParams,
    handlers?: AskQuestionStreamHandlers,
  ) {
    const session = await prisma.chatSession.findFirst({
      where: { id: params.sessionId, deletedAt: null },
    });

    if (!session) {
      throw new Error("SESSION_NOT_FOUND");
    }

    if (session.projectId !== params.projectId) {
      throw new Error("PROJECT_SESSION_MISMATCH");
    }

    const history = await prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "desc" },
      take: 11,
    });

    const messagesForLlm = [
      ...history.reverse().map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user" as const, content: params.question },
    ];

    // If the LLM throws here nothing has been written to the DB yet.
    const { answer, toolHistory } = await withProjectScopedMcpTools(
      { projectId: params.projectId },
      async (tools) => {
        return this.llmService.generateSupportAnswerWithTools({
          messages: messagesForLlm,
          tools,
          logger: params.logger,
          onTextDelta: handlers?.onTextDelta,
          onToolCall: handlers?.onToolCall,
          onToolResult: handlers?.onToolResult,
        });
      },
    );

    // Title generation is best-effort: failure must not prevent message persistence.
    const generatedTitle = !session.title
      ? await this.llmService.generateChatTitle({ question: params.question, answer }).catch(() => null)
      : null;

    // Persist user message + assistant message + optional title update atomically.
    const { userMessage, assistantMessage, updatedSession } = await prisma.$transaction(async (tx) => {
      const userMessage = await tx.chatMessage.create({
        data: { sessionId: session.id, role: "user", content: params.question },
      });
      const assistantMessage = await tx.chatMessage.create({
        data: { sessionId: session.id, role: "assistant", content: answer },
      });
      const updatedSession = generatedTitle
        ? await tx.chatSession.update({ where: { id: session.id }, data: { title: generatedTitle } })
        : session;
      return { userMessage, assistantMessage, updatedSession };
    });

    return {
      answer,
      userMessage,
      assistantMessage,
      session: updatedSession,
      toolHistory,
    };
  }
}
