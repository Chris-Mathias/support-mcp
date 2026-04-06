import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { Project } from "../types/project";
import type {
  GitlabFileContent,
  GitlabIntegration,
  GitlabTreeItem,
} from "../types/gitlab";

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

  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingIntegration, setLoadingIntegration] = useState(false);
  const [savingIntegration, setSavingIntegration] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingFileContent, setLoadingFileContent] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function loadProjects() {
    setLoadingProjects(true);
    setError(null);

    try {
      const response = await api.get<Project[]>("/projects");
      setProjects(response.data);
    } catch {
      setError("Não foi possível carregar os projetos.");
    } finally {
      setLoadingProjects(false);
    }
  }

  async function loadIntegration(projectId: string) {
    setLoadingIntegration(true);
    setError(null);

    try {
      const response = await api.get<GitlabIntegration>(
        `/projects/${projectId}/gitlab-integration`,
      );

      const data = response.data;

      setIntegration(data);
      setRepoUrl(data.repoUrl);
      setProjectPath(data.projectPath);
      setBranch(data.branch);
      setToken(data.token);
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

  async function handleProjectChange(projectId: string) {
    setSelectedProjectId(projectId);
    setFiles([]);
    setSelectedFilePath("");
    setFileContent(null);
    setError(null);

    if (!projectId) {
      setIntegration(null);
      setRepoUrl("");
      setProjectPath("");
      setBranch("main");
      setToken("");
      return;
    }

    await loadIntegration(projectId);
  }

  async function handleSaveIntegration() {
    if (!selectedProjectId) {
      setError("Selecione um projeto.");
      return;
    }

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
      setError("Não foi possível salvar a integração GitLab.");
    } finally {
      setSavingIntegration(false);
    }
  }

  async function handleLoadFiles(path = "") {
    if (!selectedProjectId) {
      setError("Selecione um projeto.");
      return;
    }

    setLoadingFiles(true);
    setError(null);
    setFileContent(null);
    setSelectedFilePath("");

    try {
      const response = await api.get<GitlabTreeItem[]>(
        `/projects/${selectedProjectId}/gitlab/files`,
        {
          params: { path },
        },
      );

      setFiles(response.data);
    } catch {
      setError("Não foi possível listar os arquivos do repositório.");
    } finally {
      setLoadingFiles(false);
    }
  }

  async function handleOpenFile(filePath: string) {
    if (!selectedProjectId) {
      setError("Selecione um projeto.");
      return;
    }

    setLoadingFileContent(true);
    setError(null);
    setSelectedFilePath(filePath);

    try {
      const response = await api.get<GitlabFileContent>(
        `/projects/${selectedProjectId}/gitlab/file-content`,
        {
          params: { filePath },
        },
      );

      setFileContent(response.data);
    } catch {
      setError("Não foi possível carregar o conteúdo do arquivo.");
    } finally {
      setLoadingFileContent(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  return (
    <main style={{ fontFamily: "sans-serif", padding: 24, maxWidth: 1200 }}>
      <h1>Integração GitLab por projeto</h1>

      <section style={{ marginBottom: 24 }}>
        <h2>Projeto</h2>

        {loadingProjects ? (
          <p>Carregando projetos...</p>
        ) : (
          <select
            value={selectedProjectId}
            onChange={(e) => void handleProjectChange(e.target.value)}
            style={{ width: 360 }}
          >
            <option value="">Selecione um projeto</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        )}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>Configuração GitLab</h2>

        {loadingIntegration && selectedProjectId ? (
          <p>Carregando integração...</p>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <label>
                Repo URL
                <br />
                <input
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://gitlab.com/grupo/repositorio"
                  style={{ width: 500 }}
                />
              </label>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label>
                Project Path
                <br />
                <input
                  value={projectPath}
                  onChange={(e) => setProjectPath(e.target.value)}
                  placeholder="grupo/repositorio"
                  style={{ width: 400 }}
                />
              </label>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label>
                Branch
                <br />
                <input
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  style={{ width: 220 }}
                />
              </label>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label>
                Token
                <br />
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Token do GitLab"
                  style={{ width: 400 }}
                />
              </label>
            </div>

            <button
              onClick={() => void handleSaveIntegration()}
              disabled={
                !selectedProjectId ||
                !repoUrl ||
                !projectPath ||
                !branch ||
                !token ||
                savingIntegration
              }
            >
              {savingIntegration ? "Salvando..." : "Salvar integração"}
            </button>

            {integration && (
              <p style={{ marginTop: 12 }}>
                Integração cadastrada para este projeto.
              </p>
            )}
          </>
        )}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>Arquivos do repositório</h2>

        <button
          onClick={() => void handleLoadFiles("")}
          disabled={!selectedProjectId || loadingFiles}
        >
          {loadingFiles ? "Carregando..." : "Listar arquivos"}
        </button>

        {files.length === 0 ? (
          <p style={{ marginTop: 12 }}>Nenhum arquivo carregado.</p>
        ) : (
          <ul style={{ marginTop: 12 }}>
            {files.map((item) => (
              <li key={`${item.type}-${item.path}`} style={{ marginBottom: 8 }}>
                <strong>{item.name}</strong> — {item.type} — {item.path}{" "}
                {item.type === "blob" ? (
                  <button onClick={() => void handleOpenFile(item.path)}>
                    Abrir arquivo
                  </button>
                ) : (
                  <button onClick={() => void handleLoadFiles(item.path)}>
                    Abrir pasta
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Conteúdo do arquivo</h2>

        {loadingFileContent ? (
          <p>Carregando conteúdo...</p>
        ) : fileContent ? (
          <div>
            <p>
              <strong>Arquivo:</strong> {fileContent.file_path}
            </p>

            <textarea
              readOnly
              value={fileContent.decodedContent}
              rows={24}
              style={{ width: "100%", fontFamily: "monospace" }}
            />
          </div>
        ) : selectedFilePath ? (
          <p>Arquivo selecionado sem conteúdo carregado.</p>
        ) : (
          <p>Nenhum arquivo aberto.</p>
        )}
      </section>

      {error && <p style={{ marginTop: 16, color: "crimson" }}>{error}</p>}
    </main>
  );
}
