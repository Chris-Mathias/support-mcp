import { useEffect, useState } from "react";
import axios from "axios";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AppHeader } from "./components/app/AppHeader";
import { ChatPage } from "./pages/ChatPage";
import { DocumentsPage } from "./pages/DocumentPage";
import { GitlabIntegrationPage } from "./pages/GitlabIntegrationPage";
import { LoginPage } from "./pages/LoginPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { api } from "./services/api";

type Theme = "light" | "dark";
type AuthState = "loading" | "authenticated" | "unauthenticated";

function PageLayout() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Outlet />
    </div>
  );
}

export function App() {
  const [authState, setAuthState] = useState<AuthState>("loading");
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
    <BrowserRouter>
      <div className="flex h-screen flex-col bg-zinc-50 font-sans text-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
        <AppHeader
          isDark={isDark}
          onToggleTheme={toggleTheme}
          onLogout={handleLogout}
        />
        <main className="flex flex-1 flex-col overflow-hidden">
          <Routes>
            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route element={<PageLayout />}>
              {/* /chat stays mounted when navigating between /chat and /chat/:sessionId */}
              <Route path="/chat" element={<ChatPage />}>
                <Route index />
                <Route path=":sessionId" />
              </Route>
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/gitlab" element={<GitlabIntegrationPage />} />
            </Route>
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
