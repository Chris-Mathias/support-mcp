export type GitlabIntegration = {
  id: string;
  projectId: string;
  repoUrl: string;
  projectPath: string;
  branch: string;
  tokenConfigured: boolean;
  createdAt: string;
};
