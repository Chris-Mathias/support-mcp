import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/query-keys";
import { api } from "../services/api";
import type { Project } from "../types/project";

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects.all(),
    queryFn: async () => {
      const response = await api.get<Project[]>("/projects");
      return response.data;
    },
    staleTime: 30_000,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      api.post("/projects", data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() }),
  });
}
