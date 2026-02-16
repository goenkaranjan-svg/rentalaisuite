import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertLease, type Lease } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useLeases() {
  return useQuery<Lease[]>({
    queryKey: [api.leases.list.path],
    queryFn: async () => {
      const res = await fetch(api.leases.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch leases");
      return await res.json();
    },
  });
}

export function useCreateLease() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertLease) => {
      const res = await fetch(api.leases.create.path, {
        method: api.leases.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create lease");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.leases.list.path] });
      toast({ title: "Lease Created", description: "New lease agreement active." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useGenerateLeaseDoc() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.leases.generateDoc.path, { id });
      const res = await fetch(url, {
        method: api.leases.generateDoc.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to generate document");
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Document Generated", description: "Lease agreement drafted by AI." });
    },
  });
}
