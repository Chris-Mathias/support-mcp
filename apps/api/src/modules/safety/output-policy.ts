export function sanitizeAssistantOutput(text: string) {
  let sanitized = text.trim();

  sanitized = removeNonSqlCodeBlocks(sanitized);

  sanitized = sanitized.replace(/\n{3,}/g, "\n\n").trim();

  if (!sanitized) {
    return "Não foi possível gerar uma resposta segura com base no contexto recuperado.";
  }

  return sanitized;
}

function removeNonSqlCodeBlocks(text: string) {
  return text.replace(
    /```(\w+)?\n([\s\S]*?)```/g,
    (_, language = "", content = "") => {
      const normalized = String(language).toLowerCase().trim();

      if (normalized === "sql") {
        return `\`\`\`sql\n${content}\`\`\``;
      }

      return "[trecho de código omitido por política de exibição]";
    },
  );
}
