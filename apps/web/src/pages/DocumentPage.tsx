import { ChangeEvent, useEffect, useState } from "react";
import { api } from "../services/api";
import type { Project } from "../types/project";
import type { ProjectDocument } from "../types/document";

export function DocumentsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadProjects() {
    const response = await api.get<Project[]>("/projects");
    setProjects(response.data);
  }

  async function loadDocuments(projectId: string) {
    const response = await api.get<ProjectDocument[]>(
      `/projects/${projectId}/documents`,
    );
    setDocuments(response.data);
  }

  useEffect(() => {
    loadProjects().catch(() => {
      setError("Não foi possível carregar os projetos.");
    });
  }, []);

  async function handleProjectChange(projectId: string) {
    setSelectedProjectId(projectId);
    setDocuments([]);
    setSelectedFile(null);
    setError(null);

    if (!projectId) return;

    try {
      await loadDocuments(projectId);
    } catch {
      setError("Não foi possível carregar os documentos.");
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
  }

  async function handleUpload() {
    if (!selectedProjectId || !selectedFile) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      await api.post(`/projects/${selectedProjectId}/documents`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setSelectedFile(null);
      await loadDocuments(selectedProjectId);
    } catch {
      setError("Não foi possível enviar o documento.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(documentId: string) {
    if (!selectedProjectId) return;

    setError(null);

    try {
      await api.delete(
        `/projects/${selectedProjectId}/documents/${documentId}`,
      );
      await loadDocuments(selectedProjectId);
    } catch {
      setError("Não foi possível excluir o documento.");
    }
  }

  return (
    <main style={{ fontFamily: "sans-serif", padding: 24, maxWidth: 960 }}>
      <h1>Documentos por projeto</h1>

      <section style={{ marginBottom: 24 }}>
        <label>
          Projeto
          <br />
          <select
            value={selectedProjectId}
            onChange={(e) => handleProjectChange(e.target.value)}
            style={{ width: 320 }}
          >
            <option value="">Selecione um projeto</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>Upload de PDF</h2>
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
        />
        <div style={{ marginTop: 12 }}>
          <button
            onClick={handleUpload}
            disabled={!selectedProjectId || !selectedFile || loading}
          >
            {loading ? "Enviando..." : "Enviar documento"}
          </button>
        </div>
      </section>

      <section>
        <h2>Lista de documentos</h2>

        {documents.length === 0 ? (
          <p>Nenhum documento neste projeto.</p>
        ) : (
          <ul>
            {documents.map((document) => (
              <li key={document.id} style={{ marginBottom: 16 }}>
                <strong>{document.fileName}</strong>
                <div>MIME: {document.mimeType || "n/d"}</div>
                <div>Tamanho: {document.fileSize ?? 0} bytes</div>
                <div>
                  Criado em: {new Date(document.createdAt).toLocaleString()}
                </div>
                <div>
                  Texto extraído:{" "}
                  {document.extractedText
                    ? `${document.extractedText.slice(0, 120)}...`
                    : "vazio"}
                </div>
                <button onClick={() => handleDelete(document.id)}>
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && <p style={{ marginTop: 16 }}>{error}</p>}
    </main>
  );
}
