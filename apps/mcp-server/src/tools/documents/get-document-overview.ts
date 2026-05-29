import { z } from "zod";
import { prisma } from "../../lib/prisma.js";

export const getDocumentOverviewInputSchema = z.object({
  projectId: z.string().min(1),
  documentId: z.string().min(1),
  includeChunkPreviews: z.boolean().optional().default(true),
  maxChunkPreviews: z.number().int().min(1).max(10).optional().default(5),
});

export async function getDocumentOverview(input: unknown) {
  const { projectId, documentId, includeChunkPreviews, maxChunkPreviews } =
    getDocumentOverviewInputSchema.parse(input);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });

  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  const document = await prisma.projectDocument.findFirst({
    where: {
      id: documentId,
      projectId,
    },
    select: {
      id: true,
      projectId: true,
      fileName: true,
      filePath: true,
      mimeType: true,
      fileSize: true,
      pageCount: true,
      summary: true,
      processingStatus: true,
      processingError: true,
      createdAt: true,
      updatedAt: true,
      chunks: {
        orderBy: { chunkIndex: "asc" },
        take: Math.max(includeChunkPreviews ? maxChunkPreviews : 0, 20),
        select: {
          id: true,
          chunkIndex: true,
          pageNumberStart: true,
          pageNumberEnd: true,
          charCount: true,
          text: true,
        },
      },
      _count: {
        select: {
          chunks: true,
        },
      },
    },
  });

  if (!document) {
    throw new Error("DOCUMENT_NOT_FOUND");
  }

  const chunkCount = document._count.chunks;
  const isUsable = document.processingStatus === "READY" && chunkCount > 0;

  const rawText = document.chunks.map((c) => c.text).join("\n\n");
  const normalizedText = normalizeText(rawText);

  const detectedTitle = detectTitle(document.fileName, normalizedText);
  const keywords = extractKeywords(normalizedText);
  const detectedSections = detectSections(normalizedText);
  const estimatedDocumentType = classifyDocumentType(
    document.fileName,
    normalizedText,
  );

  const chunkPreviews = includeChunkPreviews
    ? document.chunks.slice(0, maxChunkPreviews).map((chunk) => ({
        chunkId: chunk.id,
        chunkIndex: chunk.chunkIndex,
        pageNumberStart: chunk.pageNumberStart,
        pageNumberEnd: chunk.pageNumberEnd,
        charCount: chunk.charCount,
        preview: truncate(chunk.text, 280),
      }))
    : [];

  return {
    document: {
      documentId: document.id,
      fileName: document.fileName,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      pageCount: document.pageCount,
      processingStatus: document.processingStatus,
      processingError: document.processingError,
      isUsable,
      chunkCount,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    },
    overview: {
      title: detectedTitle,
      summary:
        document.summary?.trim() ||
        buildFallbackSummary(normalizedText) ||
        null,
      estimatedDocumentType,
      keywords,
      detectedSections,
      recommendedNextAction: buildRecommendedNextAction({
        isUsable,
        processingStatus: document.processingStatus,
        chunkCount,
      }),
    },
    previews: {
      firstTextPreview: truncate(normalizedText, 500) || null,
      chunkPreviews,
    },
  };
}

function normalizeText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \u00A0]+/g, " ")
    .replace(/\n[ ]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncate(text: string, maxChars: number) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trim()}...`;
}

function detectTitle(fileName: string, text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines.slice(0, 12)) {
    if (line.length >= 8 && line.length <= 120) {
      return line;
    }
  }

  return fileName;
}

function extractKeywords(text: string) {
  if (!text) return [];

  const stopwords = new Set([
    "a",
    "o",
    "e",
    "de",
    "da",
    "do",
    "das",
    "dos",
    "em",
    "no",
    "na",
    "nos",
    "nas",
    "para",
    "por",
    "com",
    "sem",
    "um",
    "uma",
    "uns",
    "umas",
    "ou",
    "se",
    "ao",
    "aos",
    "às",
    "as",
    "os",
    "the",
    "and",
    "for",
    "with",
    "from",
    "into",
    "this",
    "that",
    "your",
    "you",
    "are",
    "was",
    "were",
    "not",
    "can",
    "will",
    "all",
    "any",
    "but",
    "has",
    "have",
    "had",
    "how",
    "what",
    "when",
    "where",
    "manual",
    "documento",
    "pagina",
    "page",
    "section",
    "secao",
    "capitulo",
  ]);

  const tokens = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !stopwords.has(token));

  const counts = new Map<string, number>();

  for (const token of tokens.slice(0, 4000)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([term]) => term);
}

function detectSections(text: string) {
  if (!text) return [];

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const results: string[] = [];
  const seen = new Set<string>();

  for (const line of lines.slice(0, 200)) {
    if (results.length >= 12) break;

    const looksLikeNumberedSection = /^\d+(\.\d+)*[\)\.]?\s+[A-ZÀ-ÿa-z]/.test(
      line,
    );

    const looksLikeNamedSection =
      /^(introdu[cç][aã]o|resumo|sum[aá]rio|configura[cç][aã]o|instala[cç][aã]o|requisitos|procedimento|troubleshooting|faq|erros|suporte|integra[cç][aã]o|autentica[cç][aã]o|vis[aã]o geral|overview|setup|usage|configuration|requirements|errors|troubleshooting|support|appendix)\b/i.test(
        line,
      );

    const hasReasonableLength = line.length >= 4 && line.length <= 120;

    if (
      (looksLikeNumberedSection || looksLikeNamedSection) &&
      hasReasonableLength
    ) {
      if (!seen.has(line.toLowerCase())) {
        results.push(line);
        seen.add(line.toLowerCase());
      }
    }
  }

  return results;
}

function classifyDocumentType(fileName: string, text: string) {
  const basis = `${fileName}\n${text.slice(0, 5000)}`.toLowerCase();

  const rules: Array<{ type: string; terms: string[] }> = [
    {
      type: "runbook",
      terms: [
        "runbook",
        "troubleshooting",
        "incidente",
        "procedimento",
        "suporte",
        "diagnostico",
      ],
    },
    {
      type: "manual",
      terms: ["manual", "guia", "instrucoes", "instruções", "user guide"],
    },
    {
      type: "integration_guide",
      terms: [
        "api",
        "endpoint",
        "token",
        "autenticacao",
        "autenticação",
        "integracao",
        "integração",
        "webhook",
      ],
    },
    {
      type: "installation_guide",
      terms: [
        "instalacao",
        "instalação",
        "setup",
        "requisitos",
        "deploy",
        "configuracao",
        "configuração",
      ],
    },
    {
      type: "release_notes",
      terms: [
        "release notes",
        "changelog",
        "versao",
        "versão",
        "novidades",
        "correcoes",
        "correções",
      ],
    },
    {
      type: "contract_or_policy",
      terms: [
        "contrato",
        "politica",
        "política",
        "termos",
        "sla",
        "compliance",
      ],
    },
    {
      type: "technical_specification",
      terms: [
        "arquitetura",
        "especificacao",
        "especificação",
        "modelo",
        "diagrama",
        "requisitos tecnicos",
        "requisitos técnicos",
      ],
    },
  ];

  let bestType = "general_document";
  let bestScore = 0;

  for (const rule of rules) {
    const score = rule.terms.reduce((acc, term) => {
      return acc + (basis.includes(term) ? 1 : 0);
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestType = rule.type;
    }
  }

  return bestType;
}

function buildFallbackSummary(text: string) {
  if (!text) return null;

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length >= 20);

  if (lines.length === 0) {
    return truncate(text, 400);
  }

  return truncate(lines.slice(0, 3).join(" "), 500);
}

function buildRecommendedNextAction(params: {
  isUsable: boolean;
  processingStatus: string;
  chunkCount: number;
}) {
  if (!params.isUsable) {
    if (params.processingStatus === "PROCESSING") {
      return "Documento ainda em processamento; aguarde antes de buscar conteúdo.";
    }

    if (params.processingStatus === "FAILED") {
      return "Documento com falha de processamento; verifique processingError antes de usá-lo.";
    }

    if (params.processingStatus === "UNSUPPORTED") {
      return "Documento sem texto utilizável no MVP; considere reprocessamento ou tratamento alternativo.";
    }

    return "Documento ainda não está pronto para navegação textual.";
  }

  if (params.chunkCount <= 3) {
    return "Documento pequeno; pode valer abrir um trecho diretamente ou, se necessário, ler o conteúdo completo.";
  }

  return "Documento pronto para uso; o próximo passo recomendado é buscar termos com search_document_content ou abrir trechos específicos com read_document_excerpt.";
}
