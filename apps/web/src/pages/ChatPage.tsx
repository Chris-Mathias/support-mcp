import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import type { Project } from "../types/project";
import type { ChatMessage, ChatSession } from "../types/chat";
import {
  Send,
  Play,
  AlertCircle,
  Bot,
  User,
  MoreVertical,
  Trash2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

type AskQuestionResponse = {
  answer: string;
  assistantMessage: ChatMessage;
  session?: ChatSession;
  toolHistory: unknown[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function ChatPage() {
  const SELECTED_PROJECT_STORAGE_KEY = "chat:selectedProjectId";

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(() => {
    return localStorage.getItem(SELECTED_PROJECT_STORAGE_KEY) ?? "";
  });
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [typingAssistantMessage, setTypingAssistantMessage] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [openMenuSessionId, setOpenMenuSessionId] = useState<string | null>(
    null,
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedProject = projects.find(
    (project) => project.id === selectedProjectId,
  );

  const canSendMessage =
    Boolean(selectedProjectId) &&
    Boolean(content.trim()) &&
    !sendingMessage &&
    !typingAssistantMessage;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sendingMessage, typingAssistantMessage]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;

    el.style.overflowY = el.scrollHeight > 128 ? "auto" : "hidden";
  }, [content]);

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

  async function typeAssistantMessage(fullMessage: ChatMessage) {
    const fullContent = fullMessage.content ?? "";
    const chunkSize = 3;
    const delayMs = 12;

    setMessages((currentMessages) => [
      ...currentMessages,
      {
        ...fullMessage,
        content: "",
      },
    ]);

    for (let index = 0; index < fullContent.length; index += chunkSize) {
      const partialContent = fullContent.slice(0, index + chunkSize);

      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === fullMessage.id
            ? {
                ...message,
                content: partialContent,
              }
            : message,
        ),
      );

      await sleep(delayMs);
    }
  }

  useEffect(() => {
    loadProjects()
      .then(() => {
        const storedProjectId = localStorage.getItem(
          SELECTED_PROJECT_STORAGE_KEY,
        );

        if (storedProjectId) {
          loadSessions(storedProjectId);
        }
      })
      .catch(() => {
        setError("Não foi possível carregar os projetos.");
      });
  }, []);

  async function handleStartSession() {
    if (!selectedProjectId || loadingSession) return;

    setLoadingSession(true);
    setError(null);
    setOpenMenuSessionId(null);

    try {
      const response = await api.post<ChatSession>("/chat/sessions", {
        projectId: selectedProjectId,
      });

      setActiveSession(response.data);
      setMessages([]);

      setSessions((current) => {
        const alreadyExists = current.some(
          (session) => session.id === response.data.id,
        );

        return alreadyExists ? current : [response.data, ...current];
      });

      textareaRef.current?.focus();
    } catch {
      setError("Não foi possível iniciar a sessão.");
    } finally {
      setLoadingSession(false);
    }
  }

  async function handleSendMessage(event?: FormEvent) {
    event?.preventDefault();

    const question = content.trim();

    if (
      !selectedProjectId ||
      !question ||
      sendingMessage ||
      typingAssistantMessage
    ) {
      return;
    }

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

        setSessions((current) => {
          const alreadyExists = current.some((item) => item.id === session!.id);
          return alreadyExists ? current : [session!, ...current];
        });
      }

      const optimisticMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: question,
      } as ChatMessage;

      setMessages((currentMessages) => [...currentMessages, optimisticMessage]);

      const response = await api.post<AskQuestionResponse>(
        `/chat/sessions/${session.id}/ask`,
        {
          projectId: selectedProjectId,
          question,
        },
      );

      if (response.data.session) {
        setActiveSession(response.data.session);

        setSessions((current) =>
          current.map((item) =>
            item.id === response.data.session!.id
              ? response.data.session!
              : item,
          ),
        );
      }

      setSendingMessage(false);
      setTypingAssistantMessage(true);

      await typeAssistantMessage(response.data.assistantMessage);
    } catch {
      setContent(question);
      setError("Não foi possível enviar a mensagem.");
    } finally {
      setSendingMessage(false);
      setTypingAssistantMessage(false);
      textareaRef.current?.focus();
    }
  }

  function handleChangeProject(projectId: string) {
    setSelectedProjectId(projectId);
    setActiveSession(null);
    setMessages([]);
    setSessions([]);
    setError(null);
    setOpenMenuSessionId(null);

    if (projectId) {
      localStorage.setItem(SELECTED_PROJECT_STORAGE_KEY, projectId);
      loadSessions(projectId);
    } else {
      localStorage.removeItem(SELECTED_PROJECT_STORAGE_KEY);
    }
  }

  async function handleSelectSession(session: ChatSession) {
    if (!selectedProjectId || activeSession?.id === session.id) return;

    setActiveSession(session);
    setError(null);
    setOpenMenuSessionId(null);
    setLoadingMessages(true);

    try {
      await loadMessages(session.id, selectedProjectId);
      textareaRef.current?.focus();
    } catch {
      setError("Não foi possível carregar as mensagens da sessão.");
    } finally {
      setLoadingMessages(false);
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
    } finally {
      setOpenMenuSessionId(null);
    }
  }

  useEffect(() => {
    function handleClickOutside() {
      setOpenMenuSessionId(null);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenuSessionId(null);
      }
    }

    window.addEventListener("click", handleClickOutside);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("click", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="flex h-full bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <aside className="z-10 flex w-80 flex-none flex-col border-r border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-none flex-col gap-5 px-5 py-6">
          <div className="flex flex-col">
            <label
              htmlFor="project-select"
              className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
            >
              Projeto
            </label>

            <select
              id="project-select"
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
              type="button"
              onClick={handleStartSession}
              disabled={loadingSession}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600"
            >
              <Play size={18} />
              {loadingSession ? "Iniciando..." : "Novo Chat"}
            </button>
          )}
        </div>

        {selectedProjectId && (
          <div className="flex min-h-0 flex-1 flex-col gap-2 px-5 pb-6">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Histórico
              </div>

              {sessions.length > 0 && (
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {sessions.length}
                </span>
              )}
            </div>

            {loadingSessions ? (
              <p className="rounded-lg px-3 py-2 text-sm text-zinc-400 dark:text-zinc-500">
                Carregando sessões...
              </p>
            ) : sessions.length === 0 ? (
              <p className="rounded-lg px-3 py-2 text-sm text-zinc-400 dark:text-zinc-500">
                Nenhuma sessão anterior.
              </p>
            ) : (
              <div className="flex min-h-0 flex-col gap-[2px] overflow-y-auto pr-1">
                {sessions.map((session) => {
                  const isActive = activeSession?.id === session.id;
                  const isMenuOpen = openMenuSessionId === session.id;

                  return (
                    <div
                      key={session.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectSession(session)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleSelectSession(session);
                        }
                      }}
                      className={`group relative flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none ${
                        isActive
                          ? "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                          : "bg-white text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate text-left font-medium">
                        {session.title || `Sessão ${session.id.slice(0, 8)}`}
                      </span>

                      <div className="relative ml-2">
                        <button
                          type="button"
                          aria-label="Abrir opções da sessão"
                          aria-expanded={isMenuOpen}
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenMenuSessionId((prev) =>
                              prev === session.id ? null : session.id,
                            );
                          }}
                          className={`flex h-7 w-7 items-center justify-center rounded p-1 transition-opacity hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:hover:bg-zinc-700 ${
                            isMenuOpen
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                          }`}
                        >
                          <MoreVertical size={16} />
                        </button>

                        {isMenuOpen && (
                          <div
                            role="menu"
                            onClick={(event) => event.stopPropagation()}
                            className="absolute right-0 z-20 mt-2 w-40 rounded-md border border-zinc-200 bg-white shadow-md dark:border-zinc-700 dark:bg-zinc-800"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => handleCloseSession(session.id)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:text-red-400 dark:hover:bg-red-950/40"
                            >
                              <Trash2 size={15} />
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

      <main className="flex h-full min-w-0 flex-1 flex-col">
        {error && (
          <div className="m-4 flex items-start gap-3 border-l-4 border-red-500 bg-red-50 p-4 dark:bg-red-950/40">
            <AlertCircle
              className="mt-0.5 flex-none text-red-500 dark:text-red-400"
              size={20}
            />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          {!selectedProjectId ? (
            <div className="flex h-full flex-col items-center justify-center space-y-4 text-center text-zinc-400 dark:text-zinc-500">
              <Bot size={64} className="opacity-20" />
              <div>
                <p className="text-lg">Selecione um projeto para conversar.</p>
                <p className="mt-1 text-sm">
                  Depois disso, você poderá iniciar um novo chat ou abrir uma
                  sessão anterior.
                </p>
              </div>
            </div>
          ) : loadingMessages ? (
            <div className="flex h-full items-center justify-center text-sm text-zinc-400 dark:text-zinc-500">
              Carregando mensagens...
            </div>
          ) : !activeSession || messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center space-y-2 text-center text-zinc-400 dark:text-zinc-500">
              <Bot size={48} className="opacity-20" />
              <p>Digite sua dúvida de suporte abaixo.</p>
              <p className="text-sm">
                Pressione Enter para enviar ou Shift + Enter para quebrar linha.
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
                      className={`flex min-w-0 flex-col gap-1 ${
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
                          <div className="whitespace-pre-wrap break-words">
                            {message.content}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3 break-words">
                            <ReactMarkdown
                              components={{
                                h1: ({ node, ...props }) => (
                                  <h1
                                    className="mt-3 text-xl font-bold tracking-tight text-slate-950 dark:text-slate-50"
                                    {...props}
                                  />
                                ),

                                h2: ({ node, ...props }) => (
                                  <h2
                                    className="mt-4 border-l-4 border-indigo-500 pl-3 text-lg font-bold text-slate-900 dark:border-indigo-400 dark:text-slate-100"
                                    {...props}
                                  />
                                ),

                                h3: ({ node, ...props }) => (
                                  <h3
                                    className="mt-3 text-base font-semibold text-indigo-700 dark:text-indigo-300"
                                    {...props}
                                  />
                                ),

                                p: ({ node, ...props }) => (
                                  <p
                                    className="leading-relaxed text-slate-700 dark:text-slate-300"
                                    {...props}
                                  />
                                ),

                                ul: ({ node, ...props }) => (
                                  <ul
                                    className="ml-6 list-disc space-y-1 marker:text-indigo-500 dark:marker:text-indigo-400"
                                    {...props}
                                  />
                                ),

                                ol: ({ node, ...props }) => (
                                  <ol
                                    className="ml-6 list-decimal space-y-1 marker:font-semibold marker:text-indigo-600 dark:marker:text-indigo-400"
                                    {...props}
                                  />
                                ),

                                li: ({ node, ...props }) => (
                                  <li
                                    className="pl-1 text-slate-700 dark:text-slate-300"
                                    {...props}
                                  />
                                ),

                                strong: ({ node, ...props }) => (
                                  <strong
                                    className="font-semibold text-slate-950 dark:text-white"
                                    {...props}
                                  />
                                ),

                                a: ({ node, ...props }) => (
                                  <a
                                    className="font-medium text-indigo-600 underline decoration-indigo-300 underline-offset-4 transition-colors hover:text-indigo-700 hover:decoration-indigo-500 dark:text-indigo-300 dark:decoration-indigo-700 dark:hover:text-indigo-200"
                                    target="_blank"
                                    rel="noreferrer"
                                    {...props}
                                  />
                                ),

                                code: ({ node, ...props }) => (
                                  <code
                                    className="px-1.5 py-0.5 font-mono text-xs font-medium text-rose-600 dark:text-rose-500"
                                    {...props}
                                  />
                                ),

                                blockquote: ({ node, ...props }) => (
                                  <blockquote
                                    className="my-3 border-l-4 border-amber-400 bg-amber-50/70 px-4 py-2 italic text-slate-700 dark:border-amber-500 dark:bg-amber-950/20 dark:text-slate-300"
                                    {...props}
                                  />
                                ),

                                hr: ({ node, ...props }) => (
                                  <hr
                                    className="my-4 border-slate-200 dark:border-slate-700"
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
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 animate-[typingDot_1s_ease-in-out_infinite] rounded-full bg-current" />
                      <span className="h-2 w-2 animate-[typingDot_1s_ease-in-out_0.15s_infinite] rounded-full bg-current" />
                      <span className="h-2 w-2 animate-[typingDot_1s_ease-in-out_0.3s_infinite] rounded-full bg-current" />
                    </span>
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
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={1}
              className="max-h-32 min-h-[52px] w-full resize-none overflow-y-hidden rounded-2xl border border-zinc-200 bg-zinc-50 py-3.5 pl-4 pr-14 text-zinc-800 shadow-inner outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              placeholder="Digite a dúvida do suporte..."
              disabled={
                !selectedProjectId || sendingMessage || typingAssistantMessage
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />

            <button
              type="submit"
              aria-label="Enviar mensagem"
              disabled={!canSendMessage}
              className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 text-white transition-colors hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:bg-zinc-300 disabled:text-zinc-500 disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
            >
              {sendingMessage || typingAssistantMessage ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Send size={18} className="ml-1" />
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
