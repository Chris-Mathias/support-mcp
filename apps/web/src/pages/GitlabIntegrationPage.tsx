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
    <div className="flex flex-col h-full bg-white">
      <div className="flex-none bg-gray-50 border-b border-gray-200 p-6 shadow-sm z-10">
        <div className="flex flex-col md:flex-row gap-6 max-w-7xl mx-auto">
          <div className="w-full md:w-1/3">
            <h1 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Settings className="text-indigo-600" />
              Integração GitLab
            </h1>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Projeto
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
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
              <div className="mt-4 flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                <CheckCircle size={16} /> Integração Ativa
              </div>
            )}
          </div>

          {selectedProjectId && !loadingIntegration && (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Repo URL
                </label>
                <input
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                  placeholder="https://gitlab.com/..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Project Path
                </label>
                <input
                  value={projectPath}
                  onChange={(e) => setProjectPath(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                  placeholder="grupo/repo"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Branch
                </label>
                <input
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Token (Personal/Project)
                </label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                  placeholder="glpat-..."
                />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button
                  onClick={handleSaveIntegration}
                  disabled={
                    savingIntegration || !repoUrl || !projectPath || !token
                  }
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <Save size={16} />{" "}
                  {savingIntegration ? "Salvando..." : "Salvar Configuração"}
                </button>
              </div>
            </div>
          )}
        </div>
        {error && (
          <p className="text-red-500 text-sm mt-4 max-w-7xl mx-auto">{error}</p>
        )}
      </div>

      {integration && (
        <div className="flex-1 flex overflow-hidden bg-white">
          <div className="w-72 border-r border-gray-200 flex flex-col bg-gray-50">
            <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-gray-100">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                Explorer
              </span>
              <button
                onClick={() => handleLoadFiles("")}
                className="p-1 hover:bg-gray-200 rounded text-gray-500"
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
                  className="flex items-center gap-2 text-sm text-gray-600 p-2 hover:bg-gray-200 rounded-lg w-full text-left mb-2 font-medium"
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
                    className={`flex items-center gap-2 w-full text-left p-1.5 rounded text-sm transition-colors ${selectedFilePath === item.path ? "bg-indigo-100 text-indigo-700 font-medium" : "text-gray-700 hover:bg-gray-200"}`}
                  >
                    {isDir ? (
                      <Folder
                        size={16}
                        className="text-blue-500 fill-blue-500/20"
                      />
                    ) : (
                      <FileCode size={16} className="text-gray-500" />
                    )}
                    <span className="truncate">{item.name}</span>
                  </button>
                );
              })}
              {files.length === 0 && !loadingFiles && (
                <p className="text-xs text-gray-400 text-center mt-4">
                  Nenhum arquivo listado.
                </p>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-[#1e1e1e]">
            {loadingFileContent ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <RefreshCw size={32} className="animate-spin mb-4" />
              </div>
            ) : fileContent ? (
              <>
                <div className="flex-none bg-[#2d2d2d] px-4 py-2 flex items-center gap-2 text-[#cccccc] text-sm font-mono border-b border-[#3e3e3e]">
                  <FileCode size={16} />
                  {fileContent.file_path}
                </div>
                <textarea
                  readOnly
                  value={fileContent.decodedContent}
                  className="flex-1 w-full bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm p-4 outline-none resize-none overflow-y-auto"
                  spellCheck={false}
                />
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-[#5c5c5c]">
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
