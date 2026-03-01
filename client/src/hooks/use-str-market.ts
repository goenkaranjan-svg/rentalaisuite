import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { StrMarketListing } from "@shared/schema";

type SyncResponse = {
  scrapedCount: number;
  storedCount: number;
  source: string;
  syncedAt: string;
};

export type StrMarketFilters = {
  search?: string;
  city?: string;
  region?: string;
  roomType?: string;
  minAnnualReturn?: number;
  maxNightlyRate?: number;
  minOccupancyRate?: number;
  limit?: number;
};

function buildStrMarketQuery(filters?: StrMarketFilters): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const str = String(value).trim();
    if (!str) return;
    params.set(key, str);
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function useStrMarketListings(filters?: StrMarketFilters) {
  const queryString = buildStrMarketQuery(filters);
  return useQuery<StrMarketListing[]>({
    queryKey: ["/api/str-market/listings", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/str-market/listings${queryString}`, { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Failed to fetch STR listings.");
      return body as StrMarketListing[];
    },
  });
}

export function useStrMarketListing(id: number) {
  return useQuery<StrMarketListing | null>({
    queryKey: ["/api/str-market/listings", id],
    enabled: Number.isFinite(id) && id > 0,
    queryFn: async () => {
      const res = await fetch(`/api/str-market/listings/${id}`, { credentials: "include" });
      if (res.status === 404) return null;
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Failed to fetch STR listing.");
      return body as StrMarketListing;
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
