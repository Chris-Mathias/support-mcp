import { useEffect, useState } from "react";
import { ChatPage } from "./pages/ChatPage";
import { DocumentsPage } from "./pages/DocumentPage";
import { GitlabIntegrationPage } from "./pages/GitlabIntegrationPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import {
  MessageSquare,
  FolderKanban,
  FileText,
  GitBranch,
  Moon,
  Sun,
} from "lucide-react";

type Tab = "chat" | "projects" | "documents" | "gitlab";
type Theme = "light" | "dark";

const navItems = [
  { id: "chat", label: "Suporte", icon: MessageSquare },
  { id: "projects", label: "Projetos", icon: FolderKanban },
  { id: "documents", label: "Documentos", icon: FileText },
  { id: "gitlab", label: "GitLab", icon: GitBranch },
] as const;

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem("theme") === "dark" ? "dark" : "light",
  );

  const isDark = theme === "dark";

  function toggleTheme() {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  }

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", theme);
  }, [theme, isDark]);

  return (
    <div className="flex h-screen flex-col bg-zinc-50 font-sans text-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 shadow dark:bg-zinc-700">
            <span className="text-lg font-bold text-white">S</span>
          </div>
        </div>

        <nav className="flex items-center gap-2">
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;

            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                  isActive
                    ? "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </nav>
      </header>

      <main className="flex flex-1 flex-col overflow-hidden">
        {activeTab === "chat" && <ChatPage />}
        {activeTab === "projects" && <ProjectsPage />}
        {activeTab === "documents" && <DocumentsPage />}
        {activeTab === "gitlab" && <GitlabIntegrationPage />}
      </main>
    </div>
  );
}