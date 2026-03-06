import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type MultifamilySaleListing = {
  id: number;
  source: string;
  sourceListingId: string;
  formattedAddress: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string;
  state: string | null;
  stateFips: string | null;
  zipCode: string | null;
  county: string | null;
  countyFips: string | null;
  latitude: string | null;
  longitude: string | null;
  propertyType: string | null;
  bedrooms: string | null;
  bathrooms: string | null;
  squareFootage: number | null;
  lotSize: number | null;
  yearBuilt: number | null;
  status: string | null;
  price: string;
  listingType: string | null;
  daysOnMarket: number | null;
  listedDate: string | null;
  removedDate: string | null;
  createdDate: string | null;
  lastSeenDate: string | null;
  mlsName: string | null;
  mlsNumber: string | null;
  listingAgent: Record<string, unknown> | null;
  listingOffice: Record<string, unknown> | null;
  history: Record<string, unknown> | null;
  projectedAnnualReturn: string | null;
  listingUrl: string | null;
  photoUrl: string | null;
  currency: string;
  rawPayload: Record<string, unknown>;
  lastSyncedAt: string;
  createdAt: string | null;
};

export type MultifamilySaleFilters = {
  search?: string;
  city?: string;
  region?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
};

function buildQuery(filters?: MultifamilySaleFilters): string {
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

export function useMultifamilySaleListings(filters?: MultifamilySaleFilters) {
  const query = buildQuery(filters);
  return useQuery<MultifamilySaleListing[]>({
    queryKey: ["/api/investor/multifamily/listings", query],
    queryFn: async () => {
      const res = await fetch(`/api/investor/multifamily/listings${query}`, {
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Failed to fetch multifamily sale listings.");
      return body as MultifamilySaleListing[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

type MultifamilySyncResponse = {
  fetchedCount: number;
  storedCount: number;
  source: string;
  syncedAt: string;
};

export function useSyncMultifamilySaleData(filters?: MultifamilySaleFilters) {
  const queryClient = useQueryClient();
  const query = buildQuery(filters);
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/investor/multifamily/sync${query}`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Failed to sync multifamily sale listings.");
      return body as MultifamilySyncResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/investor/multifamily/listings"] });
    },
  });
}
