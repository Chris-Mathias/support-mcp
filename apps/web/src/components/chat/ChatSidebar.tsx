import { MoreVertical, Play, Trash2 } from "lucide-react";
import type { Project } from "../../types/project";
import type { ChatSession } from "../../types/chat";
import { cn } from "../../lib/cn";
import { ProjectSelect } from "../ui/ProjectSelect";

type ChatSidebarProps = {
  projects: Project[];
  selectedProjectId: string;
  loadingSession: boolean;
  sessions: ChatSession[];
  loadingSessions: boolean;
  activeSessionId: string | null;
  openMenuSessionId: string | null;
  onChangeProject: (projectId: string) => void;
  onStartSession: () => void;
  onSelectSession: (session: ChatSession) => void;
  onCloseSession: (sessionId: string) => void;
  onToggleSessionMenu: (sessionId: string) => void;
};

export function ChatSidebar({
  projects,
  selectedProjectId,
  loadingSession,
  sessions,
  loadingSessions,
  activeSessionId,
  openMenuSessionId,
  onChangeProject,
  onStartSession,
  onSelectSession,
  onCloseSession,
  onToggleSessionMenu,
}: ChatSidebarProps) {
  return (
    <>
      <div className="flex flex-none flex-col gap-5 px-5 py-6">
        <ProjectSelect
          value={selectedProjectId}
          projects={projects}
          onChange={onChangeProject}
        />

        {selectedProjectId ? (
          <button
            type="button"
            onClick={onStartSession}
            disabled={loadingSession}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 font-medium text-white transition-colors hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600"
          >
            <Play size={18} />
            {loadingSession ? "Iniciando..." : "Novo Chat"}
          </button>
        ) : null}
      </div>

      {selectedProjectId ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 px-5 pb-6">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Histórico
            </div>

            {sessions.length > 0 ? (
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {sessions.length}
              </span>
            ) : null}
          </div>

          {loadingSessions ? (
            <p className="rounded-lg px-3 py-2 text-sm text-zinc-400 dark:text-zinc-500">
              Carregando sessões...
            </p>
          ) : sessions.length === 0 ? (
            <p className="rounded-lg px-3 py-2 text-sm text-zinc-400 dark:text-zinc-500">
              Nenhuma sessão anterior.
            </p>
          ) : (
            <div className="flex min-h-0 flex-col gap-[2px] overflow-y-auto pr-1">
              {sessions.map((session) => {
                const isActive = activeSessionId === session.id;
                const isMenuOpen = openMenuSessionId === session.id;

                return (
                  <div
                    key={session.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectSession(session)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectSession(session);
                      }
                    }}
                    className={cn(
                      "group relative flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none",
                      isActive
                        ? "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                        : "bg-white text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-left font-medium">
                      {session.title || `Sessão ${session.id.slice(0, 8)}`}
                    </span>

                    <div className="relative ml-2">
                      <button
                        type="button"
                        aria-label="Abrir opções da sessão"
                        aria-expanded={isMenuOpen}
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleSessionMenu(session.id);
                        }}
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded p-1 transition-opacity hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:hover:bg-zinc-700",
                          isMenuOpen
                            ? "opacity-100"
                            : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
                        )}
                      >
                        <MoreVertical size={16} />
                      </button>

                      {isMenuOpen ? (
                        <div
                          role="menu"
                          onClick={(event) => event.stopPropagation()}
                          className="absolute right-0 z-20 mt-2 w-40 rounded-md border border-zinc-200 bg-white shadow-md dark:border-zinc-700 dark:bg-zinc-800"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => onCloseSession(session.id)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:text-red-400 dark:hover:bg-red-950/40"
                          >
                            <Trash2 size={15} />
                            Excluir chat
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
