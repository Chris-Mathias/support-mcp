import { prisma } from "../../lib/prisma.js";
import { LlmService } from "../llm/llm.service.js";
import { withProjectScopedMcpTools } from "../llm/llm-tool-runtime.js";
import { sanitizeAssistantOutput } from "../safety/output-policy.js";

type AskQuestionParams = {
  sessionId: string;
  projectId: string;
  question: string;
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

    const { answer, toolHistory } = await withProjectScopedMcpTools(
      { projectId: params.projectId },
      async (tools) => {
        return this.llmService.generateSupportAnswerWithTools({
          question: params.question,
          tools,
        });
      },
    );

    const safeAnswer = sanitizeAssistantOutput(answer);

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
      toolHistory,
    };
  }
}
