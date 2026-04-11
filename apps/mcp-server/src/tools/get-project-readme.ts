import { z } from "zod";
import axios from "axios";
import { prisma } from "../lib/prisma.js";

export const getProjectReadmeInputSchema = z.object({
  projectId: z.string().min(1),
});

export async function getProjectReadme(input: unknown) {
  const { projectId } = getProjectReadmeInputSchema.parse(input);

  const integration = await prisma.gitlabIntegration.findFirst({
    where: { projectId },
  });

  if (!integration) {
    throw new Error("INTEGRATION_NOT_FOUND");
  }

  const encodedProject = encodeURIComponent(integration.projectPath);

  try {
    const treeResponse = await axios.get(
      `https://gitlab.com/api/v4/projects/${encodedProject}/repository/tree`,
      {
        headers: { "PRIVATE-TOKEN": integration.token },
        params: { ref: integration.branch, per_page: 100 },
      },
    );

    const files = treeResponse.data as Array<{
      name: string;
      path: string;
      type: string;
    }>;
    const readmeFile = files.find(
      (f) => f.type === "blob" && f.name.toLowerCase().startsWith("readme"),
    );

    if (!readmeFile) {
      return {
        projectId,
        found: false,
        content:
          "Nenhum ficheiro README foi encontrado na raiz do repositório.",
      };
    }

    const encodedFilePath = encodeURIComponent(readmeFile.path);

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
      found: true,
      fileName: readmeFile.name,
      content,
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return {
        projectId,
        found: false,
        content:
          "O repositório ou a ramificação especificada não foram encontrados no GitLab.",
      };
    }
    throw error;
  }
}
