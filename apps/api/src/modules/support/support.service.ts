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

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "desc" },
      take: 12,
    });

    const orderedMessages = messages.reverse();

    const { answer, toolHistory } = await withProjectScopedMcpTools(
      { projectId: params.projectId },
      async (tools) => {
        return this.llmService.generateSupportAnswerWithTools({
          messages: orderedMessages.map((msg) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          })),
          tools,
          logger: params.logger,
          onTextDelta: handlers?.onTextDelta,
          onToolCall: handlers?.onToolCall,
          onToolResult: handlers?.onToolResult,
        });
      },
    );

    const shouldGenerateTitle = !session.title;

    const generatedTitle = shouldGenerateTitle
      ? await this.llmService.generateChatTitle({
          question: params.question,
          answer: answer,
        })
      : null;

    const updatedSession = generatedTitle
      ? await prisma.chatSession.update({
          where: { id: session.id },
          data: {
            title: generatedTitle,
          },
        })
      : session;

    const assistantMessage = await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content: answer,
      },
    });

    return {
      answer: answer,
      assistantMessage,
      session: updatedSession,
      toolHistory,
    };
  }
}
