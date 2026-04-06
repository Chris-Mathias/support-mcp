import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import type { CreateProjectInput } from "./project.schemas.js";

export class ProjectService {
  async create(data: CreateProjectInput) {
    return prisma.project.create({
      data: {
        projectId: randomUUID(),
        name: data.name,
        description: data.description,
      },
    });
  }

  async list() {
    return prisma.project.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async getById(id: string) {
    return prisma.project.findUnique({
      where: { id },
    });
  }
}
