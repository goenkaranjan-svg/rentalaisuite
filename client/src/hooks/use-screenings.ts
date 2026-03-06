import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { InsertScreening, Screening, ZillowLead } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export type ScreeningTenant = {
  id: string;
  name: string;
  email: string;
};

export type ScreeningOverview = {
  leads: ZillowLead[];
  screenings: Screening[];
  tenants: ScreeningTenant[];
  properties: Array<{
    id: number;
    address: string;
    city: string;
    state: string;
  }>;
  summary: {
    totalLeads: number;
    pendingLeads: number;
    activeScreenings: number;
    approvedScreenings: number;
  };
};

export function useScreeningOverview() {
  return useQuery<ScreeningOverview>({
    queryKey: [api.screenings.list.path],
    queryFn: async () => {
      const res = await fetch(api.screenings.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch screening data");
      return await res.json();
    },
  });
}

export function useCreateScreening() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: InsertScreening) => {
      const res = await fetch(api.screenings.create.path, {
        method: api.screenings.create.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Failed to create screening");
      return body as Screening;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.screenings.list.path] });
      toast({ title: "Screening Created", description: "Tenant screening request has been saved." });
    },
    onError: (error) => {
      toast({ title: "Create Failed", description: error.message, variant: "destructive" });
    },
  });
}
