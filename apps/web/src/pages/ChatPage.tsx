import { FormEvent, useEffect, useRef, useState } from "react";
import { ChatComposer } from "../components/chat/ChatComposer";
import { ChatMessageList } from "../components/chat/ChatMessageList";
import { ChatSidebar } from "../components/chat/ChatSidebar";
import { WorkspacePage } from "../components/layout/WorkspacePage";
import { AlertBanner } from "../components/ui/AlertBanner";
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
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [streamingAssistantMessageId, setStreamingAssistantMessageId] =
    useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [openMenuSessionId, setOpenMenuSessionId] = useState<string | null>(
    null,
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamAbortRef = useRef<AbortController | null>(null);

  const canSendMessage =
    Boolean(selectedProjectId) && Boolean(content.trim()) && !sendingMessage;

  function abortActiveStream() {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
  }

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
        const storedProjectId = localStorage.getItem(selectedProjectStorageKey);

        if (storedProjectId) {
          loadSessions(storedProjectId);
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
    let currentStreamingMessageId: string | null = null;

    if (!selectedProjectId || !question || sendingMessage) {
      return;
    }

    abortActiveStream();
    const controller = new AbortController();
    streamAbortRef.current = controller;

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

      const streamingMessageId = `assistant-stream-${Date.now()}`;
      const streamingAssistantMessage: ChatMessage = {
        id: streamingMessageId,
        sessionId: session.id,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      };

      currentStreamingMessageId = streamingMessageId;

      setMessages((currentMessages) => [
        ...currentMessages,
        optimisticMessage,
        streamingAssistantMessage,
      ]);
      setStreamingAssistantMessageId(streamingMessageId);

      const response = await fetch(
        `${api.defaults.baseURL}/chat/sessions/${session.id}/ask/stream`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            projectId: selectedProjectId,
            question,
          }),
          credentials: "include",
          signal: controller.signal,
        },
      );

      let finalPayload: AskQuestionResponse | null = null;

      await readSupportStream<AskQuestionResponse>(
        response,
        (streamEvent) => {
          if (streamEvent.event === "delta") {
            setMessages((currentMessages) =>
              currentMessages.map((message) =>
                message.id === streamingMessageId
                  ? {
                      ...message,
                      content: streamEvent.data.content,
                    }
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

      // Stream abortado intencionalmente (troca de contexto)
      if (controller.signal.aborted) {
        setMessages((msgs) =>
          msgs.filter((m) => m.id !== currentStreamingMessageId),
        );
        return;
      }

      if (!finalPayload) {
        throw new Error("STREAM_DONE_EVENT_MISSING");
      }

      const completedPayload = finalPayload as AskQuestionResponse;

      if (completedPayload.session) {
        setActiveSession(completedPayload.session);

        setSessions((current) =>
          current.map((item) =>
            item.id === completedPayload.session!.id
              ? completedPayload.session!
              : item,
          ),
        );
      }

      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.id === streamingMessageId
            ? completedPayload.assistantMessage
            : message,
        ),
      );
    } catch (error) {
      // AbortError: fetch abortado antes de conectar — cleanup silencioso
      if (error instanceof DOMException && error.name === "AbortError") {
        setMessages((msgs) =>
          msgs.filter((m) => m.id !== currentStreamingMessageId),
        );
        return;
      }

      setContent(question);
      setMessages((currentMessages) =>
        currentMessages.filter(
          (message) => message.id !== currentStreamingMessageId,
        ),
      );
      setError("Não foi possível enviar a mensagem.");
    } finally {
      streamAbortRef.current = null;
      setSendingMessage(false);
      setStreamingAssistantMessageId(null);
      textareaRef.current?.focus();
    }
  }

  function handleChangeProject(projectId: string) {
    abortActiveStream();
    setSelectedProjectId(projectId);
    setActiveSession(null);
    setMessages([]);
    setSessions([]);
    setError(null);
    setOpenMenuSessionId(null);

    if (projectId) {
      localStorage.setItem(selectedProjectStorageKey, projectId);
      loadSessions(projectId).catch(() => {
        setError("Não foi possível carregar o histórico de sessões.");
      });
    } else {
      localStorage.removeItem(selectedProjectStorageKey);
    }
  }

  async function handleSelectSession(session: ChatSession) {
    if (!selectedProjectId || activeSession?.id === session.id) return;

    abortActiveStream();
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

    if (activeSession?.id === sessionId) {
      abortActiveStream();
    }

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

  return (
    <WorkspacePage
      sidebar={
        <ChatSidebar
          projects={projects}
          selectedProjectId={selectedProjectId}
          loadingSession={loadingSession}
          sessions={sessions}
          loadingSessions={loadingSessions}
          activeSessionId={activeSession?.id ?? null}
          openMenuSessionId={openMenuSessionId}
          onChangeProject={handleChangeProject}
          onStartSession={handleStartSession}
          onSelectSession={handleSelectSession}
          onCloseSession={handleCloseSession}
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
  );
}
