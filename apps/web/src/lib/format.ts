export function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export function formatFileSize(value?: number | null) {
  const bytes = value ?? 0;
  const kilobytes = bytes / 1024;
  
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (kilobytes > 1024) {
    return `${(kilobytes / 1024).toFixed(2)} MB`;
  }

  return `${kilobytes.toFixed(2)} KB`;
}
