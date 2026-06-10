import { FormEvent, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChatComposer } from "../components/chat/ChatComposer";
import { ChatMessageList } from "../components/chat/ChatMessageList";
import { ChatSidebar } from "../components/chat/ChatSidebar";
import { WorkspacePage } from "../components/layout/WorkspacePage";
import { AlertBanner } from "../components/ui/AlertBanner";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { useSelectedProject } from "../contexts/selected-project";
import { useMessages } from "../hooks/use-messages";
import { useProjects } from "../hooks/use-projects";
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
  const queryClient = useQueryClient();
  const { selectedProjectId, setSelectedProjectId } = useSelectedProject();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openMenuSessionId, setOpenMenuSessionId] = useState<string | null>(null);
  const [deletingSession, setDeletingSession] = useState<ChatSession | null>(null);

  // ─── Per-project UI state ─────────────────────────────────────────────────

  // Active session per project — pure UI state, preserved when switching
  const [activeSessionByProject, setActiveSessionByProject] = useState<Map<string, ChatSession | null>>(new Map());

  // ─── Per-session streaming state ──────────────────────────────────────────

  const [sendingBySession, setSendingBySession] = useState<Set<string>>(new Set());
  const [streamingBySession, setStreamingBySession] = useState<Map<string, string | null>>(new Map());
  const streamsRef = useRef<Map<string, AbortController>>(new Map());

  // Ref kept in sync with activeSession to avoid stale closure reads in async handlers
  const activeSessionRef = useRef<ChatSession | null>(null);

  // ─── Server data via React Query ─────────────────────────────────────────

  const projectsQuery = useProjects();
  const sessionsQuery = useSessions(selectedProjectId);
  const deleteSessionMutation = useDeleteSession();

  const projects = projectsQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];

  // ─── Derived values ───────────────────────────────────────────────────────

  const activeSession = activeSessionByProject.get(selectedProjectId) ?? null;
  const activeSessionId = activeSession?.id ?? "";

  const messagesQuery = useMessages(activeSessionId, selectedProjectId);
  const messages = messagesQuery.data ?? [];

  const sendingMessage = sendingBySession.has(activeSessionId);
  const streamingAssistantMessageId = streamingBySession.get(activeSessionId) ?? null;

  const canSendMessage =
    Boolean(selectedProjectId) && Boolean(content.trim()) && !sendingMessage;

  const displayError =
    error ??
    (projectsQuery.isError ? "Não foi possível carregar os projetos." : null) ??
    (sessionsQuery.isError ? "Não foi possível carregar o histórico de sessões." : null) ??
    (messagesQuery.isError ? "Não foi possível carregar as mensagens da sessão." : null);

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

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function setProjectActiveSession(projectId: string, session: ChatSession | null) {
    setActiveSessionByProject((map) => {
      const next = new Map(map);
      next.set(projectId, session);
      return next;
    });
  }

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

        // Pre-populate empty messages cache before enabling the query to prevent
        // a spurious server fetch for the brand-new (empty) session
        queryClient.setQueryData<ChatMessage[]>(
          queryKeys.messages.bySession(session.id),
          [],
        );

        setProjectActiveSession(capturedProjectId, session);
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
        queryClient.setQueryData<ChatSession[]>(
          queryKeys.sessions.byProject(capturedProjectId),
          (current) =>
            (current ?? []).map((item) =>
              item.id === completedPayload.session!.id
                ? completedPayload.session!
                : item,
            ),
        );

        if (activeSessionRef.current?.id === sid) {
          setProjectActiveSession(capturedProjectId, completedPayload.session);
        }
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
    // React Query handles fetching via useSessions — cached if already loaded
  }

  function handleSelectSession(session: ChatSession) {
    if (!selectedProjectId || activeSession?.id === session.id) return;

    setProjectActiveSession(selectedProjectId, session);
    setError(null);
    setOpenMenuSessionId(null);
    textareaRef.current?.focus();
    // React Query fetches messages via useMessages if not already cached
  }

  async function handleDeleteSession() {
    if (!selectedProjectId || !deletingSession) return;

    const sessionId = deletingSession.id;
    abortSessionStream(sessionId);
    clearSessionCache(sessionId);
    setError(null);

    if (activeSession?.id === sessionId) {
      setProjectActiveSession(selectedProjectId, null);
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
