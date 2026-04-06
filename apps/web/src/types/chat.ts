export type ChatSession = {
  id: string;
  projectId: string;
  createdAt: string;
  closedAt?: string | null;
};

export type ChatMessage = {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};
