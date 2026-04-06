import OpenAI from "openai";

export class LlmService {
  private client: OpenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.LLM_API_KEY;

    if (!apiKey) {
      throw new Error("LLM_API_KEY_NOT_CONFIGURED");
    }

    this.client = new OpenAI({
      apiKey,
    });

    this.model = process.env.LLM_MODEL || "gpt-5-nano";
  }

  async generateSupportAnswer(params: {
    question: string;
    projectId: string;
    documentSearchText: string;
    gitlabSearchText: string;
  }) {
    const systemPrompt = [
      "Você é um assistente técnico para suporte N1.",
      "Responda apenas com base no contexto fornecido.",
      "Não invente funcionalidades, arquivos, tabelas ou comportamentos.",
      "Não exponha código-fonte na resposta final.",
      "Só inclua SQL se houver evidência clara e se isso ajudar diretamente o suporte.",
      "Se a evidência for insuficiente, diga isso explicitamente.",
      "Responda em português do Brasil, de forma objetiva e técnica.",
    ].join(" ");

    const userPrompt = [
      `Projeto ativo: ${params.projectId}`,
      "",
      `Pergunta do atendente: ${params.question}`,
      "",
      "Contexto recuperado em documentos:",
      params.documentSearchText || "Nenhum resultado relevante em documentos.",
      "",
      "Contexto recuperado no repositório:",
      params.gitlabSearchText || "Nenhum resultado relevante no repositório.",
      "",
      "Tarefa:",
      "Produza uma resposta em linguagem natural para o atendente.",
      "Explique o que parece estar acontecendo, possíveis causas e próximos passos.",
      "Não mostre código-fonte.",
    ].join("\n");

    const response = await this.client.responses.create({
      model: this.model,
      input: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    return response.output_text.trim();
  }
}
