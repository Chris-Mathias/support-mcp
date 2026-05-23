export type ProjectDocument = {
  id: string;
  projectId: string;
  fileName: string;
  filePath: string;
  mimeType?: string | null;
  fileSize?: number | null;
  extractedText?: string | null;
  summary?: string | null;
  createdAt: string;
};
