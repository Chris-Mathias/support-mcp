export const queryKeys = {
  projects: {
    all: () => ["projects"] as const,
  },
  sessions: {
    byProject: (projectId: string) => ["sessions", projectId] as const,
  },
  messages: {
    bySession: (sessionId: string) => ["messages", sessionId] as const,
  },
  documents: {
    byProject: (projectId: string) => ["documents", projectId] as const,
  },
  gitlab: {
    byProject: (projectId: string) => ["gitlab", projectId] as const,
  },
};
