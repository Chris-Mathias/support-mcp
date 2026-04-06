export type GitlabIntegration = {
  id: string;
  projectId: string;
  repoUrl: string;
  projectPath: string;
  branch: string;
  token: string;
  createdAt: string;
};

export type GitlabTreeItem = {
  id: string;
  name: string;
  type: "tree" | "blob";
  path: string;
  mode: string;
};

export type GitlabFileContent = {
  file_name: string;
  file_path: string;
  size: number;
  encoding: string;
  content: string;
  content_sha256: string;
  ref: string;
  blob_id: string;
  commit_id: string;
  last_commit_id: string;
  decodedContent: string;
};
