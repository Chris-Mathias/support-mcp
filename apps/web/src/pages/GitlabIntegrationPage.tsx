import { useEffect, useState } from "react";
import {
  CheckCircle,
  GitBranch,
  RefreshCw,
  Save,
  Settings,
} from "lucide-react";
import { WorkspacePage } from "../components/layout/WorkspacePage";
import { AlertBanner } from "../components/ui/AlertBanner";
import { EmptyState } from "../components/ui/EmptyState";
import { Panel } from "../components/ui/Panel";
import { ProjectSelect } from "../components/ui/ProjectSelect";
import { useGitlabIntegration, useSaveGitlabIntegration } from "../hooks/use-gitlab";
import { useProjects } from "../hooks/use-projects";
import { getApiErrorMessage } from "../lib/errors";

export function GitlabIntegrationPage() {
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const [repoUrl, setRepoUrl] = useState("");
  const [projectPath, setProjectPath] = useState("");
  const [branch, setBranch] = useState("main");
  const [token, setToken] = useState("");

  const projectsQuery = useProjects();
  const gitlabQuery = useGitlabIntegration(selectedProjectId);
  const saveIntegration = useSaveGitlabIntegration(selectedProjectId);

  const projects = projectsQuery.data ?? [];
  const integration = gitlabQuery.data ?? null;

  // Sync form fields when integration data arrives or project changes
  useEffect(() => {
    if (integration) {
      setRepoUrl(integration.repoUrl);
      setProjectPath(integration.projectPath);
      setBranch(integration.branch);
      setToken("");
    } else {
      setRepoUrl("");
      setProjectPath("");
      setBranch("main");
      setToken("");
    }
  }, [integration]);

  const error =
    (saveIntegration.error
      ? getApiErrorMessage(saveIntegration.error, "Não foi possível salvar a integração.")
      : null) ??
    (gitlabQuery.error
      ? getApiErrorMessage(gitlabQuery.error, "Não foi possível carregar a integração.")
      : null);

  function handleProjectChange(projectId: string) {
    setSelectedProjectId(projectId);
    saveIntegration.reset();
  }

  async function handleSaveIntegration() {
    if (!selectedProjectId) return;

    saveIntegration.reset();
    try {
      await saveIntegration.mutateAsync({
        repoUrl,
        projectPath,
        branch,
        ...(token ? { token } : {}),
      });
      setToken("");
    } catch {
      // error surfaced via saveIntegration.error
    }
  }

  return (
    <WorkspacePage
      sidebar={
        <div className="flex flex-1 flex-col gap-5 px-5 py-6">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-800 dark:text-zinc-100">
              <Settings className="text-zinc-700 dark:text-zinc-300" />
              Integração GitLab
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Configure o repositório GitLab associado ao projeto.
            </p>
          </div>

          <ProjectSelect
            value={selectedProjectId}
            projects={projects}
            placeholder="Selecione..."
            disabled={projectsQuery.isLoading}
            onChange={handleProjectChange}
          />

          {integration ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle size={16} /> Integração ativa
            </div>
          ) : null}

          {selectedProjectId && !gitlabQuery.isLoading ? (
            <Panel className="p-5">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Repo URL
                  </label>
                  <input
                    value={repoUrl}
                    onChange={(event) => setRepoUrl(event.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 outline-none transition-all placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                    placeholder="https://gitlab.com/..."
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Project Path
                  </label>
                  <input
                    value={projectPath}
                    onChange={(event) => setProjectPath(event.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 outline-none transition-all placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                    placeholder="grupo/repo"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Branch
                  </label>
                  <input
                    value={branch}
                    onChange={(event) => setBranch(event.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 outline-none transition-all focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Token (Personal/Project)
                  </label>
                  <input
                    type="password"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 outline-none transition-all placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                    placeholder={
                      integration?.tokenConfigured
                        ? "Token salvo — preencha para alterar"
                        : "glpat-..."
                    }
                  />
                  {integration?.tokenConfigured ? (
                    <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                      Token configurado. Deixe em branco para manter o atual.
                    </p>
                  ) : null}
                </div>

                <button
                  onClick={handleSaveIntegration}
                  disabled={
                    saveIntegration.isPending ||
                    !repoUrl ||
                    !projectPath ||
                    (!integration?.tokenConfigured && !token)
                  }
                  className="flex items-center justify-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600"
                >
                  <Save size={16} />
                  {saveIntegration.isPending ? "Salvando..." : "Salvar Configuração"}
                </button>
              </div>
            </Panel>
          ) : null}
        </div>
      }
    >
      {error ? <AlertBanner className="m-4">{error}</AlertBanner> : null}

      {!selectedProjectId ? (
        <EmptyState
          icon={GitBranch}
          title="Selecione um projeto para configurar a integração."
          description="As configurações do repositório aparecem aqui depois que um projeto for escolhido."
          className="flex-1"
        />
      ) : gitlabQuery.isLoading ? (
        <div className="flex flex-1 items-center justify-center text-zinc-400 dark:text-zinc-500">
          <RefreshCw size={26} className="animate-spin" />
        </div>
      ) : !integration ? (
        <div className="flex flex-1 p-6">
          <Panel className="mx-auto flex w-full max-w-2xl items-center justify-center">
            <EmptyState
              icon={Settings}
              title="Preencha a configuração do GitLab na coluna lateral."
              description="Preencha a configuração do GitLab na coluna lateral para ativar a integração."
            />
          </Panel>
        </div>
      ) : (
        <div className="flex flex-1 items-start justify-center p-6">
          <Panel className="w-full max-w-2xl p-6">
            <div className="mb-6 flex items-center gap-3">
              <CheckCircle
                size={22}
                className="shrink-0 text-emerald-500 dark:text-emerald-400"
              />
              <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
                Repositório conectado
              </h2>
            </div>

            <dl className="mb-1 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
              <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                Repo URL
              </dt>
              <dd className="truncate text-zinc-800 dark:text-zinc-100">
                {integration.repoUrl}
              </dd>

              <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                Project Path
              </dt>
              <dd className="truncate font-mono text-zinc-800 dark:text-zinc-100">
                {integration.projectPath}
              </dd>

              <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                Branch
              </dt>
              <dd className="font-mono text-zinc-800 dark:text-zinc-100">
                {integration.branch}
              </dd>

              <dt className="font-medium text-zinc-500 dark:text-zinc-400">
                Configurado
              </dt>
              <dd className="text-zinc-800 dark:text-zinc-100">
                {new Date(integration.createdAt).toLocaleDateString("pt-BR")}
              </dd>
            </dl>
          </Panel>
        </div>
      )}
    </WorkspacePage>
  );
}
