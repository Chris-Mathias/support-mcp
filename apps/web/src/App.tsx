import { ChatPage } from "./pages/ChatPage";
import { DocumentsPage } from "./pages/DocumentPage";
import { GitlabIntegrationPage } from "./pages/GitlabIntegrationPage";
import { ProjectsPage } from "./pages/ProjectsPage";

export function App() {
  return (
    <div className="h-screen">
      <GitlabIntegrationPage />
      <DocumentsPage />
      <ProjectsPage />
      <ChatPage />
    </div>
  );
}
