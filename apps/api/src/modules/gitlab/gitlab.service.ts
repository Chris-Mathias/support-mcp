import axios from "axios";
import { prisma } from "../../lib/prisma.js";
import type { CreateGitlabIntegrationInput } from "./gitlab.schemas.js";

function encodeProjectPath(projectPath: string) {
  return encodeURIComponent(projectPath);
}

export class GitlabService {
  async createOrUpdateIntegration(
    projectId: string,
    data: CreateGitlabIntegrationInput,
  ) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error("PROJECT_NOT_FOUND");
    }

    await this.validateGitlabAccess(data);

    const existing = await prisma.gitlabIntegration.findFirst({
      where: { projectId },
    });

    if (existing) {
      return prisma.gitlabIntegration.update({
        where: { id: existing.id },
        data: {
          repoUrl: data.repoUrl,
          projectPath: data.projectPath,
          branch: data.branch,
          token: data.token,
        },
      });
    }

    return prisma.gitlabIntegration.create({
      data: {
        projectId,
        repoUrl: data.repoUrl,
        projectPath: data.projectPath,
        branch: data.branch,
        token: data.token,
      },
    });
  }

  async getIntegration(projectId: string) {
    return prisma.gitlabIntegration.findFirst({
      where: { projectId },
    });
  }

  async listFiles(projectId: string, path = "") {
    const integration = await this.getIntegration(projectId);

    if (!integration) {
      throw new Error("INTEGRATION_NOT_FOUND");
    }

    const encodedProject = encodeProjectPath(integration.projectPath);

    const response = await axios.get(
      `https://gitlab.com/api/v4/projects/${encodedProject}/repository/tree`,
      {
        headers: {
          "PRIVATE-TOKEN": integration.token,
        },
        params: {
          ref: integration.branch,
          path,
          per_page: 100,
        },
      },
    );

    return response.data;
  }

  async getFileContent(projectId: string, filePath: string) {
    const integration = await this.getIntegration(projectId);

    if (!integration) {
      throw new Error("INTEGRATION_NOT_FOUND");
    }

    const encodedProject = encodeProjectPath(integration.projectPath);
    const encodedFilePath = encodeURIComponent(filePath);

    const response = await axios.get(
      `https://gitlab.com/api/v4/projects/${encodedProject}/repository/files/${encodedFilePath}`,
      {
        headers: {
          "PRIVATE-TOKEN": integration.token,
        },
        params: {
          ref: integration.branch,
        },
      },
    );

    const file = response.data;

    return {
      ...file,
      decodedContent: Buffer.from(file.content, "base64").toString("utf-8"),
    };
  }

  private async validateGitlabAccess(data: CreateGitlabIntegrationInput) {
    const encodedProject = encodeProjectPath(data.projectPath);

    try {
      await axios.get(
        `https://gitlab.com/api/v4/projects/${encodedProject}/repository/tree`,
        {
          headers: {
            "PRIVATE-TOKEN": data.token,
          },
          params: {
            ref: data.branch,
            per_page: 1,
          },
        },
      );
    } catch {
      throw new Error("GITLAB_ACCESS_INVALID");
    }
  }
}
