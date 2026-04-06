import { FormEvent, useEffect, useState } from "react";
import { api } from "../services/api";
import type { Project } from "../types/project";
import type { ChatMessage, ChatSession } from "../types/chat";

export function ChatPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  async function loadProjects() {
    const response = await api.get<Project[]>("/projects");
    setProjects(response.data);
  }

  async function loadMessages(sessionId: string, projectId: string) {
    const response = await api.get<ChatMessage[]>(
      `/chat/sessions/${sessionId}/messages`,
      {
        params: { projectId },
      },
    );

    setMessages(response.data);
  }

  useEffect(() => {
    loadProjects().catch(() => {
      setError("Não foi possível carregar os projetos.");
    });
  }, []);

  async function handleStartSession() {
    if (!selectedProjectId) {
      setError("Selecione um projeto antes de iniciar a sessão.");
      return;
    }

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

  async function handleSendMessage(event: FormEvent) {
    event.preventDefault();

    if (!activeSession || !selectedProjectId || !content.trim()) {
      return;
    }

    setSendingMessage(true);
    setError(null);

    try {
      await api.post(`/chat/sessions/${activeSession.id}/ask`, {
        projectId: selectedProjectId,
        question: content,
      });

      setContent("");
      await loadMessages(activeSession.id, selectedProjectId);
    } catch {
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
    <main style={{ fontFamily: "sans-serif", padding: 24, maxWidth: 960 }}>
      <h1>Chat por projeto</h1>

      <section style={{ marginBottom: 24 }}>
        <label>
          Projeto
          <br />
          <select
            value={selectedProjectId}
            onChange={(e) => handleChangeProject(e.target.value)}
            style={{ width: 320 }}
          >
            <option value="">Selecione um projeto</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <div style={{ marginTop: 12 }}>
          <button
            onClick={handleStartSession}
            disabled={!selectedProjectId || loadingSession}
          >
            {loadingSession ? "Iniciando..." : "Iniciar nova sessão"}
          </button>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>Sessão ativa</h2>
        {activeSession ? (
          <div>
            <div>Session ID: {activeSession.id}</div>
            <div>Project ID interno: {activeSession.projectId}</div>
            <div>
              Iniciada em: {new Date(activeSession.createdAt).toLocaleString()}
            </div>
          </div>
        ) : (
          <p>Nenhuma sessão ativa.</p>
        )}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>Mensagens</h2>

        {messages.length === 0 ? (
          <p>Nenhuma mensagem nesta sessão.</p>
        ) : (
          <ul>
            {messages.map((message) => (
              <li key={message.id} style={{ marginBottom: 12 }}>
                <strong>{message.role}</strong>: {message.content}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Enviar mensagem</h2>

        <form onSubmit={handleSendMessage}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            style={{ width: "100%", maxWidth: 700 }}
            placeholder="Digite a dúvida do suporte"
            disabled={!activeSession}
          />

          <div style={{ marginTop: 12 }}>
            <button type="submit" disabled={!activeSession || sendingMessage}>
              {sendingMessage ? "Enviando..." : "Enviar mensagem"}
            </button>
          </div>
        </form>
      </section>

      {error && <p style={{ marginTop: 16 }}>{error}</p>}
    </main>
  );
}
