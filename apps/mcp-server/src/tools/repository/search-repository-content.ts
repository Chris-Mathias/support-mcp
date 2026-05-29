import { z } from "zod";
import axios from "axios";
import { prisma } from "../../lib/prisma.js";
import { decrypt } from "../../lib/crypto.js";
import { gitlabApiBase } from "../../lib/gitlab-client.js";

export const searchRepositoryContentInputSchema = z.object({
  projectId: z.string().min(1),
  query: z.string().min(1),
  pathPrefix: z.string().trim().default(""),
  fileGlobs: z.array(z.string().min(1)).max(20).default([]),
  maxResults: z.number().int().min(1).max(20).default(5),
});

type GitlabBlobSearchResult = {
  basename: string;
  data: string;
  path: string;
  filename: string;
  ref: string;
  startline: number;
  project_id: number;
};

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

async function searchGitlabBlobs(params: {
  baseUrl: string;
  encodedProject: string;
  token: string;
  ref: string;
  query: string;
  maxPages?: number;
}): Promise<GitlabBlobSearchResult[]> {
  const maxPages = params.maxPages ?? 3;
  const allResults: GitlabBlobSearchResult[] = [];
  let page = 1;

  while (page > 0 && page <= maxPages) {
    const response = await axios.get<GitlabBlobSearchResult[]>(
      `${params.baseUrl}/projects/${params.encodedProject}/search`,
      {
        headers: { "PRIVATE-TOKEN": params.token },
        params: {
          scope: "blobs",
          search: params.query,
          ref: params.ref,
          per_page: 20,
          page,
        },
      },
    );

    allResults.push(...response.data);

    const nextPageHeader = response.headers["x-next-page"];
    page =
      typeof nextPageHeader === "string" && nextPageHeader.length > 0
        ? Number(nextPageHeader)
        : 0;
  }

  return allResults;
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
    const rawResults = await searchGitlabBlobs({
      baseUrl,
      encodedProject,
      token,
      ref: integration.branch,
      query,
      maxPages: 3,
    });

    const byFile = new Map<
      string,
      { occurrences: number; lineMatches: number[]; excerpt: string }
    >();

    for (const r of rawResults) {
      const entry = byFile.get(r.path);
      if (entry) {
        entry.occurrences++;
        if (entry.lineMatches.length < 3) entry.lineMatches.push(r.startline);
      } else {
        byFile.set(r.path, {
          occurrences: 1,
          lineMatches: [r.startline],
          excerpt: r.data.trim(),
        });
      }
    }

    const filtered = [...byFile.entries()]
      .filter(([path]) => isTextFile(path))
      .filter(([path]) =>
        normalizedPathPrefix
          ? path.startsWith(`${normalizedPathPrefix}/`) ||
            path === normalizedPathPrefix
          : true,
      )
      .filter(([path]) => matchesAnyGlob(path, fileGlobs));

    const scored = filtered.map(([filePath, data]) => {
      let score = data.occurrences * 10;
      if (PRIORITY_PATH_PATTERNS.some((p) => p.test(filePath))) score += 10;
      if (
        normalizedPathPrefix &&
        filePath.toLowerCase().startsWith(normalizedPathPrefix.toLowerCase())
      )
        score += 15;
      return { filePath, score, ...data };
    });

    scored.sort(
      (a, b) =>
        b.score - a.score ||
        b.occurrences - a.occurrences ||
        a.filePath.localeCompare(b.filePath),
    );

    const topResults = scored.slice(0, maxResults);

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
        matchedFiles: byFile.size,
        filteredFiles: filtered.length,
        returnedResults: topResults.length,
      },
      results: topResults.map((result) => ({
        filePath: result.filePath,
        score: result.score,
        occurrences: result.occurrences,
        lineMatches: result.lineMatches,
        fileSize: null,
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
