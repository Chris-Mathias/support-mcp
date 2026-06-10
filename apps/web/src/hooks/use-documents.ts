import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/query-keys";
import { api } from "../services/api";
import type { ProjectDocument } from "../types/document";

export function useDocuments(projectId: string) {
  return useQuery({
    queryKey: queryKeys.documents.byProject(projectId),
    queryFn: async () => {
      const response = await api.get<ProjectDocument[]>(
        `/projects/${projectId}/documents`,
      );
      return response.data;
    },
    enabled: !!projectId,
    staleTime: 30_000,
    refetchInterval: (query) => {
      const docs = query.state.data as ProjectDocument[] | undefined;
      const hasProcessing = docs?.some(
        (d) =>
          d.processingStatus === "PROCESSING" ||
          d.processingStatus === "PENDING",
      );
      return hasProcessing ? 3000 : false;
    },
  });
}

export function useUploadDocument(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.post(`/projects/${projectId}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.documents.byProject(projectId),
      }),
  });
}

export function useDeleteDocument(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) =>
      api.delete(`/projects/${projectId}/documents/${documentId}`),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.documents.byProject(projectId),
      }),
  });
}
