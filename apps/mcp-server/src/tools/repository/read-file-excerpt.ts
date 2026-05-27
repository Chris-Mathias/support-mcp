import { z } from "zod";
import axios from "axios";
import { prisma } from "../../lib/prisma.js";
import { decrypt } from "../../lib/crypto.js";
import { gitlabApiBase } from "../../lib/gitlab-client.js";

export const readFileExcerptInputSchema = z
  .object({
    projectId: z.string().min(1),
    filePath: z.string().min(1),

    query: z.string().default(""),

    startLine: z.number().int().min(0).default(0),
    endLine: z.number().int().min(0).default(0),

    anchorLine: z.number().int().min(0).default(0),
    before: z.number().int().min(0).max(200).default(20),
    after: z.number().int().min(0).max(200).default(40),
  })
  .transform((data) => ({
    ...data,
    query: data.query.trim() || undefined,
    startLine: data.startLine > 0 ? data.startLine : undefined,
    endLine: data.endLine > 0 ? data.endLine : undefined,
    anchorLine: data.anchorLine > 0 ? data.anchorLine : undefined,
  }))
  .superRefine((data, ctx) => {
    const hasExplicitRange =
      typeof data.startLine === "number" || typeof data.endLine === "number";
    const hasAnchor = typeof data.anchorLine === "number";
    const hasQuery = typeof data.query === "string" && data.query.length > 0;

    if (!hasExplicitRange && !hasAnchor && !hasQuery) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Informe query, startLine/endLine ou anchorLine para ler um trecho do arquivo.",
        path: ["query"],
      });
    }

    if (
      (typeof data.startLine === "number" &&
        typeof data.endLine !== "number") ||
      (typeof data.endLine === "number" && typeof data.startLine !== "number")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "startLine e endLine devem ser informados juntos.",
        path: ["startLine"],
      });
    }

    if (
      typeof data.startLine === "number" &&
      typeof data.endLine === "number" &&
      data.endLine < data.startLine
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endLine deve ser maior ou igual a startLine.",
        path: ["endLine"],
      });
    }
  });

type GitlabRepositoryFileResponse = {
  file_name: string;
  file_path: string;
  size: number;
  encoding: string;
  content: string;
  ref: string;
};

const MAX_EXCERPT_LINES = 250;

function encodeProjectPath(projectPath: string) {
  return encodeURIComponent(projectPath);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeLineBreaks(content: string) {
  return content.replace(/\r\n/g, "\n");
}

function findFirstMatchingLine(lines: string[], query: string): number | null {
  const normalizedQuery = query.toLowerCase();

  for (let index = 0; index < lines.length; index++) {
    if (lines[index].toLowerCase().includes(normalizedQuery)) {
      return index + 1;
    }
  }

  return null;
}

function buildLineExcerpt(params: {
  lines: string[];
  startLine: number;
  endLine: number;
}) {
  const { lines, startLine, endLine } = params;

  const excerptLines: string[] = [];
  for (let lineNumber = startLine; lineNumber <= endLine; lineNumber++) {
    const content = lines[lineNumber - 1] ?? "";
    excerptLines.push(`${lineNumber.toString().padStart(4, " ")} | ${content}`);
  }

  return excerptLines.join("\n");
}

function resolveExcerptRange(params: {
  totalLines: number;
  startLine?: number;
  endLine?: number;
  anchorLine?: number;
  before: number;
  after: number;
  matchedLine?: number | null;
}) {
  const {
    totalLines,
    startLine,
    endLine,
    anchorLine,
    before,
    after,
    matchedLine,
  } = params;

  if (typeof startLine === "number" && typeof endLine === "number") {
    const safeStart = clamp(startLine, 1, totalLines);
    const safeEnd = clamp(endLine, safeStart, totalLines);

    if (safeEnd - safeStart + 1 > MAX_EXCERPT_LINES) {
      return {
        startLine: safeStart,
        endLine: safeStart + MAX_EXCERPT_LINES - 1,
        wasClamped: true,
        strategy: "explicit_range" as const,
      };
    }

    return {
      startLine: safeStart,
      endLine: safeEnd,
      wasClamped: false,
      strategy: "explicit_range" as const,
    };
  }

  const centerLine =
    typeof anchorLine === "number"
      ? anchorLine
      : typeof matchedLine === "number"
        ? matchedLine
        : 1;

  const safeCenter = clamp(centerLine, 1, totalLines);
  let safeStart = clamp(safeCenter - before, 1, totalLines);
  let safeEnd = clamp(safeCenter + after, safeStart, totalLines);

  if (safeEnd - safeStart + 1 > MAX_EXCERPT_LINES) {
    safeEnd = safeStart + MAX_EXCERPT_LINES - 1;
    safeEnd = clamp(safeEnd, safeStart, totalLines);
  }

  return {
    startLine: safeStart,
    endLine: safeEnd,
    wasClamped: false,
    strategy:
      typeof anchorLine === "number"
        ? ("anchor_line" as const)
        : ("query_match" as const),
  };
}

export async function readFileExcerpt(input: unknown) {
  const {
    projectId,
    filePath,
    query,
    startLine,
    endLine,
    anchorLine,
    before,
    after,
  } = readFileExcerptInputSchema.parse(input);

  const integration = await prisma.gitlabIntegration.findFirst({
    where: { projectId },
  });

  if (!integration) {
    throw new Error("INTEGRATION_NOT_FOUND");
  }

  const token = decrypt(integration.token);
  const encodedProject = encodeProjectPath(integration.projectPath);
  const encodedFilePath = encodeURIComponent(filePath);

  try {
    const fileResponse = await axios.get<GitlabRepositoryFileResponse>(
      `${gitlabApiBase(integration.repoUrl)}/projects/${encodedProject}/repository/files/${encodedFilePath}`,
      {
        headers: {
          "PRIVATE-TOKEN": token,
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

    const normalizedContent = normalizeLineBreaks(decodedContent);
    const lines = normalizedContent.split("\n");
    const totalLines = lines.length;

    const matchedLine =
      query && query.trim().length > 0
        ? findFirstMatchingLine(lines, query)
        : null;

    const range = resolveExcerptRange({
      totalLines,
      startLine,
      endLine,
      anchorLine,
      before,
      after,
      matchedLine,
    });

    const excerpt = buildLineExcerpt({
      lines,
      startLine: range.startLine,
      endLine: range.endLine,
    });

    return {
      repository: {
        projectPath: integration.projectPath,
        branch: integration.branch,
      },
      filePath,
      fileSize: fileResponse.data.size,
      totalLines,
      request: {
        query: query ?? null,
        startLine: startLine ?? null,
        endLine: endLine ?? null,
        anchorLine: anchorLine ?? null,
        before,
        after,
      },
      resolution: {
        strategy: range.strategy,
        matchedLine,
        excerptStartLine: range.startLine,
        excerptEndLine: range.endLine,
        lineCount: range.endLine - range.startLine + 1,
        wasClamped: range.wasClamped,
      },
      excerpt,
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return {
        found: false,
        error: "FILE_OR_BRANCH_NOT_FOUND",
        message:
          "O arquivo ou a ramificação especificada não foram encontrados no GitLab.",
      };
    }

    throw error;
  }
}
