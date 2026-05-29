import { ChangeEvent, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  FileText,
  HardDrive,
  Loader2,
  Trash2,
  Type,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { WorkspacePage } from "../components/layout/WorkspacePage";
import { AlertBanner } from "../components/ui/AlertBanner";
import { EmptyState } from "../components/ui/EmptyState";
import { Panel } from "../components/ui/Panel";
import { ProjectSelect } from "../components/ui/ProjectSelect";
import { getApiErrorMessage } from "../lib/errors";
import { formatDate, formatFileSize } from "../lib/format";
import { api } from "../services/api";
import type { DocumentProcessingStatus, ProjectDocument } from "../types/document";
import type { Project } from "../types/project";

const PROCESSING_ERROR_MESSAGES: Record<string, string> = {
  PDF_TEXT_EXTRACTION_EMPTY: "Não foi possível extrair texto deste PDF (possivelmente escaneado).",
  PROCESSING_TIMEOUT: "O processamento demorou demais e foi interrompido. Tente enviar novamente.",
  UNKNOWN_PDF_PROCESSING_ERROR: "Falha ao processar o PDF.",
};

function getProcessingErrorMessage(error?: string | null) {
  if (!error) return "Falha ao processar o PDF.";
  return PROCESSING_ERROR_MESSAGES[error] ?? "Falha ao processar o PDF.";
}

function StatusBadge({ status, error }: { status: DocumentProcessingStatus; error?: string | null }) {
  if (status === "PROCESSING" || status === "PENDING") {
    return (
      <span className="mt-2 flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400">
        <Loader2 size={14} className="animate-spin" />
        Processando…
      </span>
    );
  }
  if (status === "READY") {
    return (
      <span className="mt-2 flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
        <CheckCircle size={14} />
        Pronto
      </span>
    );
  }
  if (status === "FAILED") {
    return (
      <span className="mt-2 flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400" title={error ?? undefined}>
        <XCircle size={14} />
        {getProcessingErrorMessage(error)}
      </span>
    );
  }
  if (status === "UNSUPPORTED") {
    return (
      <span className="mt-2 flex items-center gap-1.5 text-sm text-yellow-600 dark:text-yellow-400">
        <AlertTriangle size={14} />
        {getProcessingErrorMessage(error)}
      </span>
    );
  }
  return null;
}

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
      .catch((error) => setError(getApiErrorMessage(error, "Não foi possível carregar os projetos.")));
  }, []);

  async function loadDocuments(projectId: string) {
    const response = await api.get<ProjectDocument[]>(
      `/projects/${projectId}/documents`,
    );
    setDocuments(response.data);
  }

  useEffect(() => {
    const hasProcessing = documents.some(
      (d) => d.processingStatus === "PROCESSING" || d.processingStatus === "PENDING",
    );
    if (!hasProcessing || !selectedProjectId) return;

    const interval = setInterval(() => {
      loadDocuments(selectedProjectId).catch(() => {});
    }, 3000);

    return () => clearInterval(interval);
  }, [documents, selectedProjectId]);

  async function handleProjectChange(projectId: string) {
    setSelectedProjectId(projectId);
    setDocuments([]);
    setSelectedFile(null);
    setError(null);

    if (!projectId) return;

    try {
      await loadDocuments(projectId);
    } catch (error) {
      setError(getApiErrorMessage(error, "Não foi possível carregar os documentos."));
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
    } catch (error) {
      setError(getApiErrorMessage(error, "Não foi possível enviar o documento."));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(documentId: string) {
    if (!selectedProjectId) return;

    try {
      await api.delete(`/projects/${selectedProjectId}/documents/${documentId}`);
      await loadDocuments(selectedProjectId);
    } catch (error) {
      setError(getApiErrorMessage(error, "Não foi possível excluir o documento."));
    }
  }

  return (
    <WorkspacePage
      sidebar={
        <div className="flex flex-1 flex-col gap-5 px-5 py-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">
              Documentos
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Organize PDFs por projeto e mantenha a base usada pelo suporte.
            </p>
          </div>

          <ProjectSelect
            value={selectedProjectId}
            projects={projects}
            placeholder="Projetos..."
            onChange={handleProjectChange}
          />

          {selectedProjectId ? (
            <Panel className="p-5">
              <div className="relative rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-5 text-center transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-800">
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

              {selectedFile ? (
                <button
                  onClick={handleUpload}
                  disabled={loading}
                  className="mt-4 w-full rounded-xl bg-zinc-800 py-2.5 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                >
                  {loading ? "Enviando..." : "Fazer Upload"}
                </button>
              ) : null}
            </Panel>
          ) : null}

          {error ? <AlertBanner>{error}</AlertBanner> : null}
        </div>
      }
    >
      <div className="flex flex-1 overflow-y-auto p-6">
        {!selectedProjectId ? (
          <EmptyState
            icon={FileText}
            title="Selecione um projeto para gerenciar documentos."
            description="A coluna lateral concentra a seleção do projeto e o envio de arquivos."
            className="w-full"
          />
        ) : (
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">
                  Arquivos do Projeto
                </h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Visualize e remova documentos usados como contexto do suporte.
                </p>
              </div>
              <span className="text-sm text-zinc-400 dark:text-zinc-500">
                {documents.length} arquivos
              </span>
            </div>

            {documents.length === 0 ? (
              <Panel className="flex min-h-72 items-center justify-center">
                <EmptyState
                  icon={FileText}
                  title="Nenhum documento anexado."
                  description="Envie um PDF na coluna lateral para preencher a base documental do projeto."
                />
              </Panel>
            ) : (
              <div className="space-y-4">
                {documents.map((document) => (
                  <Panel
                    key={document.id}
                    className="flex items-start gap-4 p-5 transition-shadow hover:shadow-md"
                  >
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      <FileText size={24} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-lg font-bold text-zinc-800 dark:text-zinc-100">
                        {document.fileName}
                      </h3>

                      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="flex items-center gap-1">
                          <HardDrive size={14} /> {formatFileSize(document.fileSize)}
                        </span>

                        <span className="flex items-center gap-1">
                          <Type size={14} /> {document.mimeType}
                        </span>

                        <span>{formatDate(document.createdAt)}</span>
                      </div>

                      <StatusBadge status={document.processingStatus} error={document.processingError} />

                      {document.processingStatus === "READY" && (
                        <p className="mt-3 line-clamp-2 rounded-lg bg-zinc-50 p-2 text-sm italic text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
                          {document.summary
                            ? `"${document.summary}"`
                            : "Sem resumo disponível."}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleDelete(document.id)}
                      className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-zinc-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      title="Excluir documento"
                    >
                      <Trash2 size={20} />
                    </button>
                  </Panel>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </WorkspacePage>
  );
}
