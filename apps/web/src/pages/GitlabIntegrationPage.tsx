import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { Project } from "../types/project";
import type {
  GitlabFileContent,
  GitlabIntegration,
  GitlabTreeItem,
} from "../types/gitlab";
import {
  Settings,
  RefreshCw,
  Folder,
  FileCode,
  CheckCircle,
  Save,
} from "lucide-react";

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
      .then((res) => setProjects(res.data))
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
      const res = await api.get<GitlabIntegration>(
        `/projects/${projectId}/gitlab-integration`,
      );
      setIntegration(res.data);
      setRepoUrl(res.data.repoUrl);
      setProjectPath(res.data.projectPath);
      setBranch(res.data.branch);
      setToken(res.data.token);
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
      const res = await api.post<GitlabIntegration>(
        `/projects/${selectedProjectId}/gitlab-integration`,
        {
          repoUrl,
          projectPath,
          branch,
          token,
        },
      );
      setIntegration(res.data);
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
      const res = await api.get<GitlabTreeItem[]>(
        `/projects/${selectedProjectId}/gitlab/files`,
        { params: { path } },
      );
      setFiles(res.data);
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
      const res = await api.get<GitlabFileContent>(
        `/projects/${selectedProjectId}/gitlab/file-content`,
        { params: { filePath } },
      );
      setFileContent(res.data);
    } catch {
      setError("Não foi carregar o conteúdo do arquivo.");
    } finally {
      setLoadingFileContent(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="z-10 flex-none border-b border-zinc-200 bg-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row">
          <div className="w-full md:w-1/3">
            <h1 className="mb-4 flex items-center gap-2 text-xl font-bold text-zinc-800 dark:text-zinc-100">
              <Settings className="text-zinc-700 dark:text-zinc-300" />
              Integração GitLab
            </h1>

            <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Projeto
            </label>

            <select
              value={selectedProjectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-zinc-800 outline-none transition-all focus:ring-2 focus:ring-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              disabled={loadingProjects}
            >
              <option value="">Selecione...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {integration && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle size={16} /> Integração Ativa
              </div>
            )}
          </div>

          {selectedProjectId && !loadingIntegration && (
            <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Repo URL
                </label>
                <input
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-800 outline-none transition-all placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                  placeholder="https://gitlab.com/..."
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Project Path
                </label>
                <input
                  value={projectPath}
                  onChange={(e) => setProjectPath(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-800 outline-none transition-all placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                  placeholder="grupo/repo"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Branch
                </label>
                <input
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-800 outline-none transition-all focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Token (Personal/Project)
                </label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-800 outline-none transition-all placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                  placeholder="glpat-..."
                />
              </div>

              <div className="flex justify-end md:col-span-2">
                <button
                  onClick={handleSaveIntegration}
                  disabled={
                    savingIntegration || !repoUrl || !projectPath || !token
                  }
                  className="flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                >
                  <Save size={16} />{" "}
                  {savingIntegration ? "Salvando..." : "Salvar Configuração"}
                </button>
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="mx-auto mt-4 max-w-7xl text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      {integration && (
        <div className="flex flex-1 overflow-hidden bg-white dark:bg-zinc-950">
          <div className="flex w-72 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-100 p-3 dark:border-zinc-800 dark:bg-zinc-800">
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
              {currentPath && (
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
              )}

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
                    className={`flex w-full items-center gap-2 rounded p-1.5 text-left text-sm transition-colors ${
                      selectedFilePath === item.path
                        ? "bg-zinc-200 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                        : "text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
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

              {files.length === 0 && !loadingFiles && (
                <p className="mt-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
                  Nenhum arquivo listado.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-1 flex-col bg-zinc-950">
            {loadingFileContent ? (
              <div className="flex flex-1 items-center justify-center text-zinc-400">
                <RefreshCw size={32} className="mb-4 animate-spin" />
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
                  className="flex-1 w-full resize-none overflow-y-auto bg-zinc-950 p-4 font-mono text-sm text-zinc-300 outline-none"
                  spellCheck={false}
                />
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-zinc-600 dark:text-zinc-500">
                <FileCode size={64} className="mb-4 opacity-50" />
                <p>Selecione um arquivo para visualizar o conteúdo.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
