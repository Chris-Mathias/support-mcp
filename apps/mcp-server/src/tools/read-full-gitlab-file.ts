import { z } from "zod";
import axios from "axios";
import { prisma } from "../lib/prisma.js";

export const readFullGitlabFileInputSchema = z.object({
  projectId: z.string().min(1),
  filePath: z.string().min(1),
});

export async function readFullGitlabFile(input: unknown) {
  const { projectId, filePath } = readFullGitlabFileInputSchema.parse(input);

  const integration = await prisma.gitlabIntegration.findFirst({
    where: { projectId },
  });

  if (!integration) {
    throw new Error("INTEGRATION_NOT_FOUND");
  }

  const encodedProject = encodeURIComponent(integration.projectPath);
  const encodedFilePath = encodeURIComponent(filePath);

  const fileResponse = await axios.get(
    `https://gitlab.com/api/v4/projects/${encodedProject}/repository/files/${encodedFilePath}`,
    {
      headers: { "PRIVATE-TOKEN": integration.token },
      params: { ref: integration.branch },
    },
  );

  const content = Buffer.from(fileResponse.data.content, "base64").toString(
    "utf-8",
  );

  return {
    projectId,
    filePath,
    content,
  };
}
