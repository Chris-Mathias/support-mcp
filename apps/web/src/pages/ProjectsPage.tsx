import { FormEvent, useEffect, useState } from "react";
import { api } from "../services/api";
import type { Project } from "../types/project";
import { FolderPlus, Hash, Calendar, Info } from "lucide-react";

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
    loadProjects().catch(() =>
      setError("Não foi possível carregar os projetos."),
    );
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
    <div className="h-full overflow-y-auto bg-zinc-50 p-8 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-zinc-800 dark:text-zinc-100">
            Projetos
          </h1>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            Gerencie os projetos disponíveis para o suporte.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
            <FolderPlus
              className="text-zinc-700 dark:text-zinc-300"
              size={20}
            />
            Novo Projeto
          </h2>

          <form
            onSubmit={handleSubmit}
            className="flex flex-col items-start gap-4 md:flex-row md:items-end"
          >
            <div className="w-full flex-1">
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Nome do projeto
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Suporte ERP Cliente A"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-zinc-800 outline-none transition-all placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                required
              />
            </div>

            <div className="w-full flex-[2]">
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Descrição
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição opcional"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-zinc-800 outline-none transition-all placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full rounded-xl bg-zinc-800 px-6 py-2.5 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600 md:w-auto"
            >
              {loading ? "Criando..." : "Criar Projeto"}
            </button>
          </form>
        </div>

        <div>
          <h2 className="mb-4 text-xl font-semibold text-zinc-800 dark:text-zinc-100">
            Lista de projetos
          </h2>

          {projects.length === 0 ? (
            <div className="rounded-2xl border border-zinc-100 bg-white py-12 text-center text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
              Nenhum projeto cadastrado ainda.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="group relative rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <h3 className="mb-3 pr-8 text-lg font-bold text-zinc-800 dark:text-zinc-100">
                    {project.name}
                  </h3>

                  <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-start gap-2">
                      <Info
                        size={16}
                        className="mt-0.5 flex-shrink-0 text-zinc-400 dark:text-zinc-500"
                      />
                      <span className="line-clamp-2">
                        {project.description || "Sem descrição"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Hash
                        size={16}
                        className="text-zinc-400 dark:text-zinc-500"
                      />
                      <span className="truncate" title={project.projectId}>
                        Proj ID: {project.projectId}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar
                        size={16}
                        className="text-zinc-400 dark:text-zinc-500"
                      />
                      <span>
                        {new Date(project.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
