import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/query-keys";
import { api } from "../services/api";
import type { ChatSession } from "../types/chat";

export function useSessions(projectId: string) {
  return useQuery({
    queryKey: queryKeys.sessions.byProject(projectId),
    queryFn: async () => {
      const response = await api.get<ChatSession[]>(
        `/projects/${projectId}/chat/sessions`,
      );
      return response.data;
    },
    enabled: !!projectId,
    staleTime: Infinity,
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      projectId,
    }: {
      sessionId: string;
      projectId: string;
    }) =>
      api.delete(`/chat/sessions/${sessionId}`, { data: { projectId } }),
    onSuccess: (_, { sessionId, projectId }) => {
      queryClient.setQueryData<ChatSession[]>(
        queryKeys.sessions.byProject(projectId),
        (prev) => (prev ?? []).filter((s) => s.id !== sessionId),
      );
    },
  });
}
