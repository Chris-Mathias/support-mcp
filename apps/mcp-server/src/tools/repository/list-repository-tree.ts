import { z } from "zod";
import axios from "axios";
import { prisma } from "../../lib/prisma.js";
import { decrypt } from "../../lib/crypto.js";

export const listRepositoryTreeInputSchema = z.object({
  projectId: z.string().min(1),
  path: z.string().trim().default(""),
  depth: z.number().int().min(1).max(5).default(2),
  includeFiles: z.boolean().default(true),
  includeDirectories: z.boolean().default(true),
});

type GitlabTreeItem = {
  id?: string;
  name: string;
  type: "tree" | "blob";
  path: string;
  mode?: string;
};

const MAX_PER_PAGE = 100;

function normalizePath(path?: string): string {
  if (!path) return "";
  return path.trim().replace(/^\/+|\/+$/g, "");
}

function getRelativePath(basePath: string, fullPath: string): string {
  if (!basePath) return fullPath;
  if (fullPath === basePath) return "";
  return fullPath.startsWith(`${basePath}/`)
    ? fullPath.slice(basePath.length + 1)
    : fullPath;
}

function getDepthFromRelativePath(relativePath: string): number {
  if (!relativePath) return 0;
  return relativePath.split("/").length;
}

async function fetchGitlabTreePage(params: {
  encodedProject: string;
  token: string;
  ref: string;
  page: number;
  path?: string;
  recursive?: boolean;
}) {
  const response = await axios.get<GitlabTreeItem[]>(
    `https://gitlab.com/api/v4/projects/${params.encodedProject}/repository/tree`,
    {
      headers: { "PRIVATE-TOKEN": params.token },
      params: {
        ref: params.ref,
        page: params.page,
        per_page: MAX_PER_PAGE,
        recursive: params.recursive ?? false,
        ...(params.path ? { path: params.path } : {}),
      },
    },
  );

  const nextPageHeader = response.headers["x-next-page"];
  const nextPage =
    typeof nextPageHeader === "string" && nextPageHeader.length > 0
      ? Number(nextPageHeader)
      : 0;

  return {
    items: response.data,
    nextPage,
  };
}

async function fetchAllGitlabTree(params: {
  encodedProject: string;
  token: string;
  ref: string;
  path?: string;
  recursive?: boolean;
}) {
  const allItems: GitlabTreeItem[] = [];
  let page = 1;

  while (page > 0) {
    const { items, nextPage } = await fetchGitlabTreePage({
      ...params,
      page,
    });

    allItems.push(...items);
    page = nextPage;
  }

  return allItems;
}

export async function listRepositoryTree(input: unknown) {
  const { projectId, path, depth, includeFiles, includeDirectories } =
    listRepositoryTreeInputSchema.parse(input);

  const integration = await prisma.gitlabIntegration.findFirst({
    where: { projectId },
  });

  if (!integration) {
    throw new Error("INTEGRATION_NOT_FOUND");
  }

  const token = decrypt(integration.token);
  const normalizedPath = normalizePath(path);
  const encodedProject = encodeURIComponent(integration.projectPath);

  try {
    const treeItems = await fetchAllGitlabTree({
      encodedProject,
      token,
      ref: integration.branch,
      path: normalizedPath || undefined,
      recursive: true,
    });

    const filteredItems = treeItems
      .filter((item) => {
        if (item.path === normalizedPath) return false;

        if (item.type === "blob" && !includeFiles) return false;
        if (item.type === "tree" && !includeDirectories) return false;

        const relativePath = getRelativePath(normalizedPath, item.path);
        const itemDepth = getDepthFromRelativePath(relativePath);

        return itemDepth <= depth;
      })
      .sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === "tree" ? -1 : 1;
        }
        return a.path.localeCompare(b.path);
      });

    const directories = filteredItems
      .filter((item) => item.type === "tree")
      .map((item) => ({
        name: item.name,
        path: item.path,
      }));

    const files = filteredItems
      .filter((item) => item.type === "blob")
      .map((item) => ({
        name: item.name,
        path: item.path,
      }));

    return {
      repository: {
        projectPath: integration.projectPath,
        branch: integration.branch,
      },
      scope: {
        path: normalizedPath || "/",
        depth,
        includeFiles,
        includeDirectories,
      },
      totals: {
        items: filteredItems.length,
        directories: directories.length,
        files: files.length,
      },
      items: filteredItems.map((item) => ({
        name: item.name,
        path: item.path,
        type: item.type,
        relativePath: getRelativePath(normalizedPath, item.path),
        depth: getDepthFromRelativePath(
          getRelativePath(normalizedPath, item.path),
        ),
      })),
      directories,
      files,
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return {
        found: false,
        error: "REPOSITORY_BRANCH_OR_PATH_NOT_FOUND",
        message:
          "O repositório, a ramificação ou o caminho especificado não foram encontrados no GitLab.",
      };
    }

    throw error;
  }
}
