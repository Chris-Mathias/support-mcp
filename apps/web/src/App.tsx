import { useState } from "react";
import { ChatPage } from "./pages/ChatPage";
import { DocumentsPage } from "./pages/DocumentPage";
import { GitlabIntegrationPage } from "./pages/GitlabIntegrationPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { MessageSquare, FolderKanban, FileText, GitBranch } from "lucide-react";

type Tab = "chat" | "projects" | "documents" | "gitlab";

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  const navItems = [
    { id: "chat", label: "Suporte", icon: MessageSquare },
    { id: "projects", label: "Projetos", icon: FolderKanban },
    { id: "documents", label: "Documentos", icon: FileText },
    { id: "gitlab", label: "GitLab", icon: GitBranch },
  ] as const;

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans text-gray-800">
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow">
            <span className="text-white font-bold text-lg">S</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                activeTab === id
                  ? "bg-indigo-50 text-indigo-600"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              }`}
            >
              <Icon size={18} strokeWidth={activeTab === id ? 2.5 : 2} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col">
        {activeTab === "chat" && <ChatPage />}
        {activeTab === "projects" && <ProjectsPage />}
        {activeTab === "documents" && <DocumentsPage />}
        {activeTab === "gitlab" && <GitlabIntegrationPage />}
      </main>
    </div>
  );
}