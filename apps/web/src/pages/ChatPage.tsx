import { FormEvent, useEffect, useRef, useState } from "react";
import { ChatComposer } from "../components/chat/ChatComposer";
import { ChatMessageList } from "../components/chat/ChatMessageList";
import { ChatSidebar } from "../components/chat/ChatSidebar";
import { WorkspacePage } from "../components/layout/WorkspacePage";
import { AlertBanner } from "../components/ui/AlertBanner";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { readSupportStream } from "../lib/chat-stream";
import { api } from "../services/api";
import type { ChatMessage, ChatSession } from "../types/chat";
import type { Project } from "../types/project";

type AskQuestionResponse = {
  answer: string;
  assistantMessage: ChatMessage;
  session?: ChatSession;
  toolHistory: unknown[];
};

export function ChatPage() {
  const selectedProjectStorageKey = "chat:selectedProjectId";

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(() => {
    return localStorage.getItem(selectedProjectStorageKey) ?? "";
  });
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [openMenuSessionId, setOpenMenuSessionId] = useState<string | null>(null);
  const [deletingSession, setDeletingSession] = useState<ChatSession | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  // ─── Per-project state ────────────────────────────────────────────────────

  // Sessions list per project — cached so switching back doesn't re-fetch
  const [sessionsByProject, setSessionsByProject] = useState<Map<string, ChatSession[]>>(new Map());
  // Active session per project — preserved when switching projects
  const [activeSessionByProject, setActiveSessionByProject] = useState<Map<string, ChatSession | null>>(new Map());
  // Which projects have had their sessions loaded (ref = no extra render)
  const loadedProjectsRef = useRef<Set<string>>(new Set());

  // ─── Per-session state ────────────────────────────────────────────────────

  // Messages per session — streams update their own slot in background
  const [messagesBySession, setMessagesBySession] = useState<Map<string, ChatMessage[]>>(new Map());
  // Sessions whose stream is currently active
  const [sendingBySession, setSendingBySession] = useState<Set<string>>(new Set());
  // Streaming message ID per session
  const [streamingBySession, setStreamingBySession] = useState<Map<string, string | null>>(new Map());
  // AbortControllers per session
  const streamsRef = useRef<Map<string, AbortController>>(new Map());

  // Ref kept in sync with activeSession to avoid stale closure reads in async handlers
  const activeSessionRef = useRef<ChatSession | null>(null);

  // ─── Derived values (same shape as before — child props unchanged) ────────

  const sessions = sessionsByProject.get(selectedProjectId) ?? [];
  const activeSession = activeSessionByProject.get(selectedProjectId) ?? null;
  const activeSessionId = activeSession?.id ?? "";
  const messages = messagesBySession.get(activeSessionId) ?? [];
  const sendingMessage = sendingBySession.has(activeSessionId);
  const streamingAssistantMessageId = streamingBySession.get(activeSessionId) ?? null;

  const canSendMessage =
    Boolean(selectedProjectId) && Boolean(content.trim()) && !sendingMessage;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    return () => {
      for (const controller of streamsRef.current.values()) {
        controller.abort();
      }
    };
  }, []);

  // ─── Per-project helpers ──────────────────────────────────────────────────

  function setProjectSessions(
    projectId: string,
    updater: (prev: ChatSession[]) => ChatSession[],
  ) {
    setSessionsByProject((map) => {
      const next = new Map(map);
      next.set(projectId, updater(next.get(projectId) ?? []));
      return next;
    });
  }

  function setProjectActiveSession(projectId: string, session: ChatSession | null) {
    setActiveSessionByProject((map) => {
      const next = new Map(map);
      next.set(projectId, session);
      return next;
    });
  }

  // ─── Per-session helpers ──────────────────────────────────────────────────

  function setSessionMessages(
    sessionId: string,
    updater: (prev: ChatMessage[]) => ChatMessage[],
  ) {
    setMessagesBySession((map) => {
      const next = new Map(map);
      next.set(sessionId, updater(next.get(sessionId) ?? []));
      return next;
    });
  }

  function abortSessionStream(sessionId: string) {
    streamsRef.current.get(sessionId)?.abort();
    streamsRef.current.delete(sessionId);
  }

  function clearSessionCache(sessionId: string) {
    abortSessionStream(sessionId);
    setMessagesBySession((m) => { const n = new Map(m); n.delete(sessionId); return n; });
    setSendingBySession((s) => { const n = new Set(s); n.delete(sessionId); return n; });
    setStreamingBySession((m) => { const n = new Map(m); n.delete(sessionId); return n; });
  }

  // ─── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sendingMessage]);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 128)}px`;
    element.style.overflowY = element.scrollHeight > 128 ? "auto" : "hidden";
  }, [content]);

  useEffect(() => {
    loadProjects()
      .then(() => {
        if (selectedProjectId) {
          loadSessions(selectedProjectId);
        }
      })
      .catch(() => {
        setError("Não foi possível carregar os projetos.");
      });
  }, []);

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

  // ─── Data fetching ────────────────────────────────────────────────────────

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
      setProjectSessions(projectId, () => response.data);
      loadedProjectsRef.current.add(projectId);
    } catch {
      setError("Não foi possível carregar o histórico de sessões.");
    } finally {
      setLoadingSessions(false);
    }
  }

  // ─── Session actions ──────────────────────────────────────────────────────

  function handleStartSession() {
    if (!selectedProjectId) return;

    if (activeSession) abortSessionStream(activeSession.id);
    setProjectActiveSession(selectedProjectId, null);
    setError(null);
    setOpenMenuSessionId(null);
    textareaRef.current?.focus();
  }

  async function handleSendMessage(event?: FormEvent) {
    event?.preventDefault();

    const question = content.trim();
    const capturedProjectId = selectedProjectId;
    let currentStreamingMessageId: string | null = null;
    let sessionId: string | null = null;

    if (!capturedProjectId || !question || sendingMessage) {
      return;
    }

    // Abort any in-progress stream for this specific session (re-send scenario)
    if (activeSession) abortSessionStream(activeSession.id);

    const controller = new AbortController();

    setContent("");
    setError(null);

    try {
      let session = activeSession;

      if (!session) {
        const sessionResponse = await api.post<ChatSession>("/chat/sessions", {
          projectId: capturedProjectId,
        });

        session = sessionResponse.data;
        setProjectActiveSession(capturedProjectId, session);
        activeSessionRef.current = session;

        setProjectSessions(capturedProjectId, (current) => {
          const alreadyExists = current.some((item) => item.id === session!.id);
          return alreadyExists ? current : [session!, ...current];
        });
      }

      sessionId = session.id;
      const sid = sessionId; // non-nullable alias for use within this block

      // Register the stream before any await so concurrent sends see it
      streamsRef.current.set(sid, controller);
      setSendingBySession((s) => new Set(s).add(sid));

      const optimisticMessage: ChatMessage = {
        id: `temp-${crypto.randomUUID()}`,
        role: "user",
        content: question,
      } as ChatMessage;

      const streamingMessageId = `assistant-stream-${crypto.randomUUID()}`;
      const streamingAssistantMessage: ChatMessage = {
        id: streamingMessageId,
        sessionId: sid,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      };

      currentStreamingMessageId = streamingMessageId;

      setSessionMessages(sid, (prev) => [
        ...prev,
        optimisticMessage,
        streamingAssistantMessage,
      ]);
      setStreamingBySession((m) => new Map(m).set(sid, streamingMessageId));

      const response = await fetch(
        `${api.defaults.baseURL}/chat/sessions/${sid}/ask/stream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: capturedProjectId, question }),
          credentials: "include",
          signal: controller.signal,
        },
      );

      let finalPayload: AskQuestionResponse | null = null;

      await readSupportStream<AskQuestionResponse>(
        response,
        (streamEvent) => {
          if (streamEvent.event === "delta") {
            setSessionMessages(sid, (msgs) =>
              msgs.map((message) =>
                message.id === streamingMessageId
                  ? { ...message, content: streamEvent.data.content }
                  : message,
              ),
            );
            return;
          }

          if (streamEvent.event === "done") {
            finalPayload = streamEvent.data;
            return;
          }

          if (streamEvent.event === "error") {
            throw new Error(
              streamEvent.data.message || "Não foi possível enviar a mensagem.",
            );
          }
        },
        controller.signal,
      );

      // Stream abortado intencionalmente (exclusão de sessão)
      if (controller.signal.aborted) {
        setSessionMessages(sid, (msgs) =>
          msgs.filter((m) => m.id !== currentStreamingMessageId),
        );
        return;
      }

      if (!finalPayload) {
        throw new Error("STREAM_DONE_EVENT_MISSING");
      }

      const completedPayload = finalPayload as AskQuestionResponse;

      if (completedPayload.session) {
        // Always update the title in the sidebar list for the originating project
        setProjectSessions(capturedProjectId, (current) =>
          current.map((item) =>
            item.id === completedPayload.session!.id
              ? completedPayload.session!
              : item,
          ),
        );

        // Only update activeSession if the user is still viewing this session
        if (activeSessionRef.current?.id === sid) {
          setProjectActiveSession(capturedProjectId, completedPayload.session);
        }
      }

      setSessionMessages(sid, (msgs) =>
        msgs.map((message) =>
          message.id === streamingMessageId
            ? completedPayload.assistantMessage
            : message,
        ),
      );
    } catch (error) {
      // AbortError: fetch abortado antes de conectar — cleanup silencioso
      if (error instanceof DOMException && error.name === "AbortError") {
        if (sessionId) {
          setSessionMessages(sessionId, (msgs) =>
            msgs.filter((m) => m.id !== currentStreamingMessageId),
          );
        }
        return;
      }

      setContent(question);
      if (sessionId) {
        setSessionMessages(sessionId, (msgs) =>
          msgs.filter((m) => m.id !== currentStreamingMessageId),
        );
      }
      setError("Não foi possível enviar a mensagem.");
    } finally {
      if (sessionId) {
        streamsRef.current.delete(sessionId);
        setSendingBySession((s) => { const n = new Set(s); n.delete(sessionId!); return n; });
        setStreamingBySession((m) => { const n = new Map(m); n.set(sessionId!, null); return n; });
        // Only refocus if the user is still viewing this session
        if (activeSessionRef.current?.id === sessionId) {
          textareaRef.current?.focus();
        }
      }
    }
  }

  function handleChangeProject(projectId: string) {
    // Do NOT abort streams — let them continue in background
    setSelectedProjectId(projectId);
    setContent("");
    setError(null);
    setOpenMenuSessionId(null);

    if (projectId) {
      localStorage.setItem(selectedProjectStorageKey, projectId);
      // Only fetch if this project's sessions haven't been loaded yet
      if (!loadedProjectsRef.current.has(projectId)) {
        loadSessions(projectId).catch(() => {
          setError("Não foi possível carregar o histórico de sessões.");
        });
      }
    } else {
      localStorage.removeItem(selectedProjectStorageKey);
    }
  }

  async function handleSelectSession(session: ChatSession) {
    if (!selectedProjectId || activeSession?.id === session.id) return;

    // Do NOT abort — let any in-progress stream continue in the background
    setProjectActiveSession(selectedProjectId, session);
    setError(null);
    setOpenMenuSessionId(null);

    // If messages are already cached (active stream or previous visit), just switch the view
    if (messagesBySession.has(session.id)) {
      textareaRef.current?.focus();
      return;
    }

    setLoadingMessages(true);

    try {
      const response = await api.get<ChatMessage[]>(
        `/chat/sessions/${session.id}/messages`,
        { params: { projectId: selectedProjectId } },
      );
      setSessionMessages(session.id, () => response.data);
      textareaRef.current?.focus();
    } catch {
      setError("Não foi possível carregar as mensagens da sessão.");
    } finally {
      setLoadingMessages(false);
    }
  }

  async function handleCloseSession(sessionId: string) {
    if (!selectedProjectId) return;

    abortSessionStream(sessionId);
    clearSessionCache(sessionId);
    setError(null);

    try {
      await api.patch(`/chat/sessions/${sessionId}/close`, {
        projectId: selectedProjectId,
      });

      setProjectSessions(selectedProjectId, (current) =>
        current.filter((session) => session.id !== sessionId),
      );

      if (activeSession?.id === sessionId) {
        setProjectActiveSession(selectedProjectId, null);
      }
    } catch {
      setError("Não foi possível fechar a sessão.");
    } finally {
      setOpenMenuSessionId(null);
    }
  }

  async function handleDeleteSession() {
    if (!selectedProjectId || !deletingSession) return;

    const sessionId = deletingSession.id;
    abortSessionStream(sessionId);
    clearSessionCache(sessionId);

    setIsDeletingSession(true);
    setError(null);

    try {
      await api.delete(`/chat/sessions/${sessionId}`, {
        data: { projectId: selectedProjectId },
      });

      setProjectSessions(selectedProjectId, (current) =>
        current.filter((session) => session.id !== sessionId),
      );

      if (activeSession?.id === sessionId) {
        setProjectActiveSession(selectedProjectId, null);
      }
    } catch {
      setError("Não foi possível excluir a conversa.");
    } finally {
      setIsDeletingSession(false);
      setDeletingSession(null);
    }
  }

  return (
    <>
      <WorkspacePage
        sidebar={
          <ChatSidebar
            projects={projects}
            selectedProjectId={selectedProjectId}
            sessions={sessions}
            loadingSessions={loadingSessions}
            activeSessionId={activeSession?.id ?? null}
            openMenuSessionId={openMenuSessionId}
            sendingBySession={sendingBySession}
            onChangeProject={handleChangeProject}
            onStartSession={handleStartSession}
            onSelectSession={handleSelectSession}
            onRequestDeleteSession={(session) => setDeletingSession(session)}
            onToggleSessionMenu={(sessionId) =>
              setOpenMenuSessionId((current) =>
                current === sessionId ? null : sessionId,
              )
            }
          />
        }
      >
        {error ? <AlertBanner className="m-4">{error}</AlertBanner> : null}

        <ChatMessageList
          selectedProjectId={selectedProjectId}
          loadingMessages={loadingMessages}
          hasActiveSession={Boolean(activeSession)}
          messages={messages}
          sendingMessage={sendingMessage}
          streamingAssistantMessageId={streamingAssistantMessageId}
          messagesEndRef={messagesEndRef}
        />

        <ChatComposer
          value={content}
          canSendMessage={canSendMessage}
          disabled={!selectedProjectId || sendingMessage}
          textareaRef={textareaRef}
          loading={sendingMessage}
          onChange={setContent}
          onSubmit={handleSendMessage}
        />
      </WorkspacePage>

      {deletingSession ? (
        <ConfirmDialog
          title="Excluir conversa?"
          description={`"${deletingSession.title ?? "Novo Chat"}" será movida para a lixeira e removida permanentemente após 30 dias.`}
          loading={isDeletingSession}
          onConfirm={handleDeleteSession}
          onCancel={() => setDeletingSession(null)}
        />
      ) : null}
    </>
  );
}
