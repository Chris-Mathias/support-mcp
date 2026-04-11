import { z } from "zod";
import axios from "axios";
import { prisma } from "../lib/prisma.js";
import { buildExcerpt } from "../lib/excerpt.js";

export const getGitlabFileExcerptInputSchema = z.object({
  projectId: z.string().min(1),
  filePath: z.string().min(1),
  query: z.string().min(1),
});

function encodeProjectPath(projectPath: string) {
  return encodeURIComponent(projectPath);
}

export async function getGitlabFileExcerpt(input: unknown) {
  const { projectId, filePath, query } =
    getGitlabFileExcerptInputSchema.parse(input);

  const integration = await prisma.gitlabIntegration.findFirst({
    where: { projectId },
  });

  if (!integration) {
    throw new Error("INTEGRATION_NOT_FOUND");
  }

  const encodedProject = encodeProjectPath(integration.projectPath);
  const encodedFilePath = encodeURIComponent(filePath);

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

  const excerpt = buildExcerpt(decodedContent, query, 300);

  return {
    projectId,
    filePath,
    query,
    excerpt,
  };
}
