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
    <div className="h-full overflow-y-auto p-8 bg-gray-50">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Projetos</h1>
          <p className="text-gray-500 mt-1">
            Gerencie os projetos disponíveis para o suporte.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200">
            {error}
          </div>
        )}

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FolderPlus className="text-indigo-600" size={20} />
            Novo Projeto
          </h2>
          <form
            onSubmit={handleSubmit}
            className="flex flex-col md:flex-row gap-4 items-start md:items-end"
          >
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome do projeto
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Suporte ERP Cliente A"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                required
              />
            </div>
            <div className="flex-[2] w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição opcional"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full md:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? "Criando..." : "Criar Projeto"}
            </button>
          </form>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Lista de projetos
          </h2>
          {projects.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 text-gray-400">
              Nenhum projeto cadastrado ainda.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group relative"
                >
                  <h3 className="text-lg font-bold text-gray-800 mb-3 pr-8">
                    {project.name}
                  </h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-start gap-2">
                      <Info
                        size={16}
                        className="mt-0.5 text-gray-400 flex-shrink-0"
                      />
                      <span className="line-clamp-2">
                        {project.description || "Sem descrição"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Hash size={16} className="text-gray-400" />
                      <span className="truncate" title={project.projectId}>
                        Proj ID: {project.projectId}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-gray-400" />
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
