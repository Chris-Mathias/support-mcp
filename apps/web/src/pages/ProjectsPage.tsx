import { FormEvent, useState } from "react";
import {
  Calendar,
  FolderKanban,
  FolderPlus,
  Info,
} from "lucide-react";
import { WorkspacePage } from "../components/layout/WorkspacePage";
import { AlertBanner } from "../components/ui/AlertBanner";
import { EmptyState } from "../components/ui/EmptyState";
import { Panel } from "../components/ui/Panel";
import { useCreateProject, useProjects } from "../hooks/use-projects";
import { getApiErrorMessage } from "../lib/errors";
import { formatDate } from "../lib/format";

export function ProjectsPage() {
  const projectsQuery = useProjects();
  const createProject = useCreateProject();
  const projects = projectsQuery.data ?? [];

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const error =
    (projectsQuery.error
      ? getApiErrorMessage(
          projectsQuery.error,
          "Não foi possível carregar os projetos.",
        )
      : null) ??
    (createProject.error
      ? getApiErrorMessage(
          createProject.error,
          "Não foi possível criar o projeto.",
        )
      : null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createProject.reset();
    try {
      await createProject.mutateAsync({
        name,
        description: description || undefined,
      });
      setName("");
      setDescription("");
    } catch {
      // error surfaced via createProject.error
    }
  }

  return (
    <WorkspacePage
      sidebar={
        <div className="flex flex-1 flex-col gap-5 px-5 py-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">
              Projetos
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Gerencie os projetos disponíveis para o suporte.
            </p>
          </div>

          {error ? <AlertBanner>{error}</AlertBanner> : null}

          <Panel className="p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-800 dark:text-zinc-100">
              <FolderPlus
                className="text-zinc-700 dark:text-zinc-300"
                size={20}
              />
              Novo Projeto
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Nome do projeto
                </label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ex.: Suporte ERP Cliente A"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-zinc-800 outline-none transition-all placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Descrição
                </label>
                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Descrição opcional"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-zinc-800 outline-none transition-all placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
              </div>

              <button
                type="submit"
                disabled={createProject.isPending || !name.trim()}
                className="w-full rounded-xl bg-zinc-800 px-6 py-2.5 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600"
              >
                {createProject.isPending ? "Criando..." : "Criar Projeto"}
              </button>
            </form>
          </Panel>

          <Panel className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Resumo
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                <FolderKanban size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">
                  {projects.length}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  projetos cadastrados
                </p>
              </div>
            </div>
          </Panel>
        </div>
      }
    >
      <div className="flex flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">
                Lista de projetos
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Estrutura base usada pelo suporte, documentos e integrações.
              </p>
            </div>
            <span className="text-sm text-zinc-400 dark:text-zinc-500">
              {projects.length} itens
            </span>
          </div>

          {projects.length === 0 ? (
            <Panel className="flex min-h-72 items-center justify-center">
              <EmptyState
                icon={FolderKanban}
                title="Nenhum projeto cadastrado ainda."
                description="Crie o primeiro projeto na coluna lateral para começar a configurar o suporte."
              />
            </Panel>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <Panel
                  key={project.id}
                  className="group relative p-5 transition-shadow hover:shadow-md"
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
                      <Calendar
                        size={16}
                        className="text-zinc-400 dark:text-zinc-500"
                      />
                      <span>{formatDate(project.createdAt)}</span>
                    </div>
                  </div>
                </Panel>
              ))}
            </div>
          )}
        </div>
      </div>
    </WorkspacePage>
  );
}
