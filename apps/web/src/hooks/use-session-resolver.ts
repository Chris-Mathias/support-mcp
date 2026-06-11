import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { queryKeys } from "../lib/query-keys";
import { api } from "../services/api";
import type { ChatMessage, ChatSession } from "../types/chat";
import type { Project } from "../types/project";

export type SessionWithDetails = ChatSession & {
  messages: ChatMessage[];
  project: Project;
};

// Resolves a session from the URL on cold start:
// fetches GET /chat/sessions/:sessionId, then hydrates all related caches
// so messages and sidebar appear instantly.
// Project selection is intentionally left to the caller — each useState call
// creates an independent state slot, so only the component can update its own.
export function useSessionResolver(sessionId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["session-detail", sessionId],
    queryFn: async () => {
      try {
        const response = await api.get<SessionWithDetails>(
          `/chat/sessions/${sessionId}`,
        );
        return response.data;
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: !!sessionId,
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    if (!query.data) return;

    const { messages, project, ...session } = query.data;

    // Hydrate messages cache so they display without a separate fetch
    queryClient.setQueryData<ChatMessage[]>(
      queryKeys.messages.bySession(sessionId),
      messages,
    );

    // Show the resolved session immediately in the sidebar, then mark stale
    // so useSessions fetches the full list once selectedProjectId is set.
    queryClient.setQueryData<ChatSession[]>(
      queryKeys.sessions.byProject(session.projectId),
      (prev) => {
        const list = prev ?? [];
        return list.some((s) => s.id === session.id) ? list : [session, ...list];
      },
    );
    queryClient.invalidateQueries({
      queryKey: queryKeys.sessions.byProject(session.projectId),
      refetchType: "none",
    });

    // Seed projects list on cold start (nothing cached yet)
    queryClient.setQueryData<Project[]>(
      queryKeys.projects.all(),
      (prev) => (prev && prev.length > 0 ? prev : [project]),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  return query;
}
