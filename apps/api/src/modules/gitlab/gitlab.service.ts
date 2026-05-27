import axios from "axios";
import { prisma } from "../../lib/prisma.js";
import { encrypt, decrypt } from "../../lib/crypto.js";
import type { CreateGitlabIntegrationInput } from "./gitlab.schemas.js";
import type { GitlabIntegration } from "@prisma/client";

type SafeGitlabIntegration = Omit<GitlabIntegration, "token"> & {
  tokenConfigured: boolean;
};

function encodeProjectPath(projectPath: string) {
  return encodeURIComponent(projectPath);
}

function gitlabApiBase(repoUrl: string): string {
  const u = new URL(repoUrl);
  return `${u.protocol}//${u.host}/api/v4`;
}

function toSafe(row: GitlabIntegration): SafeGitlabIntegration {
  const { token: _token, ...rest } = row;
  return { ...rest, tokenConfigured: !!_token };
}

export class GitlabService {
  async createOrUpdateIntegration(
    projectId: string,
    data: CreateGitlabIntegrationInput,
  ): Promise<SafeGitlabIntegration> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error("PROJECT_NOT_FOUND");
    }

    const existing = await prisma.gitlabIntegration.findFirst({
      where: { projectId },
    });

    if (!data.token && !existing) {
      throw new Error("TOKEN_REQUIRED");
    }

    let encryptedToken: string | undefined;

    if (data.token) {
      await this.validateGitlabAccess({ ...data, token: data.token });
      encryptedToken = encrypt(data.token);
    }

    if (existing) {
      const updated = await prisma.gitlabIntegration.update({
        where: { id: existing.id },
        data: {
          repoUrl: data.repoUrl,
          projectPath: data.projectPath,
          branch: data.branch,
          ...(encryptedToken ? { token: encryptedToken } : {}),
        },
      });
      return toSafe(updated);
    }

    const created = await prisma.gitlabIntegration.create({
      data: {
        projectId,
        repoUrl: data.repoUrl,
        projectPath: data.projectPath,
        branch: data.branch,
        token: encryptedToken!,
      },
    });
    return toSafe(created);
  }

  async getIntegration(projectId: string): Promise<SafeGitlabIntegration | null> {
    const row = await prisma.gitlabIntegration.findFirst({
      where: { projectId },
    });

    if (!row) return null;
    return toSafe(row);
  }

  async listFiles(projectId: string, path = "") {
    const integration = await this.getIntegrationWithToken(projectId);
    const encodedProject = encodeProjectPath(integration.projectPath);

    const response = await axios.get(
      `${gitlabApiBase(integration.repoUrl)}/projects/${encodedProject}/repository/tree`,
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
    const integration = await this.getIntegrationWithToken(projectId);
    const encodedProject = encodeProjectPath(integration.projectPath);
    const encodedFilePath = encodeURIComponent(filePath);

    const response = await axios.get(
      `${gitlabApiBase(integration.repoUrl)}/projects/${encodedProject}/repository/files/${encodedFilePath}`,
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

  private async getIntegrationWithToken(projectId: string) {
    const row = await prisma.gitlabIntegration.findFirst({
      where: { projectId },
    });

    if (!row) {
      throw new Error("INTEGRATION_NOT_FOUND");
    }

    let token: string;

    try {
      token = decrypt(row.token);
    } catch {
      throw new Error("INTEGRATION_TOKEN_INVALID");
    }

    return { ...row, token };
  }

  private async validateGitlabAccess(data: {
    repoUrl: string;
    projectPath: string;
    branch: string;
    token: string;
  }) {
    const encodedProject = encodeProjectPath(data.projectPath);

    try {
      await axios.get(
        `${gitlabApiBase(data.repoUrl)}/projects/${encodedProject}/repository/tree`,
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
