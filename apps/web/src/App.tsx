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
    <div className="flex h-screen bg-gray-50 font-sans text-gray-800 overflow-hidden">
      <nav className="w-20 bg-white border-r border-gray-200 flex flex-col items-center py-6 gap-6 shadow-sm z-20 flex-shrink-0">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md mb-4">
          <span className="text-white font-bold text-xl">S</span>
        </div>
        
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            title={label}
            className={`p-3 rounded-xl transition-all duration-200 group relative ${
              activeTab === id
                ? "bg-indigo-50 text-indigo-600"
                : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            }`}
          >
            <Icon size={24} strokeWidth={activeTab === id ? 2.5 : 2} />
            <span className="absolute left-14 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {label}
            </span>
          </button>
        ))}
      </nav>

      <main className="flex-1 h-full overflow-hidden flex flex-col">
        {activeTab === "chat" && <ChatPage />}
        {activeTab === "projects" && <ProjectsPage />}
        {activeTab === "documents" && <DocumentsPage />}
        {activeTab === "gitlab" && <GitlabIntegrationPage />}
      </main>
    </div>
  );
}