import { z } from "zod";
import axios from "axios";
import { prisma } from "../../lib/prisma.js";
import { decrypt } from "../../lib/crypto.js";
import { gitlabApiBase } from "../../lib/gitlab-client.js";

export const getRepositoryOverviewInputSchema = z.object({
  projectId: z.string().min(1),
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
  content_sha256?: string;
  ref: string;
  blob_id?: string;
  commit_id?: string;
  last_commit_id?: string;
};

const MAX_TREE_PAGE_SIZE = 100;
const MAX_README_PREVIEW_CHARS = 4000;
const MAX_TOP_LANGUAGES = 8;
const MAX_CENTRAL_DIRECTORIES = 12;
const MAX_IMPORTANT_FILES = 25;
const MAX_ENTRYPOINTS = 20;

const IGNORED_TOP_LEVEL_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".git",
  ".husky",
  ".idea",
  ".vscode",
  "tmp",
  "temp",
  "vendor",
  "target",
  "out",
  ".next",
  ".nuxt",
]);

const IMPORTANT_ROOT_FILES = new Set([
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "tsconfig.json",
  "turbo.json",
  "nx.json",
  "lerna.json",
  "docker-compose.yml",
  "docker-compose.yaml",
  "Dockerfile",
  ".gitlab-ci.yml",
  ".env.example",
  ".nvmrc",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "gradle.properties",
  "settings.gradle",
  "settings.gradle.kts",
  "composer.json",
  "Gemfile",
  "requirements.txt",
  "pyproject.toml",
  "go.mod",
  "Cargo.toml",
  "Makefile",
  "Procfile",
  "README.md",
  "README.rst",
  "README.txt",
]);

const IMPORTANT_FILE_PATTERNS: RegExp[] = [
  /(^|\/)\.gitlab-ci\.yml$/i,
  /(^|\/)docker-compose\.ya?ml$/i,
  /(^|\/)Dockerfile$/i,
  /(^|\/)package\.json$/i,
  /(^|\/)pom\.xml$/i,
  /(^|\/)build\.gradle(\.kts)?$/i,
  /(^|\/)requirements\.txt$/i,
  /(^|\/)pyproject\.toml$/i,
  /(^|\/)go\.mod$/i,
  /(^|\/)Cargo\.toml$/i,
  /(^|\/)composer\.json$/i,
  /(^|\/)Gemfile$/i,
  /(^|\/)application\.(ya?ml|properties)$/i,
  /(^|\/)nginx\.conf$/i,
  /(^|\/)serverless\.ya?ml$/i,
  /(^|\/)openapi\.(ya?ml|json)$/i,
  /(^|\/)swagger\.(ya?ml|json)$/i,
  /(^|\/)schema\.sql$/i,
];

const ENTRYPOINT_PATTERNS: RegExp[] = [
  /(^|\/)main\.(ts|js|tsx|jsx|py|java|kt|go|rb|php)$/i,
  /(^|\/)index\.(ts|js|tsx|jsx)$/i,
  /(^|\/)app\.(ts|js|tsx|jsx|py)$/i,
  /(^|\/)server\.(ts|js|tsx|jsx|py|go)$/i,
  /(^|\/)bootstrap\.(ts|js|php)$/i,
  /(^|\/)Program\.cs$/i,
  /(^|\/)startup\.(ts|js|cs)$/i,
  /(^|\/)manage\.py$/i,
  /(^|\/)wsgi\.py$/i,
  /(^|\/)asgi\.py$/i,
  /(^|\/)cmd\/[^/]+\/main\.go$/i,
  /(^|\/)src\/main\.(ts|js|tsx|jsx)$/i,
  /(^|\/)src\/index\.(ts|js|tsx|jsx)$/i,
  /(^|\/)src\/main\/java\/.+Application\.java$/i,
  /(^|\/)src\/main\/kotlin\/.+Application\.kt$/i,
];

const MIGRATION_PATTERNS: RegExp[] = [
  /(^|\/)migrations?\//i,
  /(^|\/)db\/migrate\//i,
  /(^|\/)database\/migrations\//i,
  /(^|\/)prisma\/migrations\//i,
  /(^|\/)flyway\//i,
  /(^|\/)liquibase\//i,
];

const DOC_PATTERNS: RegExp[] = [
  /\.md$/i,
  /\.mdx$/i,
  /\.rst$/i,
  /(^|\/)docs\//i,
];

const SCRIPT_PATTERNS: RegExp[] = [
  /(^|\/)scripts\//i,
  /\.sh$/i,
  /\.ps1$/i,
  /\.bash$/i,
];

function decodeGitlabFileContent(content: string): string {
  return Buffer.from(content, "base64").toString("utf-8");
}

function getFileExtension(path: string): string {
  const fileName = path.split("/").pop() ?? path;
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot <= 0) return "";
  return fileName.slice(lastDot).toLowerCase();
}

function incrementCounter(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function takeFirst<T>(values: T[], limit: number): T[] {
  return values.slice(0, limit);
}

function normalizeReadmePreview(content: string): string {
  return content
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, MAX_README_PREVIEW_CHARS);
}

function getTopLevelSegment(path: string): string {
  return path.split("/")[0] ?? path;
}

function inferDirectoryRole(path: string): string {
  const normalized = path.toLowerCase();

  if (normalized === "src") return "código-fonte principal";
  if (normalized === "apps" || normalized.startsWith("apps/"))
    return "aplicações ou serviços executáveis";
  if (normalized === "services" || normalized.startsWith("services/"))
    return "serviços de negócio ou microsserviços";
  if (normalized === "packages" || normalized.startsWith("packages/"))
    return "pacotes compartilhados";
  if (normalized === "libs" || normalized.startsWith("libs/"))
    return "bibliotecas internas reutilizáveis";
  if (normalized === "modules" || normalized.startsWith("modules/"))
    return "módulos de domínio";
  if (normalized === "api" || normalized.startsWith("api/"))
    return "camada de API";
  if (normalized === "web" || normalized.startsWith("web/"))
    return "aplicação web";
  if (normalized === "frontend" || normalized.startsWith("frontend/"))
    return "frontend";
  if (normalized === "backend" || normalized.startsWith("backend/"))
    return "backend";
  if (normalized === "infra" || normalized.startsWith("infra/"))
    return "infraestrutura e provisionamento";
  if (normalized === "deploy" || normalized.startsWith("deploy/"))
    return "artefatos de deploy";
  if (normalized === "config" || normalized.startsWith("config/"))
    return "configuração da aplicação";
  if (normalized === "docs" || normalized.startsWith("docs/"))
    return "documentação";
  if (normalized === "scripts" || normalized.startsWith("scripts/"))
    return "scripts operacionais";
  if (normalized === "db" || normalized.startsWith("db/"))
    return "artefatos de banco de dados";
  if (normalized === "database" || normalized.startsWith("database/"))
    return "artefatos de banco de dados";
  if (normalized === "migrations" || normalized.startsWith("migrations/"))
    return "migrações de banco";
  if (normalized === "prisma" || normalized.startsWith("prisma/"))
    return "schema e migrações Prisma";
  if (
    normalized === "test" ||
    normalized === "tests" ||
    normalized.startsWith("tests/")
  )
    return "testes automatizados";

  return "diretório relevante do repositório";
}

function detectLanguages(filePaths: string[]) {
  const extensionToLanguage: Record<string, string> = {
    ".ts": "TypeScript",
    ".tsx": "TypeScript React",
    ".js": "JavaScript",
    ".jsx": "JavaScript React",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
    ".py": "Python",
    ".java": "Java",
    ".kt": "Kotlin",
    ".kts": "Kotlin",
    ".go": "Go",
    ".rb": "Ruby",
    ".php": "PHP",
    ".cs": "C#",
    ".sql": "SQL",
    ".md": "Markdown",
    ".mdx": "MDX",
    ".yml": "YAML",
    ".yaml": "YAML",
    ".json": "JSON",
    ".xml": "XML",
    ".sh": "Shell",
    ".bash": "Shell",
    ".ps1": "PowerShell",
    ".tf": "Terraform",
    ".tfvars": "Terraform",
    ".rs": "Rust",
    ".swift": "Swift",
    ".scala": "Scala",
    ".dart": "Dart",
    ".html": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".sass": "Sass",
    ".less": "Less",
    ".vue": "Vue",
    ".proto": "Protocol Buffers",
  };

  const counts = new Map<string, number>();

  for (const path of filePaths) {
    const ext = getFileExtension(path);
    const language = extensionToLanguage[ext];
    if (!language) continue;
    incrementCounter(counts, language);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TOP_LANGUAGES)
    .map(([language, fileCount]) => ({ language, fileCount }));
}

function detectArchitectureSignals(rootFiles: string[], allFiles: string[]) {
  const rootSet = new Set(rootFiles);
  const allSet = new Set(allFiles);
  const signals: string[] = [];

  const hasAny = (patterns: Array<string | RegExp>) =>
    patterns.some((pattern) => {
      if (typeof pattern === "string") {
        return allSet.has(pattern) || rootSet.has(pattern);
      }
      return allFiles.some((path) => pattern.test(path));
    });

  if (rootSet.has("package.json")) signals.push("Projeto Node.js/JavaScript");
  if (
    rootSet.has("tsconfig.json") ||
    allFiles.some((f) => /\.ts$|\.tsx$/i.test(f))
  ) {
    signals.push("Uso relevante de TypeScript");
  }
  if (rootSet.has("turbo.json")) signals.push("Monorepo com Turborepo");
  if (rootSet.has("nx.json")) signals.push("Monorepo com Nx");
  if (rootSet.has("lerna.json")) signals.push("Monorepo com Lerna");
  if (rootSet.has("pnpm-lock.yaml"))
    signals.push("Gerenciamento de dependências com pnpm");
  if (rootSet.has("yarn.lock"))
    signals.push("Gerenciamento de dependências com Yarn");
  if (rootSet.has("package-lock.json"))
    signals.push("Gerenciamento de dependências com npm");

  if (rootSet.has("pom.xml") || allFiles.some((f) => f.endsWith("pom.xml"))) {
    signals.push("Projeto Java com Maven");
  }
  if (
    rootSet.has("build.gradle") ||
    rootSet.has("build.gradle.kts") ||
    allFiles.some((f) => /build\.gradle(\.kts)?$/i.test(f))
  ) {
    signals.push("Projeto JVM com Gradle");
  }
  if (rootSet.has("requirements.txt") || rootSet.has("pyproject.toml")) {
    signals.push("Projeto Python");
  }
  if (rootSet.has("go.mod")) signals.push("Projeto Go");
  if (rootSet.has("Cargo.toml")) signals.push("Projeto Rust");
  if (rootSet.has("composer.json")) signals.push("Projeto PHP com Composer");
  if (rootSet.has("Gemfile")) signals.push("Projeto Ruby");
  if (rootSet.has("docker-compose.yml") || rootSet.has("docker-compose.yaml")) {
    signals.push("Orquestração local com Docker Compose");
  }
  if (rootSet.has(".gitlab-ci.yml")) signals.push("Pipeline CI/CD no GitLab");

  if (hasAny([/(^|\/)prisma\/schema\.prisma$/i])) signals.push("Uso de Prisma");
  if (
    hasAny([
      /(^|\/)db\/migrate\//i,
      /(^|\/)database\/migrations\//i,
      /(^|\/)migrations\//i,
    ])
  ) {
    signals.push("Migrações de banco versionadas");
  }
  if (
    hasAny([/(^|\/)openapi\.(ya?ml|json)$/i, /(^|\/)swagger\.(ya?ml|json)$/i])
  ) {
    signals.push("Especificação de API documentada");
  }
  if (hasAny([/(^|\/)dockerfile$/i]))
    signals.push("Containerização com Docker");
  if (
    hasAny([
      /(^|\/)src\/main\/java\/.+Application\.java$/i,
      /(^|\/)src\/main\/kotlin\/.+Application\.kt$/i,
    ])
  ) {
    signals.push("Possível aplicação Spring Boot");
  }

  return unique(signals);
}

function detectImportantFiles(rootFiles: string[], allFiles: string[]) {
  const important: string[] = [];

  for (const file of rootFiles) {
    const fileName = file.split("/").pop() ?? file;
    if (IMPORTANT_ROOT_FILES.has(fileName)) {
      important.push(file);
    }
  }

  for (const file of allFiles) {
    if (IMPORTANT_FILE_PATTERNS.some((pattern) => pattern.test(file))) {
      important.push(file);
    }
  }

  return takeFirst(unique(important).sort(), MAX_IMPORTANT_FILES);
}

function detectEntrypoints(allFiles: string[]) {
  const candidates = allFiles.filter((file) =>
    ENTRYPOINT_PATTERNS.some((pattern) => pattern.test(file)),
  );

  return takeFirst(unique(candidates).sort(), MAX_ENTRYPOINTS);
}

function detectRepositoryAreas(allFiles: string[]) {
  const areas = {
    migrations: allFiles.filter((file) =>
      MIGRATION_PATTERNS.some((pattern) => pattern.test(file)),
    ),
    docs: allFiles.filter((file) =>
      DOC_PATTERNS.some((pattern) => pattern.test(file)),
    ),
    scripts: allFiles.filter((file) =>
      SCRIPT_PATTERNS.some((pattern) => pattern.test(file)),
    ),
  };

  return {
    migrations: {
      found: areas.migrations.length > 0,
      examples: takeFirst(areas.migrations.sort(), 10),
      total: areas.migrations.length,
    },
    docs: {
      found: areas.docs.length > 0,
      examples: takeFirst(areas.docs.sort(), 10),
      total: areas.docs.length,
    },
    scripts: {
      found: areas.scripts.length > 0,
      examples: takeFirst(areas.scripts.sort(), 10),
      total: areas.scripts.length,
    },
  };
}

function buildCentralDirectories(
  rootTree: GitlabTreeItem[],
  allFiles: string[],
) {
  const rootDirs = rootTree
    .filter((item) => item.type === "tree")
    .map((item) => item.path)
    .filter((dir) => !IGNORED_TOP_LEVEL_DIRS.has(dir.toLowerCase()));

  const fileCountByTopLevel = new Map<string, number>();
  for (const filePath of allFiles) {
    const topLevel = getTopLevelSegment(filePath);
    incrementCounter(fileCountByTopLevel, topLevel);
  }

  return rootDirs
    .map((path) => ({
      path,
      suspectedRole: inferDirectoryRole(path),
      fileCount: fileCountByTopLevel.get(path) ?? 0,
    }))
    .sort((a, b) => b.fileCount - a.fileCount || a.path.localeCompare(b.path))
    .slice(0, MAX_CENTRAL_DIRECTORIES);
}

async function fetchGitlabTreePage(params: {
  baseUrl: string;
  encodedProject: string;
  token: string;
  ref: string;
  recursive?: boolean;
  page: number;
}) {
  const response = await axios.get<GitlabTreeItem[]>(
    `${params.baseUrl}/projects/${params.encodedProject}/repository/tree`,
    {
      headers: { "PRIVATE-TOKEN": params.token },
      params: {
        ref: params.ref,
        recursive: params.recursive ?? false,
        per_page: MAX_TREE_PAGE_SIZE,
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

async function fetchReadmeFromRoot(params: {
  baseUrl: string;
  encodedProject: string;
  token: string;
  ref: string;
  rootTree: GitlabTreeItem[];
}) {
  const readmeFile = params.rootTree.find(
    (item) =>
      item.type === "blob" && item.name.toLowerCase().startsWith("readme"),
  );

  if (!readmeFile) {
    return {
      found: false as const,
      fileName: null,
      content: null,
      preview: null,
    };
  }

  const encodedFilePath = encodeURIComponent(readmeFile.path);

  const response = await axios.get<GitlabRepositoryFileResponse>(
    `${params.baseUrl}/projects/${params.encodedProject}/repository/files/${encodedFilePath}`,
    {
      headers: { "PRIVATE-TOKEN": params.token },
      params: { ref: params.ref },
    },
  );

  const content = decodeGitlabFileContent(response.data.content);

  return {
    found: true as const,
    fileName: readmeFile.name,
    content,
    preview: normalizeReadmePreview(content),
  };
}

export async function getRepositoryOverview(input: unknown) {
  const { projectId } = getRepositoryOverviewInputSchema.parse(input);

  const integration = await prisma.gitlabIntegration.findFirst({
    where: { projectId },
  });

  if (!integration) {
    throw new Error("INTEGRATION_NOT_FOUND");
  }

  const token = decrypt(integration.token);
  const encodedProject = encodeURIComponent(integration.projectPath);
  const baseUrl = gitlabApiBase(integration.repoUrl);

  try {
    const [rootTree, recursiveTree] = await Promise.all([
      fetchAllGitlabTree({
        baseUrl,
        encodedProject,
        token,
        ref: integration.branch,
        recursive: false,
      }),
      fetchAllGitlabTree({
        baseUrl,
        encodedProject,
        token,
        ref: integration.branch,
        recursive: true,
      }),
    ]);

    const allFiles = recursiveTree
      .filter((item) => item.type === "blob")
      .map((item) => item.path)
      .sort();

    const rootFiles = rootTree
      .filter((item) => item.type === "blob")
      .map((item) => item.path)
      .sort();

    const readme = await fetchReadmeFromRoot({
      baseUrl,
      encodedProject,
      token,
      ref: integration.branch,
      rootTree,
    });

    const languages = detectLanguages(allFiles);
    const centralDirectories = buildCentralDirectories(rootTree, allFiles);
    const importantFiles = detectImportantFiles(rootFiles, allFiles);
    const possibleEntrypoints = detectEntrypoints(allFiles);
    const architectureSignals = detectArchitectureSignals(rootFiles, allFiles);
    const repositoryAreas = detectRepositoryAreas(allFiles);

    return {
      repository: {
        projectPath: integration.projectPath,
        branch: integration.branch,
      },
      stats: {
        totalFiles: allFiles.length,
        rootItems: rootTree.length,
        rootFiles: rootFiles.length,
        rootDirectories: rootTree.filter((item) => item.type === "tree").length,
      },
      readme: {
        found: readme.found,
        fileName: readme.fileName,
        preview: readme.preview,
      },
      languages,
      architectureSignals,
      centralDirectories,
      importantFiles,
      possibleEntrypoints,
      repositoryAreas,
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
