import { prisma } from "../../lib/prisma.js";
import type {
  CreateChatMessageInput,
  CreateChatSessionInput,
} from "./chat.schemas.js";

export class ChatService {
  async createSession(data: CreateChatSessionInput) {
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
    });

    if (!project) {
      throw new Error("PROJECT_NOT_FOUND");
    }

    return prisma.chatSession.create({
      data: {
        projectId: project.id,
      },
      include: {
        project: true,
      },
    });
  }

  async listSessionsByProject(projectId: string) {
    return prisma.chatSession.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }

  async getSessionById(sessionId: string) {
    return prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
        project: true,
      },
    });
  }

  async createMessage(sessionId: string, data: CreateChatMessageInput) {
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        project: true,
      },
    });

    if (!session) {
      throw new Error("SESSION_NOT_FOUND");
    }

    if (session.projectId !== data.projectId) {
      throw new Error("PROJECT_SESSION_MISMATCH");
    }

    const message = await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: data.role,
        content: data.content,
      },
    });

    return message;
  }

  async listMessages(sessionId: string, projectId: string) {
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error("SESSION_NOT_FOUND");
    }

    if (session.projectId !== projectId) {
      throw new Error("PROJECT_SESSION_MISMATCH");
    }

    return prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    });
  }

  async closeSession(sessionId: string, projectId: string) {
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error("SESSION_NOT_FOUND");
    }

    if (session.projectId !== projectId) {
      throw new Error("PROJECT_SESSION_MISMATCH");
    }

    return prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        closedAt: new Date(),
      },
    });
  }
}
