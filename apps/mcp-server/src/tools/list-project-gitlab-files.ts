import { z } from "zod";
import axios from "axios";
import { prisma } from "../lib/prisma.js";

export const listProjectGitlabFilesInputSchema = z.object({
  projectId: z.string().min(1),
});

export async function listProjectGitlabFiles(input: unknown) {
  const { projectId } = listProjectGitlabFilesInputSchema.parse(input);

  const integration = await prisma.gitlabIntegration.findFirst({
    where: { projectId },
  });

  if (!integration) {
    throw new Error("INTEGRATION_NOT_FOUND");
  }

  const encodedProject = encodeURIComponent(integration.projectPath);

  const treeResponse = await axios.get(
    `https://gitlab.com/api/v4/projects/${encodedProject}/repository/tree`,
    {
      headers: { "PRIVATE-TOKEN": integration.token },
      params: { ref: integration.branch, recursive: true, per_page: 100 },
    },
  );

  const files = (treeResponse.data as Array<{ path: string; type: string }>)
    .filter((item) => item.type === "blob")
    .map((item) => item.path);

  return {
    projectId,
    total: files.length,
    files,
  };
}
