export function buildExcerpt(text: string, query: string, radius = 220) {
  if (!text.trim()) {
    return "";
  }

  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase().trim();

  const index = normalizedText.indexOf(normalizedQuery);

  if (index === -1) {
    return text.slice(0, radius * 2).trim();
  }

  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + normalizedQuery.length + radius);

  return text.slice(start, end).trim();
}
