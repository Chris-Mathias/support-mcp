export type DocumentProcessingStatus =
  | "PENDING"
  | "PROCESSING"
  | "READY"
  | "FAILED"
  | "UNSUPPORTED";

export type ProjectDocument = {
  id: string;
  projectId: string;
  fileName: string;
  filePath: string;
  mimeType?: string | null;
  fileSize?: number | null;
  extractedText?: string | null;
  pageCount?: number | null;
  summary?: string | null;
  processingStatus: DocumentProcessingStatus;
  processingError?: string | null;
  createdAt: string;
  updatedAt: string;
};
