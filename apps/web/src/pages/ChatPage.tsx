import { FormEvent, useEffect, useRef, useState } from "react";
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
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [openMenuSessionId, setOpenMenuSessionId] = useState<string | null>(
    null,
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadProjects() {
    const response = await api.get<Project[]>("/projects");
    setProjects(response.data);
  }

  async function loadSessions(projectId: string) {
    setLoadingSessions(true);

    try {
      const response = await api.get<ChatSession[]>(
        `/projects/${projectId}/chat/sessions`,
      );

      setSessions(response.data);
    } catch {
      setError("Não foi possível carregar o histórico de sessões.");
    } finally {
      setLoadingSessions(false);
    }
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

    if (!selectedProjectId || !question || sendingMessage) return;

    setContent("");
    setSendingMessage(true);
    setError(null);

    try {
      let session = activeSession;

      if (!session) {
        const sessionResponse = await api.post<ChatSession>("/chat/sessions", {
          projectId: selectedProjectId,
        });

        session = sessionResponse.data;
        setActiveSession(session);
        setMessages([]);
      }

      const optimisticMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: question,
      } as ChatMessage;

      setMessages((currentMessages) => [...currentMessages, optimisticMessage]);

      setSessions((current) => {
        const alreadyExists = current.some((item) => item.id === session!.id);
        return alreadyExists ? current : [session!, ...current];
      });

      await api.post(`/chat/sessions/${session.id}/ask`, {
        projectId: selectedProjectId,
        question,
      });

      await loadMessages(session.id, selectedProjectId);
    } catch {
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
    setSessions([]);
    setError(null);

    if (projectId) {
      loadSessions(projectId);
    }
  }

  async function handleSelectSession(session: ChatSession) {
    if (!selectedProjectId) return;

    setActiveSession(session);
    setError(null);

    try {
      await loadMessages(session.id, selectedProjectId);
    } catch {
      setError("Não foi possível carregar as mensagens da sessão.");
    }
  }

  async function handleCloseSession(sessionId: string) {
    if (!selectedProjectId) return;

    setError(null);

    try {
      await api.patch(`/chat/sessions/${sessionId}/close`, {
        projectId: selectedProjectId,
      });

      setSessions((current) =>
        current.filter((session) => session.id !== sessionId),
      );

      if (activeSession?.id === sessionId) {
        setActiveSession(null);
        setMessages([]);
      }
    } catch {
      setError("Não foi possível excluir a sessão.");
    }
  }

  useEffect(() => {
    function handleClickOutside() {
      setOpenMenuSessionId(null);
    }

    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <div className="flex h-full bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <aside className="z-10 flex w-80 flex-none flex-col gap-6 border-r border-zinc-200 bg-white px-5 py-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col">
          <label className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Projeto
          </label>

          <select
            value={selectedProjectId}
            onChange={(e) => handleChangeProject(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-zinc-800 outline-none transition-all focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
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
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600"
          >
            <Play size={18} />
            {loadingSession ? "Iniciando..." : "Novo Chat"}
          </button>
        )}

        {selectedProjectId && (
          <div className="flex min-h-0 flex-col gap-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Histórico
            </div>

            {loadingSessions ? (
              <p className="text-sm text-zinc-400 dark:text-zinc-500">
                Carregando sessões...
              </p>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-zinc-400 dark:text-zinc-500">
                Nenhuma sessão anterior.
              </p>
            ) : (
              <div className="flex flex-col gap-[2px] overflow-y-auto">
                {sessions.map((session) => {
                  const isActive = activeSession?.id === session.id;
                  const isMenuOpen = openMenuSessionId === session.id;

                  return (
                    <div
                      key={session.id}
                      onClick={() => handleSelectSession(session)}
                      className={`group relative mr-2 flex items-center justify-between rounded-lg px-3 py-1 text-sm transition-colors ${
                        isActive
                          ? "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                          : "bg-white text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <label className="flex-1 truncate text-left font-medium">
                        Sessão {session.id.slice(0, 8)}
                      </label>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuSessionId((prev) =>
                              prev === session.id ? null : session.id,
                            );
                          }}
                          className="h-7 w-7 rounded p-1 opacity-0 transition-opacity hover:bg-zinc-100 group-hover:opacity-100 dark:hover:bg-zinc-700"
                        >
                          <span className="text-xl leading-none">⋯</span>
                        </button>

                        {isMenuOpen && (
                          <div className="absolute right-0 z-20 mt-2 w-36 rounded-md border border-zinc-200 bg-white shadow-md dark:border-zinc-700 dark:bg-zinc-800">
                            <button
                              type="button"
                              onClick={() => {
                                handleCloseSession(session.id);
                                setOpenMenuSessionId(null);
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                            >
                              Excluir chat
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </aside>

      <div className="flex h-full min-w-0 flex-1 flex-col">
        {error && (
          <div className="m-4 flex items-center gap-3 border-l-4 border-red-500 bg-red-50 p-4 dark:bg-red-950/40">
            <AlertCircle className="text-red-500 dark:text-red-400" size={20} />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          {!selectedProjectId ? (
            <div className="flex h-full flex-col items-center justify-center space-y-4 text-zinc-400 dark:text-zinc-500">
              <Bot size={64} className="opacity-20" />
              <p className="text-lg">Selecione um projeto para conversar.</p>
            </div>
          ) : !activeSession || messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center space-y-2 text-zinc-400 dark:text-zinc-500">
              <p className="text-center">
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
                    className={`flex max-w-[85%] gap-3 md:max-w-[75%] ${
                      isUser ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                        isUser
                          ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                          : "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-200"
                      }`}
                    >
                      {isUser ? <User size={18} /> : <Bot size={18} />}
                    </div>

                    <div
                      className={`flex flex-col gap-1 ${
                        isUser ? "items-end" : "items-start"
                      }`}
                    >
                      <span className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {isUser ? "Você" : "Assistente"}
                      </span>

                      <div
                        className={`overflow-hidden rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-sm ${
                          isUser
                            ? "rounded-tr-none bg-zinc-800 text-white dark:bg-zinc-700"
                            : "rounded-tl-none border border-zinc-100 bg-white text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
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
                                    className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-50"
                                    {...props}
                                  />
                                ),
                                h2: ({ node, ...props }) => (
                                  <h2
                                    className="mt-2 text-lg font-bold text-zinc-800 dark:text-zinc-200"
                                    {...props}
                                  />
                                ),
                                h3: ({ node, ...props }) => (
                                  <h3
                                    className="mt-2 text-base font-bold text-zinc-900 dark:text-zinc-200"
                                    {...props}
                                  />
                                ),
                                p: ({ node, ...props }) => (
                                  <p className="leading-relaxed" {...props} />
                                ),
                                ul: ({ node, ...props }) => (
                                  <ul
                                    className="ml-6 list-disc space-y-1"
                                    {...props}
                                  />
                                ),
                                ol: ({ node, ...props }) => (
                                  <ol
                                    className="ml-6 list-decimal space-y-1"
                                    {...props}
                                  />
                                ),
                                li: ({ node, ...props }) => (
                                  <li className="pl-1" {...props} />
                                ),
                                strong: ({ node, ...props }) => (
                                  <strong
                                    className="font-bold text-zinc-900 dark:text-white"
                                    {...props}
                                  />
                                ),
                                code: ({ node, ...props }) => (
                                  <code
                                    className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-red-700 dark:bg-zinc-800 dark:text-red-300"
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
              <div className="flex max-w-[85%] gap-3 md:max-w-[75%]">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-200">
                  <Bot size={18} />
                </div>

                <div className="flex flex-col items-start gap-1">
                  <span className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Assistente
                  </span>

                  <div className="rounded-2xl rounded-tl-none border border-zinc-100 bg-white px-5 py-4 text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                    Pensando...
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="flex-none border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <form
            onSubmit={handleSendMessage}
            className="relative mx-auto flex max-w-4xl items-end gap-2"
          >
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={1}
              className="max-h-32 min-h-[52px] w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 py-3.5 pl-4 pr-14 text-zinc-800 shadow-inner outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              placeholder="Digite a dúvida do suporte..."
              disabled={!selectedProjectId || sendingMessage}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />

            <button
              type="submit"
              disabled={!selectedProjectId || sendingMessage || !content.trim()}
              className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 text-white transition-colors hover:bg-zinc-700 disabled:bg-zinc-300 disabled:text-zinc-500 disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
            >
              {sendingMessage ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
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
