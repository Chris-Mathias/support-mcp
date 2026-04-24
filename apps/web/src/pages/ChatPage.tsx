import { FormEvent, useEffect, useState, useRef } from "react";
import { api } from "../services/api";
import type { Project } from "../types/project";
import type { ChatMessage, ChatSession } from "../types/chat";
import { Send, Play, AlertCircle, Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";

export function ChatPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadProjects() {
    const response = await api.get<Project[]>("/projects");
    setProjects(response.data);
  }

  async function loadMessages(sessionId: string, projectId: string) {
    const response = await api.get<ChatMessage[]>(
      `/chat/sessions/${sessionId}/messages`,
      { params: { projectId } },
    );
    setMessages(response.data);
  }

  useEffect(() => {
    loadProjects().catch(() => {
      setError("Não foi possível carregar os projetos.");
    });
  }, []);

  async function handleStartSession() {
    if (!selectedProjectId) return;
    setLoadingSession(true);
    setError(null);
    try {
      const response = await api.post<ChatSession>("/chat/sessions", {
        projectId: selectedProjectId,
      });
      setActiveSession(response.data);
      setMessages([]);
    } catch {
      setError("Não foi possível iniciar a sessão.");
    } finally {
      setLoadingSession(false);
    }
  }

  async function handleSendMessage(event?: FormEvent) {
    event?.preventDefault();
    const question = content.trim();
    if (!activeSession || !selectedProjectId || !question || sendingMessage) {
      return;
    }
    const optimisticMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: question,
    } as ChatMessage;

    setMessages((currentMessages) => [...currentMessages, optimisticMessage]);
    setContent("");
    setSendingMessage(true);
    setError(null);

    try {
      await api.post(`/chat/sessions/${activeSession.id}/ask`, {
        projectId: selectedProjectId,
        question,
      });

      await loadMessages(activeSession.id, selectedProjectId);
    } catch {
      setMessages((currentMessages) =>
        currentMessages.filter(
          (message) => message.id !== optimisticMessage.id,
        ),
      );
      setContent(question);
      setError("Não foi possível enviar a mensagem.");
    } finally {
      setSendingMessage(false);
    }
  }

  function handleChangeProject(projectId: string) {
    setSelectedProjectId(projectId);
    setActiveSession(null);
    setMessages([]);
    setError(null);
  }

  return (
    <div className="flex h-full bg-[#f0f2f5]">
      <aside className="w-80 flex-none bg-white border-r border-gray-200 px-5 py-6 shadow-sm z-10 flex flex-col gap-6">
        <div className="flex flex-col">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Projeto
          </label>

          <select
            value={selectedProjectId}
            onChange={(e) => handleChangeProject(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all py-2 px-3"
          >
            <option value="">Selecione um projeto...</option>

            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        {selectedProjectId && (
          <button
            onClick={handleStartSession}
            disabled={loadingSession}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play size={18} />
            {loadingSession ? "Iniciando..." : "Nova Sessão"}
          </button>
        )}

        {activeSession && (
          <div className="mt-auto rounded-xl border border-green-100 bg-green-50 px-4 py-3">
            <div className="text-sm font-medium text-gray-800">
              Sessão Ativa
            </div>

            <div className="text-xs text-green-600 flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Online
            </div>
          </div>
        )}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col h-full">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 m-4 flex items-center gap-3">
            <AlertCircle className="text-red-500" size={20} />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {!activeSession ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
              <Bot size={64} className="opacity-20" />
              <p className="text-lg">
                Selecione um projeto e inicie uma sessão para conversar.
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
              <p className="text-center">
                Sessão iniciada!
                <br />
                Digite sua dúvida de suporte abaixo.
              </p>
            </div>
          ) : (
            messages.map((message) => {
              const isUser = message.role === "user";

              return (
                <div
                  key={message.id}
                  className={`flex w-full ${
                    isUser ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`flex max-w-[85%] md:max-w-[75%] gap-3 ${
                      isUser ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isUser
                          ? "bg-indigo-100 text-indigo-600"
                          : "bg-teal-100 text-teal-600"
                      }`}
                    >
                      {isUser ? <User size={18} /> : <Bot size={18} />}
                    </div>

                    <div
                      className={`flex flex-col gap-1 ${
                        isUser ? "items-end" : "items-start"
                      }`}
                    >
                      <span className="text-xs text-gray-500 px-1">
                        {isUser ? "Você" : "Assistente"}
                      </span>

                      <div
                        className={`px-5 py-4 rounded-2xl shadow-sm text-sm leading-relaxed overflow-hidden ${
                          isUser
                            ? "bg-indigo-600 text-white rounded-tr-none"
                            : "bg-white text-gray-800 border border-gray-100 rounded-tl-none"
                        }`}
                      >
                        {isUser ? (
                          <div className="whitespace-pre-wrap">
                            {message.content}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3">
                            <ReactMarkdown
                              components={{
                                h1: ({ node, ...props }) => (
                                  <h1
                                    className="text-xl font-bold mt-2"
                                    {...props}
                                  />
                                ),
                                h2: ({ node, ...props }) => (
                                  <h2
                                    className="text-lg font-bold mt-2 text-indigo-700"
                                    {...props}
                                  />
                                ),
                                h3: ({ node, ...props }) => (
                                  <h3
                                    className="text-base font-bold mt-2 text-indigo-900"
                                    {...props}
                                  />
                                ),
                                p: ({ node, ...props }) => (
                                  <p className="leading-relaxed" {...props} />
                                ),
                                ul: ({ node, ...props }) => (
                                  <ul
                                    className="list-disc space-y-1 ml-6"
                                    {...props}
                                  />
                                ),
                                ol: ({ node, ...props }) => (
                                  <ol
                                    className="list-decimal space-y-1 ml-6"
                                    {...props}
                                  />
                                ),
                                li: ({ node, ...props }) => (
                                  <li className="pl-1" {...props} />
                                ),
                                strong: ({ node, ...props }) => (
                                  <strong
                                    className="font-bold text-gray-900"
                                    {...props}
                                  />
                                ),
                                code: ({ node, ...props }) => (
                                  <code
                                    className="bg-gray-100 text-red-700 px-1.5 py-0.5 rounded text-xs font-mono"
                                    {...props}
                                  />
                                ),
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {sendingMessage && (
            <div className="flex w-full justify-start">
              <div className="flex max-w-[85%] md:max-w-[75%] gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-teal-100 text-teal-600">
                  <Bot size={18} />
                </div>

                <div className="flex flex-col gap-1 items-start">
                  <span className="text-xs text-gray-500 px-1">Assistente</span>
                  <div className="px-5 py-4 rounded-2xl shadow-sm text-sm bg-white text-gray-500 border border-gray-100 rounded-tl-none">
                    Pensando...
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="flex-none bg-white p-4 border-t border-gray-200">
          <form
            onSubmit={handleSendMessage}
            className="max-w-4xl mx-auto relative flex items-end gap-2"
          >
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={1}
              className="w-full max-h-32 min-h-[52px] bg-gray-50 border border-gray-200 text-gray-800 rounded-2xl pl-4 pr-14 py-3.5 focus:ring-2 focus:ring-indigo-500 outline-none resize-none shadow-inner"
              placeholder="Digite a dúvida do suporte..."
              disabled={!activeSession || sendingMessage}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />

            <button
              type="submit"
              disabled={!activeSession || sendingMessage || !content.trim()}
              className="absolute right-2 bottom-2 w-10 h-10 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:bg-gray-300 disabled:text-gray-500"
            >
              {sendingMessage ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send size={18} className="ml-1" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
