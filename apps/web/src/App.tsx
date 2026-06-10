import { useEffect, useState } from "react";
import axios from "axios";
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
import { LoginPage } from "./pages/LoginPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { SelectedProjectProvider } from "./contexts/selected-project";
import { api } from "./services/api";

type Tab = "chat" | "projects" | "documents" | "gitlab";
type Theme = "light" | "dark";
type AuthState = "loading" | "authenticated" | "unauthenticated";

const navItems = [
  { id: "chat", label: "Suporte", icon: MessageSquare },
  { id: "projects", label: "Projetos", icon: FolderKanban },
  { id: "documents", label: "Documentos", icon: FileText },
  { id: "gitlab", label: "GitLab", icon: GitBranch },
] as const;

export function App() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem("theme") === "dark" ? "dark" : "light",
  );

  const isDark = theme === "dark";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", theme);
  }, [theme, isDark]);

  useEffect(() => {
    api
      .get("/auth/me")
      .then(() => setAuthState("authenticated"))
      .catch((err) => {
        const is401 = axios.isAxiosError(err) && err.response?.status === 401;
        setAuthState(is401 ? "unauthenticated" : "authenticated");
      });
  }, []);

  useEffect(() => {
    const handler = () => setAuthState("unauthenticated");
    window.addEventListener("auth:unauthenticated", handler);
    return () => window.removeEventListener("auth:unauthenticated", handler);
  }, []);

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  async function handleLogout() {
    try {
      await api.post("/auth/logout");
    } finally {
      setAuthState("unauthenticated");
    }
  }

  if (authState === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 dark:border-zinc-700 dark:border-t-zinc-300" />
      </div>
    );
  }

  if (authState === "unauthenticated") {
    return <LoginPage onSuccess={() => setAuthState("authenticated")} />;
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-50 font-sans text-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
      <AppHeader
        navItems={navItems}
        activeTab={activeTab}
        isDark={isDark}
        onChangeTab={setActiveTab}
        onToggleTheme={toggleTheme}
        onLogout={handleLogout}
      />

      <main className="flex flex-1 flex-col overflow-hidden">
        <SelectedProjectProvider>
          <div className={activeTab === "chat" ? "flex flex-1 flex-col overflow-hidden" : "hidden"}>
            <ChatPage />
          </div>
          <div className={activeTab === "documents" ? "flex flex-1 flex-col overflow-hidden" : "hidden"}>
            <DocumentsPage />
          </div>
          <div className={activeTab === "gitlab" ? "flex flex-1 flex-col overflow-hidden" : "hidden"}>
            <GitlabIntegrationPage />
          </div>
        </SelectedProjectProvider>
        <div className={activeTab === "projects" ? "flex flex-1 flex-col overflow-hidden" : "hidden"}>
          <ProjectsPage />
        </div>
      </main>
    </div>
  );
}
