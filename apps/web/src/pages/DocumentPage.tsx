import { ChangeEvent, useEffect, useState } from "react";
import { api } from "../services/api";
import type { Project } from "../types/project";
import type { ProjectDocument } from "../types/document";
import { UploadCloud, FileText, Trash2, HardDrive, Type } from "lucide-react";

export function DocumentsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Project[]>("/projects")
      .then((res) => setProjects(res.data))
      .catch(() => setError("Não foi possível carregar os projetos."));
  }, []);

  async function loadDocuments(projectId: string) {
    const response = await api.get<ProjectDocument[]>(
      `/projects/${projectId}/documents`,
    );
    setDocuments(response.data);
  }

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
    setSelectedFile(event.target.files?.[0] ?? null);
  }

  async function handleUpload() {
    if (!selectedProjectId || !selectedFile) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      await api.post(`/projects/${selectedProjectId}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
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
    <div className="flex h-full bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="flex h-full w-80 flex-col overflow-y-auto border-r border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-6 text-2xl font-bold text-zinc-800 dark:text-zinc-100">
          Documentos
        </h2>

        <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Selecione o Projeto
        </label>

        <select
          value={selectedProjectId}
          onChange={(e) => handleProjectChange(e.target.value)}
          className="mb-8 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-zinc-800 outline-none transition-all focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        >
          <option value="">Projetos...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {selectedProjectId && (
          <div className="relative mt-4 rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-5 text-center transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-800">
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />

            <UploadCloud
              className="mx-auto mb-2 text-zinc-600 dark:text-zinc-300"
              size={32}
            />

            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Clique para selecionar PDF
            </p>

            <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-500">
              {selectedFile ? selectedFile.name : "Nenhum arquivo"}
            </p>
          </div>
        )}

        {selectedFile && (
          <button
            onClick={handleUpload}
            disabled={loading}
            className="mt-4 w-full rounded-xl bg-zinc-800 py-2.5 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600"
          >
            {loading ? "Enviando..." : "Fazer Upload"}
          </button>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {!selectedProjectId ? (
          <div className="flex h-full flex-col items-center justify-center text-zinc-400 dark:text-zinc-500">
            <FileText size={64} className="mb-4 opacity-20" />
            <p className="text-lg">
              Selecione um projeto para gerenciar documentos.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl">
            <h3 className="mb-6 text-xl font-bold text-zinc-800 dark:text-zinc-100">
              Arquivos do Projeto
            </h3>

            {documents.length === 0 ? (
              <p className="rounded-2xl border border-zinc-100 bg-white py-10 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                Nenhum documento anexado.
              </p>
            ) : (
              <div className="space-y-4">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-start gap-4 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      <FileText size={24} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-lg font-bold text-zinc-800 dark:text-zinc-100">
                        {doc.fileName}
                      </h4>

                      <div className="mt-2 flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="flex items-center gap-1">
                          <HardDrive size={14} />{" "}
                          {(doc.fileSize ?? 0) / 1024 > 1024
                            ? `${((doc.fileSize ?? 0) / 1024 / 1024).toFixed(2)} MB`
                            : `${((doc.fileSize ?? 0) / 1024).toFixed(2)} KB`}
                        </span>

                        <span className="flex items-center gap-1">
                          <Type size={14} /> {doc.mimeType}
                        </span>

                        <span>
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <p className="mt-3 line-clamp-2 rounded-lg bg-zinc-50 p-2 text-sm italic text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
                        {doc.extractedText
                          ? `"${doc.extractedText}"`
                          : "Sem texto extraído."}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-zinc-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      title="Excluir documento"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
