import { z } from "zod";
import axios from "axios";
import { prisma } from "../../lib/prisma.js";
import { buildExcerpt } from "../../lib/excerpt.js";
import { decrypt } from "../../lib/crypto.js";
import { gitlabApiBase } from "../../lib/gitlab-client.js";

export const searchRepositoryContentInputSchema = z.object({
  projectId: z.string().min(1),
  query: z.string().min(1),
  pathPrefix: z.string().trim().default(""),
  fileGlobs: z.array(z.string().min(1)).max(20).default([]),
  maxResults: z.number().int().min(1).max(20).default(5),
});

type GitlabTreeItem = {
  id?: string;
  name: string;
  type: "tree" | "blob";
  path: string;
  mode?: string;
};

type GitlabRepositoryFileResponse = {
  file_name: string;
  file_path: string;
  size: number;
  encoding: string;
  content: string;
  ref: string;
};

const MAX_PER_PAGE = 100;
const MAX_FILE_SIZE_BYTES = 300_000;

const BINARY_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "bmp",
  "webp",
  "ico",
  "mp4",
  "mp3",
  "wav",
  "ogg",
  "avi",
  "mov",
  "zip",
  "tar",
  "gz",
  "rar",
  "7z",
  "exe",
  "dll",
  "so",
  "bin",
  "pdf",
  "woff",
  "woff2",
  "ttf",
  "eot",
  "otf",
  "class",
  "jar",
  "war",
  "psd",
  "ai",
  "sketch",
  "sqlite",
  "db",
  "ico",
]);

const PRIORITY_PATH_PATTERNS: RegExp[] = [
  /(^|\/)src\//i,
  /(^|\/)app\//i,
  /(^|\/)apps\//i,
  /(^|\/)services\//i,
  /(^|\/)modules\//i,
  /(^|\/)packages\//i,
  /(^|\/)libs\//i,
  /(^|\/)api\//i,
  /(^|\/)config\//i,
  /(^|\/)db\//i,
  /(^|\/)database\//i,
  /(^|\/)migrations\//i,
];

function normalizePath(path?: string): string | undefined {
  if (!path) return undefined;
  const normalized = path.trim().replace(/^\/+|\/+$/g, "");
  return normalized.length > 0 ? normalized : undefined;
}

function encodeProjectPath(projectPath: string) {
  return encodeURIComponent(projectPath);
}

function isTextFile(path: string) {
  const ext = path.split(".").pop()?.toLowerCase();
  if (!ext) return false;
  return !BINARY_EXTENSIONS.has(ext);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .trim()
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");

  return new RegExp(`^${escaped}$`, "i");
}

function matchesAnyGlob(path: string, globs?: string[]) {
  if (!globs || globs.length === 0) return true;
  return globs.some((glob) => globToRegExp(glob).test(path));
}

function countOccurrences(content: string, query: string) {
  const regex = new RegExp(escapeRegExp(query), "gi");
  const matches = content.match(regex);
  return matches ? matches.length : 0;
}

function findLineNumbers(content: string, query: string, limit = 3): number[] {
  const queryLower = query.toLowerCase();
  const lines = content.split(/\r?\n/);
  const matches: number[] = [];

  for (let index = 0; index < lines.length; index++) {
    if (lines[index].toLowerCase().includes(queryLower)) {
      matches.push(index + 1);
      if (matches.length >= limit) break;
    }
  }

  return matches;
}

function estimateRelevanceScore(params: {
  path: string;
  content: string;
  query: string;
  occurrences: number;
  pathPrefix?: string;
}) {
  const { path, content, query, occurrences, pathPrefix } = params;

  let score = 0;
  const lowerPath = path.toLowerCase();
  const lowerQuery = query.toLowerCase();

  score += occurrences * 10;

  if (lowerPath.includes(lowerQuery)) score += 25;
  if (PRIORITY_PATH_PATTERNS.some((pattern) => pattern.test(path))) score += 10;
  if (pathPrefix && lowerPath.startsWith(pathPrefix.toLowerCase())) score += 15;

  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes(lowerQuery)) {
      const trimmed = line.trim();
      if (
        trimmed.startsWith("class ") ||
        trimmed.startsWith("function ") ||
        trimmed.startsWith("def ") ||
        trimmed.startsWith("export ") ||
        trimmed.startsWith("interface ") ||
        trimmed.startsWith("type ") ||
        trimmed.startsWith("const ") ||
        trimmed.startsWith("router.") ||
        trimmed.startsWith("@")
      ) {
        score += 8;
      }
    }
  }

  return score;
}

async function fetchGitlabTreePage(params: {
  baseUrl: string;
  encodedProject: string;
  token: string;
  ref: string;
  page: number;
  recursive?: boolean;
}) {
  const response = await axios.get<GitlabTreeItem[]>(
    `${params.baseUrl}/projects/${params.encodedProject}/repository/tree`,
    {
      headers: {
        "PRIVATE-TOKEN": params.token,
      },
      params: {
        ref: params.ref,
        recursive: params.recursive ?? true,
        per_page: MAX_PER_PAGE,
        page: params.page,
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
  baseUrl: string;
  encodedProject: string;
  token: string;
  ref: string;
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

async function readGitlabFile(params: {
  baseUrl: string;
  encodedProject: string;
  token: string;
  ref: string;
  filePath: string;
}) {
  const encodedFilePath = encodeURIComponent(params.filePath);

  const response = await axios.get<GitlabRepositoryFileResponse>(
    `${params.baseUrl}/projects/${params.encodedProject}/repository/files/${encodedFilePath}`,
    {
      headers: {
        "PRIVATE-TOKEN": params.token,
      },
      params: {
        ref: params.ref,
      },
    },
  );

  return {
    size: response.data.size,
    content: Buffer.from(response.data.content, "base64").toString("utf-8"),
  };
}

export async function searchRepositoryContent(input: unknown) {
  const { projectId, query, pathPrefix, fileGlobs, maxResults } =
    searchRepositoryContentInputSchema.parse(input);

  const integration = await prisma.gitlabIntegration.findFirst({
    where: { projectId },
  });

  if (!integration) {
    throw new Error("INTEGRATION_NOT_FOUND");
  }

  const token = decrypt(integration.token);
  const normalizedPathPrefix = normalizePath(pathPrefix);
  const encodedProject = encodeProjectPath(integration.projectPath);
  const baseUrl = gitlabApiBase(integration.repoUrl);

  try {
    const treeItems = await fetchAllGitlabTree({
      baseUrl,
      encodedProject,
      token,
      ref: integration.branch,
      recursive: true,
    });

    const candidateFiles = treeItems
      .filter((item) => item.type === "blob")
      .map((item) => item.path)
      .filter((path) => isTextFile(path))
      .filter((path) =>
        normalizedPathPrefix
          ? path.startsWith(`${normalizedPathPrefix}/`) ||
            path === normalizedPathPrefix
          : true,
      )
      .filter((path) => matchesAnyGlob(path, fileGlobs))
      .sort((a, b) => {
        const aPriority = PRIORITY_PATH_PATTERNS.some((pattern) =>
          pattern.test(a),
        )
          ? 1
          : 0;
        const bPriority = PRIORITY_PATH_PATTERNS.some((pattern) =>
          pattern.test(b),
        )
          ? 1
          : 0;
        return bPriority - aPriority || a.localeCompare(b);
      });

    const results: Array<{
      filePath: string;
      score: number;
      occurrences: number;
      excerpt: string;
      lineMatches: number[];
      fileSize: number;
    }> = [];

    for (const filePath of candidateFiles) {
      try {
        const { size, content } = await readGitlabFile({
          baseUrl,
          encodedProject,
          token,
          ref: integration.branch,
          filePath,
        });

        if (size > MAX_FILE_SIZE_BYTES) {
          continue;
        }

        const occurrences = countOccurrences(content, query);

        if (occurrences <= 0) {
          continue;
        }

        const lineMatches = findLineNumbers(content, query);
        const score = estimateRelevanceScore({
          path: filePath,
          content,
          query,
          occurrences,
          pathPrefix: normalizedPathPrefix,
        });

        results.push({
          filePath,
          score,
          occurrences,
          excerpt: buildExcerpt(content, query),
          lineMatches,
          fileSize: size,
        });
      } catch {
        // Ignora arquivos inacessíveis ou não decodificáveis
      }
    }

    results.sort((a, b) => {
      return (
        b.score - a.score ||
        b.occurrences - a.occurrences ||
        a.filePath.localeCompare(b.filePath)
      );
    });

    const topResults = results.slice(0, maxResults);

    return {
      repository: {
        projectPath: integration.projectPath,
        branch: integration.branch,
      },
      query,
      filters: {
        pathPrefix: normalizedPathPrefix ?? null,
        fileGlobs: fileGlobs ?? [],
      },
      totals: {
        candidateFiles: candidateFiles.length,
        matchedFiles: results.length,
        returnedResults: topResults.length,
      },
      results: topResults.map((result) => ({
        filePath: result.filePath,
        score: result.score,
        occurrences: result.occurrences,
        lineMatches: result.lineMatches,
        fileSize: result.fileSize,
        excerpt: result.excerpt,
      })),
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return {
        found: false,
        error: "REPOSITORY_OR_BRANCH_NOT_FOUND",
        message:
          "O repositório ou a ramificação especificada não foram encontrados no GitLab.",
      };
    }

    throw error;
  }
}
