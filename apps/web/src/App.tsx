import { useEffect, useState } from "react";
import {
  FileText,
  FolderKanban,
  GitBranch,
  MessageSquare,
} from "lucide-react";
import { AppHeader } from "./components/app/AppHeader";
import { ChatPage } from "./pages/ChatPage";
import { DocumentsPage } from "./pages/DocumentPage";
import { GitlabIntegrationPage } from "./pages/GitlabIntegrationPage";
import { ProjectsPage } from "./pages/ProjectsPage";

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
      <AppHeader
        navItems={navItems}
        activeTab={activeTab}
        isDark={isDark}
        onChangeTab={setActiveTab}
        onToggleTheme={toggleTheme}
      />

      <main className="flex flex-1 flex-col overflow-hidden">
        {activeTab === "chat" ? <ChatPage /> : null}
        {activeTab === "projects" ? <ProjectsPage /> : null}
        {activeTab === "documents" ? <DocumentsPage /> : null}
        {activeTab === "gitlab" ? <GitlabIntegrationPage /> : null}
      </main>
    </div>
  );
}
