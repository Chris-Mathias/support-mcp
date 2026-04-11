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
    <div className="flex h-full bg-gray-50">
      <div className="w-80 bg-white border-r border-gray-200 p-6 flex flex-col h-full overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Documentos</h2>

        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Selecione o Projeto
        </label>
        <select
          value={selectedProjectId}
          onChange={(e) => handleProjectChange(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none mb-8"
        >
          <option value="">Projetos...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {selectedProjectId && (
          <div className="mt-4 p-5 border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50 text-center relative hover:bg-gray-100 transition-colors">
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <UploadCloud className="mx-auto text-indigo-500 mb-2" size={32} />
            <p className="text-sm font-medium text-gray-700">
              Clique para selecionar PDF
            </p>
            <p className="text-xs text-gray-500 mt-1 truncate">
              {selectedFile ? selectedFile.name : "Nenhum arquivo"}
            </p>
          </div>
        )}

        {selectedFile && (
          <button
            onClick={handleUpload}
            disabled={loading}
            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? "Enviando..." : "Fazer Upload"}
          </button>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
            {error}
          </p>
        )}
      </div>

      <div className="flex-1 p-8 overflow-y-auto">
        {!selectedProjectId ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <FileText size={64} className="opacity-20 mb-4" />
            <p className="text-lg">
              Selecione um projeto para gerenciar documentos.
            </p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <h3 className="text-xl font-bold text-gray-800 mb-6">
              Arquivos do Projeto
            </h3>
            {documents.length === 0 ? (
              <p className="text-gray-500 text-center py-10 bg-white rounded-2xl border border-gray-100">
                Nenhum documento anexado.
              </p>
            ) : (
              <div className="space-y-4">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-4 hover:shadow-md transition-shadow"
                  >
                    <div className="w-12 h-12 bg-red-100 text-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FileText size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-800 text-lg truncate">
                        {doc.fileName}
                      </h4>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
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
                      <p className="text-sm text-gray-600 mt-3 line-clamp-2 bg-gray-50 p-2 rounded-lg italic">
                        {doc.extractedText
                          ? `"${doc.extractedText}"`
                          : "Sem texto extraído."}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
