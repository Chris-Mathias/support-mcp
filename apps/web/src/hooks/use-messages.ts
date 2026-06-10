import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../lib/query-keys";
import { api } from "../services/api";
import type { ChatMessage } from "../types/chat";

export function useMessages(sessionId: string, projectId: string) {
  return useQuery({
    queryKey: queryKeys.messages.bySession(sessionId),
    queryFn: async () => {
      const response = await api.get<ChatMessage[]>(
        `/chat/sessions/${sessionId}/messages`,
        { params: { projectId } },
      );
      return response.data;
    },
    enabled: !!sessionId && !!projectId,
    staleTime: Infinity,
  });
}
