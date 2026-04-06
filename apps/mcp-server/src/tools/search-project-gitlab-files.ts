import { z } from "zod";
import axios from "axios";
import { prisma } from "../lib/prisma.js";
import { buildExcerpt } from "../lib/excerpt.js";

const inputSchema = z.object({
  projectId: z.string().min(1),
  query: z.string().min(1),
});

function encodeProjectPath(projectPath: string) {
  return encodeURIComponent(projectPath);
}

function isTextFile(path: string) {
  return /\.(ts|tsx|js|jsx|json|md|sql|env|yml|yaml)$/i.test(path);
}

export async function searchProjectGitlabFiles(input: unknown) {
  const { projectId, query } = inputSchema.parse(input);

  const integration = await prisma.gitlabIntegration.findFirst({
    where: { projectId },
  });

  if (!integration) {
    throw new Error("INTEGRATION_NOT_FOUND");
  }

  const encodedProject = encodeProjectPath(integration.projectPath);

  const treeResponse = await axios.get(
    `https://gitlab.com/api/v4/projects/${encodedProject}/repository/tree`,
    {
      headers: {
        "PRIVATE-TOKEN": integration.token,
      },
      params: {
        ref: integration.branch,
        recursive: true,
        per_page: 100,
      },
    },
  );

  const files = (treeResponse.data as Array<{ path: string; type: string }>)
    .filter((item) => item.type === "blob")
    .filter((item) => isTextFile(item.path))
    .slice(0, 30);

  const results: Array<{
    filePath: string;
    score: number;
    excerpt: string;
  }> = [];

  for (const file of files) {
    try {
      const encodedFilePath = encodeURIComponent(file.path);

      const fileResponse = await axios.get(
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

      const decodedContent = Buffer.from(
        fileResponse.data.content,
        "base64",
      ).toString("utf-8");

      const occurrences =
        decodedContent.toLowerCase().split(query.toLowerCase()).length - 1;

      if (occurrences > 0) {
        results.push({
          filePath: file.path,
          score: occurrences,
          excerpt: buildExcerpt(decodedContent, query),
        });
      }
    } catch {
      // MVP: ignora falha de leitura pontual
    }
  }

  results.sort((a, b) => b.score - a.score);

  return {
    projectId,
    query,
    total: results.length,
    results: results.slice(0, 5),
  };
}
