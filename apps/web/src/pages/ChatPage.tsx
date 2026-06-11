import { FormEvent, useEffect, useRef, useState } from "react";
import { useMatch, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ChatComposer } from "../components/chat/ChatComposer";
import { ChatMessageList } from "../components/chat/ChatMessageList";
import { ChatSidebar } from "../components/chat/ChatSidebar";
import { WorkspacePage } from "../components/layout/WorkspacePage";
import { AlertBanner } from "../components/ui/AlertBanner";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { useMessages } from "../hooks/use-messages";
import { useProjects } from "../hooks/use-projects";
import { useSessionResolver } from "../hooks/use-session-resolver";
import { useSelectedProject } from "../hooks/use-selected-project";
import { useDeleteSession, useSessions } from "../hooks/use-sessions";
import { queryKeys } from "../lib/query-keys";
import { readSupportStream } from "../lib/chat-stream";
import { api } from "../services/api";
import type { ChatMessage, ChatSession } from "../types/chat";

type AskQuestionResponse = {
  answer: string;
  assistantMessage: ChatMessage;
  session?: ChatSession;
  toolHistory: unknown[];
};

export function ChatPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedProjectId, setSelectedProjectId } = useSelectedProject();

  // Active session comes from the URL — /chat/:sessionId
  const sessionMatch = useMatch("/chat/:sessionId");
  const activeSessionId = sessionMatch?.params.sessionId ?? "";

  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openMenuSessionId, setOpenMenuSessionId] = useState<string | null>(null);
  const [deletingSession, setDeletingSession] = useState<ChatSession | null>(null);

  // ─── Per-session streaming state ──────────────────────────────────────────

  const [sendingBySession, setSendingBySession] = useState<Set<string>>(new Set());
  const [streamingBySession, setStreamingBySession] = useState<Map<string, string | null>>(new Map());
  const streamsRef = useRef<Map<string, AbortController>>(new Map());

  // Kept in sync with activeSession to avoid stale closure reads in async handlers
  const activeSessionRef = useRef<ChatSession | null>(null);

  // ─── Server data via React Query ─────────────────────────────────────────

  const projectsQuery = useProjects();
  const sessionsQuery = useSessions(selectedProjectId);
  const deleteSessionMutation = useDeleteSession();

  // Cold-start resolver: when the page opens directly at /chat/:sessionId,
  // fetches the session once and hydrates project + sessions + messages caches.
  const sessionResolver = useSessionResolver(activeSessionId);

  const projects = projectsQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];

  // ─── Derived values ───────────────────────────────────────────────────────

  // Sessions load after selectedProjectId is set by the resolver — so this
  // correctly finds the session once both are ready.
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  const messagesQuery = useMessages(activeSessionId, selectedProjectId);
  const messages = messagesQuery.data ?? [];

  const sendingMessage = sendingBySession.has(activeSessionId);
  const streamingAssistantMessageId = streamingBySession.get(activeSessionId) ?? null;

  const canSendMessage =
    Boolean(selectedProjectId) &&
    Boolean(content.trim()) &&
    !sendingMessage &&
    !sessionsQuery.isLoading;

  const displayError =
    error ??
    (projectsQuery.isError ? "Não foi possível carregar os projetos." : null) ??
    (sessionsQuery.isError ? "Não foi possível carregar o histórico de sessões." : null) ??
    (messagesQuery.isError ? "Não foi possível carregar as mensagens da sessão." : null) ??
    (sessionResolver.isError ? "Sessão não encontrada." : null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  // Abort all streams on unmount (navigating away from /chat entirely)
  useEffect(() => {
    return () => {
      for (const controller of streamsRef.current.values()) {
        controller.abort();
      }
    };
  }, []);

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
    function handleClickOutside() {
      setOpenMenuSessionId(null);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenMenuSessionId(null);
    }
    window.addEventListener("click", handleClickOutside);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("click", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  // Auto-select the project when resolving a session URL on cold start.
  // Must live here — each useSelectedProject() call creates an independent
  // useState slot, so only this component can update its own selectedProjectId.
  useEffect(() => {
    if (!sessionResolver.data) return;
    const resolvedProjectId = sessionResolver.data.projectId;
    if (selectedProjectId !== resolvedProjectId) {
      setSelectedProjectId(resolvedProjectId);
    }
  }, [sessionResolver.data, selectedProjectId, setSelectedProjectId]);

  // Navigate away when a session URL points to a deleted or non-existent session
  useEffect(() => {
    if (sessionResolver.isSuccess && sessionResolver.data === null) {
      navigate("/chat", { replace: true });
    }
  }, [sessionResolver.isSuccess, sessionResolver.data, navigate]);

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function abortSessionStream(sessionId: string) {
    streamsRef.current.get(sessionId)?.abort();
    streamsRef.current.delete(sessionId);
  }

  function clearSessionCache(sessionId: string) {
    abortSessionStream(sessionId);
    queryClient.removeQueries({ queryKey: queryKeys.messages.bySession(sessionId) });
    setSendingBySession((s) => { const n = new Set(s); n.delete(sessionId); return n; });
    setStreamingBySession((m) => { const n = new Map(m); n.set(sessionId, null); return n; });
  }

  // ─── Session actions ──────────────────────────────────────────────────────

  function handleStartSession() {
    if (!selectedProjectId) return;
    if (activeSession) abortSessionStream(activeSession.id);
    navigate("/chat");
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

    if (!capturedProjectId || !question || sendingMessage || sessionsQuery.isLoading) {
      return;
    }

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

        // Pre-populate empty messages cache before the query becomes enabled
        queryClient.setQueryData<ChatMessage[]>(
          queryKeys.messages.bySession(session.id),
          [],
        );

        // Update URL — ChatPage stays mounted because /chat/:sessionId
        // is a child of the /chat parent route
        navigate("/chat/" + session.id);
        activeSessionRef.current = session;

        queryClient.setQueryData<ChatSession[]>(
          queryKeys.sessions.byProject(capturedProjectId),
          (current) => {
            const list = current ?? [];
            const alreadyExists = list.some((item) => item.id === session!.id);
            return alreadyExists ? list : [session!, ...list];
          },
        );
      }

      sessionId = session.id;
      const sid = sessionId;

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

      queryClient.setQueryData<ChatMessage[]>(
        queryKeys.messages.bySession(sid),
        (prev) => [...(prev ?? []), optimisticMessage, streamingAssistantMessage],
      );
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
            queryClient.setQueryData<ChatMessage[]>(
              queryKeys.messages.bySession(sid),
              (msgs) =>
                (msgs ?? []).map((message) =>
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

      if (controller.signal.aborted) {
        queryClient.setQueryData<ChatMessage[]>(
          queryKeys.messages.bySession(sid),
          (msgs) => (msgs ?? []).filter((m) => m.id !== currentStreamingMessageId),
        );
        return;
      }

      if (!finalPayload) {
        throw new Error("STREAM_DONE_EVENT_MISSING");
      }

      const completedPayload = finalPayload as AskQuestionResponse;

      if (completedPayload.session) {
        // Update session title in the sidebar list
        queryClient.setQueryData<ChatSession[]>(
          queryKeys.sessions.byProject(capturedProjectId),
          (current) =>
            (current ?? []).map((item) =>
              item.id === completedPayload.session!.id
                ? completedPayload.session!
                : item,
            ),
        );
        // activeSession is derived from sessions list — re-renders automatically
      }

      queryClient.setQueryData<ChatMessage[]>(
        queryKeys.messages.bySession(sid),
        (msgs) =>
          (msgs ?? []).map((message) =>
            message.id === streamingMessageId
              ? completedPayload.assistantMessage
              : message,
          ),
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        if (sessionId) {
          queryClient.setQueryData<ChatMessage[]>(
            queryKeys.messages.bySession(sessionId),
            (msgs) => (msgs ?? []).filter((m) => m.id !== currentStreamingMessageId),
          );
        }
        return;
      }

      setContent(question);
      if (sessionId) {
        queryClient.setQueryData<ChatMessage[]>(
          queryKeys.messages.bySession(sessionId),
          (msgs) => (msgs ?? []).filter((m) => m.id !== currentStreamingMessageId),
        );
      }
      setError("Não foi possível enviar a mensagem.");
    } finally {
      if (sessionId) {
        streamsRef.current.delete(sessionId);
        setSendingBySession((s) => { const n = new Set(s); n.delete(sessionId!); return n; });
        setStreamingBySession((m) => { const n = new Map(m); n.set(sessionId!, null); return n; });
        if (activeSessionRef.current?.id === sessionId) {
          textareaRef.current?.focus();
        }
      }
    }
  }

  function handleChangeProject(projectId: string) {
    setSelectedProjectId(projectId);
    setContent("");
    setError(null);
    setOpenMenuSessionId(null);
    navigate("/chat");
  }

  function handleSelectSession(session: ChatSession) {
    if (!selectedProjectId || activeSession?.id === session.id) return;
    navigate("/chat/" + session.id);
    setError(null);
    setOpenMenuSessionId(null);
    textareaRef.current?.focus();
  }

  async function handleDeleteSession() {
    if (!selectedProjectId || !deletingSession) return;

    const sessionId = deletingSession.id;
    abortSessionStream(sessionId);
    clearSessionCache(sessionId);
    setError(null);

    if (activeSession?.id === sessionId) {
      navigate("/chat", { replace: true });
    }

    try {
      await deleteSessionMutation.mutateAsync({
        sessionId,
        projectId: selectedProjectId,
      });
    } catch {
      setError("Não foi possível excluir a conversa.");
    } finally {
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
            loadingSessions={sessionsQuery.isLoading}
            activeSessionId={activeSessionId}
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
        {displayError ? (
          <AlertBanner className="m-4">{displayError}</AlertBanner>
        ) : null}

        <ChatMessageList
          selectedProjectId={selectedProjectId}
          loadingMessages={messagesQuery.isLoading}
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
          loading={deleteSessionMutation.isPending}
          onConfirm={handleDeleteSession}
          onCancel={() => setDeletingSession(null)}
        />
      ) : null}
    </>
  );
}
