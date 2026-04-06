import { FormEvent, useEffect, useState } from "react";
import { api } from "../services/api";
import type { Project } from "../types/project";

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadProjects() {
    const response = await api.get<Project[]>("/projects");
    setProjects(response.data);
  }

  useEffect(() => {
    loadProjects().catch(() => {
      setError("Não foi possível carregar os projetos.");
    });
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.post("/projects", {
        name,
        description: description || undefined,
      });

      setName("");
      setDescription("");
      await loadProjects();
    } catch {
      setError("Não foi possível criar o projeto.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ fontFamily: "sans-serif", padding: 24, maxWidth: 900 }}>
      <h1>Projetos</h1>

      <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 12 }}>
          <label>
            Nome do projeto
            <br />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Suporte ERP Cliente A"
              style={{ width: 320 }}
            />
          </label>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>
            Descrição
            <br />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição opcional"
              style={{ width: 420 }}
            />
          </label>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Criando..." : "Criar projeto"}
        </button>
      </form>

      {error && <p>{error}</p>}

      <section>
        <h2>Lista de projetos</h2>

        {projects.length === 0 ? (
          <p>Nenhum projeto cadastrado.</p>
        ) : (
          <ul>
            {projects.map((project) => (
              <li key={project.id} style={{ marginBottom: 12 }}>
                <strong>{project.name}</strong>
                <div>ID interno: {project.id}</div>
                <div>Project ID: {project.projectId}</div>
                {project.description && (
                  <div>Descrição: {project.description}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
