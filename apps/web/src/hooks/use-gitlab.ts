import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/query-keys";
import { api } from "../services/api";
import type { GitlabIntegration } from "../types/gitlab";

export function useGitlabIntegration(projectId: string) {
  return useQuery({
    queryKey: queryKeys.gitlab.byProject(projectId),
    queryFn: async () => {
      try {
        const response = await api.get<GitlabIntegration>(
          `/projects/${projectId}/gitlab-integration`,
        );
        return response.data;
      } catch (error) {
        // 404 = not configured yet; return null instead of throwing
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

export function useSaveGitlabIntegration(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      repoUrl: string;
      projectPath: string;
      branch: string;
      token?: string;
    }) =>
      api
        .post<GitlabIntegration>(
          `/projects/${projectId}/gitlab-integration`,
          data,
        )
        .then((r) => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.gitlab.byProject(projectId), data);
    },
  });
}
