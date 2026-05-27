import { z } from "zod";
import axios from "axios";
import { prisma } from "../../lib/prisma.js";
import { decrypt } from "../../lib/crypto.js";
import { gitlabApiBase } from "../../lib/gitlab-client.js";

export const readFullFileInputSchema = z.object({
  projectId: z.string().min(1),
  filePath: z.string().min(1),
});

type GitlabRepositoryFileResponse = {
  file_name: string;
  file_path: string;
  size: number;
  encoding: string;
  content: string;
  ref: string;
  blob_id?: string;
  commit_id?: string;
  last_commit_id?: string;
  content_sha256?: string;
};

const MAX_FULL_FILE_SIZE_BYTES = 500_000;

function encodeProjectPath(projectPath: string) {
  return encodeURIComponent(projectPath);
}

function normalizeLineBreaks(content: string) {
  return content.replace(/\r\n/g, "\n");
}

function estimateLanguageFromPath(filePath: string): string | null {
  const ext = filePath.split(".").pop()?.toLowerCase();

  if (!ext) return null;

  const map: Record<string, string> = {
    ts: "TypeScript",
    tsx: "TypeScript React",
    js: "JavaScript",
    jsx: "JavaScript React",
    mjs: "JavaScript",
    cjs: "JavaScript",
    py: "Python",
    java: "Java",
    kt: "Kotlin",
    kts: "Kotlin",
    go: "Go",
    rb: "Ruby",
    php: "PHP",
    cs: "C#",
    sql: "SQL",
    md: "Markdown",
    mdx: "MDX",
    yml: "YAML",
    yaml: "YAML",
    json: "JSON",
    xml: "XML",
    sh: "Shell",
    bash: "Shell",
    ps1: "PowerShell",
    tf: "Terraform",
    tfvars: "Terraform",
    rs: "Rust",
    swift: "Swift",
    scala: "Scala",
    dart: "Dart",
    html: "HTML",
    css: "CSS",
    scss: "SCSS",
    sass: "Sass",
    less: "Less",
    vue: "Vue",
    prisma: "Prisma",
    properties: "Properties",
    gradle: "Gradle",
    toml: "TOML",
    lock: "Lockfile",
  };

  return map[ext] ?? null;
}

function countLines(content: string): number {
  if (!content) return 0;
  return content.split("\n").length;
}

function classifyFileKind(filePath: string): string {
  const lower = filePath.toLowerCase();

  if (
    lower.endsWith(".md") ||
    lower.endsWith(".mdx") ||
    lower.endsWith(".rst") ||
    lower.includes("/docs/")
  ) {
    return "documentation";
  }

  if (
    lower.endsWith(".sql") ||
    lower.includes("/migrations/") ||
    lower.includes("/database/migrations/") ||
    lower.includes("/db/migrate/") ||
    lower.includes("/prisma/migrations/")
  ) {
    return "database";
  }

  if (
    lower.endsWith(".yml") ||
    lower.endsWith(".yaml") ||
    lower.endsWith(".json") ||
    lower.endsWith(".toml") ||
    lower.endsWith(".env") ||
    lower.endsWith(".properties") ||
    lower.endsWith(".conf") ||
    lower.endsWith("dockerfile")
  ) {
    return "configuration";
  }

  if (
    lower.endsWith(".sh") ||
    lower.endsWith(".ps1") ||
    lower.includes("/scripts/")
  ) {
    return "script";
  }

  return "source_code";
}

export async function readFullFile(input: unknown) {
  const { projectId, filePath } = readFullFileInputSchema.parse(input);

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
        headers: { "PRIVATE-TOKEN": token },
        params: { ref: integration.branch },
      },
    );

    const decodedContent = Buffer.from(
      fileResponse.data.content,
      "base64",
    ).toString("utf-8");

    const content = normalizeLineBreaks(decodedContent);
    const lineCount = countLines(content);

    if (fileResponse.data.size > MAX_FULL_FILE_SIZE_BYTES) {
      return {
        repository: {
          projectPath: integration.projectPath,
          branch: integration.branch,
        },
        filePath,
        found: true,
        truncated: false,
        tooLarge: true,
        message:
          "O arquivo é grande demais para leitura integral por esta tool. Prefira read_file_excerpt para inspeção localizada.",
        metadata: {
          fileName: fileResponse.data.file_name,
          sizeBytes: fileResponse.data.size,
          lineCount,
          language: estimateLanguageFromPath(filePath),
          kind: classifyFileKind(filePath),
          ref: fileResponse.data.ref,
          blobId: fileResponse.data.blob_id ?? null,
          commitId: fileResponse.data.commit_id ?? null,
          lastCommitId: fileResponse.data.last_commit_id ?? null,
          sha256: fileResponse.data.content_sha256 ?? null,
        },
        content: null,
      };
    }

    return {
      repository: {
        projectPath: integration.projectPath,
        branch: integration.branch,
      },
      filePath,
      found: true,
      truncated: false,
      tooLarge: false,
      metadata: {
        fileName: fileResponse.data.file_name,
        sizeBytes: fileResponse.data.size,
        lineCount,
        language: estimateLanguageFromPath(filePath),
        kind: classifyFileKind(filePath),
        ref: fileResponse.data.ref,
        blobId: fileResponse.data.blob_id ?? null,
        commitId: fileResponse.data.commit_id ?? null,
        lastCommitId: fileResponse.data.last_commit_id ?? null,
        sha256: fileResponse.data.content_sha256 ?? null,
      },
      content,
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return {
        filePath,
        found: false,
        error: "FILE_OR_BRANCH_NOT_FOUND",
        message:
          "O arquivo ou a ramificação especificada não foram encontrados no GitLab.",
      };
    }

    throw error;
  }
}
