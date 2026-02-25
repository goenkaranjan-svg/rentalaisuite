import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertProperty, type Property } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useProperties(status?: string, search?: string) {
  const queryParams = new URLSearchParams();
  if (status) queryParams.append("status", status);
  if (search) queryParams.append("search", search);

  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";

  return useQuery<Property[]>({
    queryKey: [api.properties.list.path, status, search],
    queryFn: async () => {
      const res = await fetch(api.properties.list.path + queryString, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch properties");
      return await res.json();
    },
  });
}

export function useProperty(id: number) {
  return useQuery<Property>({
    queryKey: [api.properties.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.properties.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch property");
      return await res.json();
    },
    enabled: !!id,
  });
}

export function useCreateProperty() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertProperty) => {
      const res = await fetch(api.properties.create.path, {
        method: api.properties.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        let message = "Failed to create property";
        try {
          const errorBody = await res.json();
          if (errorBody?.message) message = errorBody.message;
        } catch {
          // Ignore parse failure and keep default message.
        }
        throw new Error(message);
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.properties.list.path] });
      toast({ title: "Property Created", description: "Successfully added new property." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
