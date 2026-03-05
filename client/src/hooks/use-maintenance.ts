import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertMaintenanceRequest, type MaintenanceRequest } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useMaintenanceRequests(status?: string) {
  const queryParams = status ? `?status=${status}` : "";
  
  return useQuery<MaintenanceRequest[]>({
    queryKey: [api.maintenance.list.path, status],
    queryFn: async () => {
      const res = await fetch(api.maintenance.list.path + queryParams, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch maintenance requests");
      return await res.json();
    },
  });
}

export function useCreateMaintenanceRequest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertMaintenanceRequest) => {
      const res = await fetch(api.maintenance.create.path, {
        method: api.maintenance.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to submit request");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.maintenance.list.path] });
      toast({ title: "Request Submitted", description: "Maintenance team notified." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useAnalyzeMaintenance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.maintenance.analyze.path, { id });
      const res = await fetch(url, {
        method: api.maintenance.analyze.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to analyze request");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.maintenance.list.path] });
      toast({ title: "AI Analysis Complete", description: "Categorization updated." });
    },
  });
}

export function useUpdateMaintenanceRequest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<InsertMaintenanceRequest>) => {
      const url = buildUrl(api.maintenance.update.path, { id });
      const res = await fetch(url, {
        method: api.maintenance.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update request");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.maintenance.list.path] });
      toast({ title: "Request Updated", description: "Status changed successfully." });
    },
  });
}
