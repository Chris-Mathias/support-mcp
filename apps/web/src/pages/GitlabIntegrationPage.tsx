import { useEffect, useState } from "react";
import {
  CheckCircle,
  FileCode,
  Folder,
  GitBranch,
  RefreshCw,
  Save,
  Settings,
} from "lucide-react";
import { WorkspacePage } from "../components/layout/WorkspacePage";
import { AlertBanner } from "../components/ui/AlertBanner";
import { EmptyState } from "../components/ui/EmptyState";
import { Panel } from "../components/ui/Panel";
import { ProjectSelect } from "../components/ui/ProjectSelect";
import { cn } from "../lib/cn";
import { api } from "../services/api";
import type {
  GitlabFileContent,
  GitlabIntegration,
  GitlabTreeItem,
} from "../types/gitlab";
import type { Project } from "../types/project";

export function GitlabIntegrationPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const [repoUrl, setRepoUrl] = useState("");
  const [projectPath, setProjectPath] = useState("");
  const [branch, setBranch] = useState("main");
  const [token, setToken] = useState("");

  const [integration, setIntegration] = useState<GitlabIntegration | null>(
    null,
  );
  const [files, setFiles] = useState<GitlabTreeItem[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState("");
  const [fileContent, setFileContent] = useState<GitlabFileContent | null>(
    null,
  );
  const [currentPath, setCurrentPath] = useState("");

  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingIntegration, setLoadingIntegration] = useState(false);
  const [savingIntegration, setSavingIntegration] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingFileContent, setLoadingFileContent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingProjects(true);

    api
      .get<Project[]>("/projects")
      .then((response) => setProjects(response.data))
      .catch(() => setError("Não foi possível carregar os projetos."))
      .finally(() => setLoadingProjects(false));
  }, []);

  async function handleProjectChange(projectId: string) {
    setSelectedProjectId(projectId);
    setFiles([]);
    setSelectedFilePath("");
    setFileContent(null);
    setError(null);
    setCurrentPath("");

    if (!projectId) {
      setIntegration(null);
      setRepoUrl("");
      setProjectPath("");
      setBranch("main");
      setToken("");
      return;
    }

    setLoadingIntegration(true);

    try {
      const response = await api.get<GitlabIntegration>(
        `/projects/${projectId}/gitlab-integration`,
      );
      setIntegration(response.data);
      setRepoUrl(response.data.repoUrl);
      setProjectPath(response.data.projectPath);
      setBranch(response.data.branch);
      setToken(response.data.token);
    } catch {
      setIntegration(null);
      setRepoUrl("");
      setProjectPath("");
      setBranch("main");
      setToken("");
    } finally {
      setLoadingIntegration(false);
    }
  }

  async function handleSaveIntegration() {
    if (!selectedProjectId) return;

    setSavingIntegration(true);
    setError(null);

    try {
      const response = await api.post<GitlabIntegration>(
        `/projects/${selectedProjectId}/gitlab-integration`,
        {
          repoUrl,
          projectPath,
          branch,
          token,
        },
      );
      setIntegration(response.data);
    } catch {
      setError("Não foi possível salvar a integração.");
    } finally {
      setSavingIntegration(false);
    }
  }

  async function handleLoadFiles(path = "") {
    if (!selectedProjectId) return;

    setLoadingFiles(true);
    setError(null);
    setFileContent(null);
    setSelectedFilePath("");
    setCurrentPath(path);

    try {
      const response = await api.get<GitlabTreeItem[]>(
        `/projects/${selectedProjectId}/gitlab/files`,
        { params: { path } },
      );
      setFiles(response.data);
    } catch {
      setError("Não foi possível listar arquivos.");
    } finally {
      setLoadingFiles(false);
    }
  }

  async function handleOpenFile(filePath: string) {
    if (!selectedProjectId) return;

    setLoadingFileContent(true);
    setError(null);
    setSelectedFilePath(filePath);

    try {
      const response = await api.get<GitlabFileContent>(
        `/projects/${selectedProjectId}/gitlab/file-content`,
        { params: { filePath } },
      );
      setFileContent(response.data);
    } catch {
      setError("Não foi possível carregar o conteúdo do arquivo.");
    } finally {
      setLoadingFileContent(false);
    }
  }

  return (
    <WorkspacePage
      sidebar={
        <div className="flex flex-1 flex-col gap-5 px-5 py-6">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-800 dark:text-zinc-100">
              <Settings className="text-zinc-700 dark:text-zinc-300" />
              Integração GitLab
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Configure o repositório associado ao projeto e navegue pelo código.
            </p>
          </div>

          <ProjectSelect
            value={selectedProjectId}
            projects={projects}
            placeholder="Selecione..."
            disabled={loadingProjects}
            onChange={handleProjectChange}
          />

          {integration ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle size={16} /> Integração ativa
            </div>
          ) : null}

          {selectedProjectId && !loadingIntegration ? (
            <Panel className="p-5">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Repo URL
                  </label>
                  <input
                    value={repoUrl}
                    onChange={(event) => setRepoUrl(event.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 outline-none transition-all placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                    placeholder="https://gitlab.com/..."
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Project Path
                  </label>
                  <input
                    value={projectPath}
                    onChange={(event) => setProjectPath(event.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 outline-none transition-all placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                    placeholder="grupo/repo"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Branch
                  </label>
                  <input
                    value={branch}
                    onChange={(event) => setBranch(event.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 outline-none transition-all focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Token (Personal/Project)
                  </label>
                  <input
                    type="password"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 outline-none transition-all placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                    placeholder="glpat-..."
                  />
                </div>

                <button
                  onClick={handleSaveIntegration}
                  disabled={savingIntegration || !repoUrl || !projectPath || !token}
                  className="flex items-center justify-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                >
                  <Save size={16} />
                  {savingIntegration ? "Salvando..." : "Salvar Configuração"}
                </button>
              </div>
            </Panel>
          ) : null}
        </div>
      }
    >
      {error ? <AlertBanner className="m-4">{error}</AlertBanner> : null}

      {!selectedProjectId ? (
        <EmptyState
          icon={GitBranch}
          title="Selecione um projeto para configurar a integração."
          description="A navegação do repositório aparece aqui depois que um projeto for escolhido."
          className="flex-1"
        />
      ) : loadingIntegration ? (
        <div className="flex flex-1 items-center justify-center text-zinc-400 dark:text-zinc-500">
          <RefreshCw size={26} className="animate-spin" />
        </div>
      ) : !integration ? (
        <div className="flex flex-1 p-6">
          <Panel className="mx-auto flex w-full max-w-5xl items-center justify-center">
            <EmptyState
              icon={Settings}
              title="Preencha a configuração do GitLab na coluna lateral."
              description="Depois de salvar, o explorador de arquivos e o visualizador de conteúdo ficam disponíveis aqui."
            />
          </Panel>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden p-6">
          <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-1 gap-4 overflow-hidden">
            <Panel className="flex w-80 min-w-0 flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                  Explorer
                </span>

                <button
                  onClick={() => handleLoadFiles("")}
                  className="rounded p-1 text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  title="Recarregar raiz"
                >
                  <RefreshCw
                    size={14}
                    className={loadingFiles ? "animate-spin" : ""}
                  />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {currentPath ? (
                  <button
                    onClick={() => {
                      const parts = currentPath.split("/");
                      parts.pop();
                      handleLoadFiles(parts.join("/"));
                    }}
                    className="mb-2 flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm font-medium text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    .. (voltar)
                  </button>
                ) : null}

                {files.map((item) => {
                  const isDir = item.type === "tree";

                  return (
                    <button
                      key={item.path}
                      onClick={() =>
                        isDir
                          ? handleLoadFiles(item.path)
                          : handleOpenFile(item.path)
                      }
                      className={cn(
                        "flex w-full items-center gap-2 rounded p-1.5 text-left text-sm transition-colors",
                        selectedFilePath === item.path
                          ? "bg-zinc-200 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                          : "text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800",
                      )}
                    >
                      {isDir ? (
                        <Folder
                          size={16}
                          className="fill-zinc-500/20 text-zinc-500 dark:fill-zinc-300/20 dark:text-zinc-300"
                        />
                      ) : (
                        <FileCode
                          size={16}
                          className="text-zinc-500 dark:text-zinc-400"
                        />
                      )}
                      <span className="truncate">{item.name}</span>
                    </button>
                  );
                })}

                {files.length === 0 && !loadingFiles ? (
                  <p className="mt-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
                    Nenhum arquivo listado. Use o recarregar para consultar a raiz.
                  </p>
                ) : null}
              </div>
            </Panel>

            <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-sm">
              {loadingFileContent ? (
                <div className="flex flex-1 items-center justify-center text-zinc-400">
                  <RefreshCw size={32} className="animate-spin" />
                </div>
              ) : fileContent ? (
                <>
                  <div className="flex flex-none items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-4 py-2 font-mono text-sm text-zinc-300">
                    <FileCode size={16} />
                    {fileContent.file_path}
                  </div>

                  <textarea
                    readOnly
                    value={fileContent.decodedContent}
                    className="w-full flex-1 resize-none overflow-y-auto bg-zinc-950 p-4 font-mono text-sm text-zinc-300 outline-none"
                    spellCheck={false}
                  />
                </>
              ) : (
                <EmptyState
                  icon={FileCode}
                  title="Selecione um arquivo para visualizar o conteúdo."
                  description="O editor segue o mesmo painel principal do chat, com foco total no conteúdo ativo."
                  className="flex-1 text-zinc-600 dark:text-zinc-500"
                  iconClassName="opacity-50"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </WorkspacePage>
  );
}
