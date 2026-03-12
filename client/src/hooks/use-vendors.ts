import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type InsertVendor, type Vendor } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type DiscoverVendorInput = {
  propertyId?: number;
  city?: string;
  state?: string;
  zipCode?: string;
  trade: string;
  query?: string;
};

type DiscoverVendorResponse = {
  provider: string;
  candidates: Array<Omit<InsertVendor, "managerId">>;
};

export function useVendors(search?: string, trade?: string) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (trade) params.set("trade", trade);
  const path = params.size ? `${api.vendors.list.path}?${params.toString()}` : api.vendors.list.path;

  return useQuery<Vendor[]>({
    queryKey: [path],
    queryFn: async () => {
      const res = await fetch(path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch vendors");
      return await res.json();
    },
  });
}

export function useCreateVendor() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: InsertVendor) => {
      const res = await apiRequest(api.vendors.create.method, api.vendors.create.path, input);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.vendors.list.path] });
      toast({ title: "Vendor saved", description: "Vendor added to your directory." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useDiscoverVendors() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: DiscoverVendorInput) => {
      const res = await apiRequest(api.vendors.discover.method, api.vendors.discover.path, input);
      return await res.json() as Promise<DiscoverVendorResponse>;
    },
    onError: (error: Error) => {
      toast({ title: "Discovery failed", description: error.message, variant: "destructive" });
    },
  });
}

export function useImportVendorCandidate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (candidate: Omit<InsertVendor, "managerId">) => {
      const res = await apiRequest(api.vendors.importCandidate.method, api.vendors.importCandidate.path, { candidate });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.vendors.list.path] });
      toast({ title: "Vendor imported", description: "Discovery candidate added to your directory." });
    },
    onError: (error: Error) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });
}
