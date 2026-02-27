import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { StrMarketListing } from "@shared/schema";

type SyncResponse = {
  scrapedCount: number;
  storedCount: number;
  source: string;
  syncedAt: string;
};

export function useStrMarketListings() {
  return useQuery<StrMarketListing[]>({
    queryKey: ["/api/str-market/listings"],
    queryFn: async () => {
      const res = await fetch("/api/str-market/listings", { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Failed to fetch STR listings.");
      return body as StrMarketListing[];
    },
  });
}

export function useSyncStrMarketData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/str-market/sync", {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Failed to sync STR market data.");
      return body as SyncResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/str-market/listings"] });
    },
  });
}

