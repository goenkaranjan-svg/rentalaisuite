import type { InsertVendor, Property, Vendor } from "@shared/schema";

type VendorDiscoveryInput = {
  property?: Property;
  city?: string;
  state?: string;
  zipCode?: string;
  trade: string;
  query?: string;
};

type VendorDiscoveryResult = {
  provider: string;
  candidates: Array<Omit<InsertVendor, "managerId">>;
};

function normalizeTrade(trade: string): string {
  return trade.trim().toLowerCase();
}

function normalizeState(state?: string | null): string | undefined {
  if (!state) return undefined;
  return state.trim().toUpperCase();
}

function normalizePhone(input?: string | null): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return input;
}

function inferTrades(trade: string): string[] {
  const normalized = normalizeTrade(trade);
  if (normalized.includes("plumb")) return ["plumbing"];
  if (normalized.includes("electric")) return ["electrical"];
  if (normalized.includes("hvac") || normalized.includes("air")) return ["hvac"];
  if (normalized.includes("appliance")) return ["appliance"];
  if (normalized.includes("pest")) return ["pest"];
  if (normalized.includes("lock") || normalized.includes("security")) return ["security"];
  return [normalized || "general"];
}

function buildSearchText(input: VendorDiscoveryInput): string {
  return input.query?.trim()
    || `${input.trade} near ${input.property?.zipCode || input.zipCode || `${input.property?.city || input.city}, ${input.property?.state || input.state}`}`;
}

function mapGeoapifyCandidate(
  item: Record<string, any>,
  input: VendorDiscoveryInput,
): Omit<InsertVendor, "managerId"> {
  const state = normalizeState(input.property?.state || input.state);
  const city = input.property?.city || input.city || null;
  const zipCode = input.property?.zipCode || input.zipCode || null;
  const location = item.formatted || [item.address_line1, item.city, item.state, item.postcode].filter(Boolean).join(", ");
  return {
    name: item.name || item.address_line1 || "Unknown vendor",
    tradeCategories: inferTrades(input.trade),
    serviceStates: state ? [state] : [],
    serviceCities: city ? [city] : [],
    serviceZipCodes: zipCode ? [zipCode] : [],
    phone: normalizePhone(item.datasource?.raw?.contact?.phone || item.datasource?.raw?.phone || null),
    email: null,
    website: item.website || item.datasource?.raw?.website || null,
    rating: null,
    reviewCount: null,
    licenseNumber: null,
    insuranceExpiry: null,
    isOnCall: false,
    isActive: true,
    source: "geoapify_places",
    sourceExternalId: item.place_id || item.datasource?.raw?.place_id || item.datasource?.raw?.osm_id || null,
    confidenceScore: item.rank?.confidence ? String(Math.min(0.99, Number(item.rank.confidence))) : "0.520",
    rawIntakeData: {
      location,
      categories: item.categories,
      datasource: item.datasource?.sourcename || item.datasource?.raw?.osm_type || "geoapify",
    },
  };
}

async function discoverFromGeoapify(input: VendorDiscoveryInput): Promise<VendorDiscoveryResult | null> {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({
    text: buildSearchText(input),
    apiKey,
    limit: "10",
    format: "json",
  });

  const response = await fetch(`https://api.geoapify.com/v1/geocode/search?${params.toString()}`);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Geoapify discovery failed: ${response.status} ${text}`);
  }

  const payload = await response.json();
  const places = Array.isArray(payload.features)
    ? payload.features.map((feature: Record<string, any>) => ({
        ...(feature.properties || {}),
        datasource: feature.properties?.datasource,
      }))
    : [];
  return {
    provider: "geoapify_places",
    candidates: places.map((place: Record<string, any>) => mapGeoapifyCandidate(place, input)),
  };
}

function buildFallbackCandidates(input: VendorDiscoveryInput): VendorDiscoveryResult {
  const state = normalizeState(input.property?.state || input.state);
  const city = input.property?.city || input.city || null;
  const zipCode = input.property?.zipCode || input.zipCode || null;
  const tradeCategories = inferTrades(input.trade);
  const label = tradeCategories[0];
  const base = `${city || zipCode || "Local"} ${label}`;
  return {
    provider: "local_seed",
    candidates: [
      {
        name: `${base} Pros`,
        tradeCategories,
        serviceStates: state ? [state] : [],
        serviceCities: city ? [city] : [],
        serviceZipCodes: zipCode ? [zipCode] : [],
        phone: "(555) 010-2040",
        email: null,
        website: null,
        rating: "4.60",
        reviewCount: 12,
        licenseNumber: null,
        insuranceExpiry: null,
        isOnCall: true,
        isActive: true,
        source: "seed_fallback",
        sourceExternalId: `${label}-seed-1`,
        confidenceScore: "0.450",
        rawIntakeData: { note: "Fallback candidate generated because no discovery provider is configured." },
      },
      {
        name: `${base} Response Team`,
        tradeCategories,
        serviceStates: state ? [state] : [],
        serviceCities: city ? [city] : [],
        serviceZipCodes: zipCode ? [zipCode] : [],
        phone: "(555) 010-2077",
        email: null,
        website: null,
        rating: "4.30",
        reviewCount: 7,
        licenseNumber: null,
        insuranceExpiry: null,
        isOnCall: false,
        isActive: true,
        source: "seed_fallback",
        sourceExternalId: `${label}-seed-2`,
        confidenceScore: "0.400",
        rawIntakeData: { note: "Replace with Geoapify results after GEOAPIFY_API_KEY is configured." },
      },
    ],
  };
}

export async function discoverVendors(input: VendorDiscoveryInput): Promise<VendorDiscoveryResult> {
  try {
    const geoapify = await discoverFromGeoapify(input);
    if (geoapify && geoapify.candidates.length > 0) return geoapify;
  } catch (error) {
    console.error("Vendor discovery provider error:", error);
  }

  return buildFallbackCandidates(input);
}

function stringListIncludes(list: unknown, value?: string | null): boolean {
  if (!value || !Array.isArray(list)) return false;
  const normalized = value.trim().toLowerCase();
  return list.some((item) => typeof item === "string" && item.trim().toLowerCase() === normalized);
}

export function scoreVendorForMaintenanceAssignment(
  vendor: Vendor,
  params: { category: string; propertyState?: string | null; propertyCity?: string | null; propertyZipCode?: string | null },
): number {
  let score = 0;
  if (!vendor.isActive) return -1;
  if (stringListIncludes(vendor.tradeCategories, params.category)) score += 5;
  if (stringListIncludes(vendor.serviceStates, params.propertyState)) score += 2;
  if (stringListIncludes(vendor.serviceCities, params.propertyCity)) score += 2;
  if (stringListIncludes(vendor.serviceZipCodes, params.propertyZipCode)) score += 3;
  if (vendor.isOnCall) score += 2;
  if (vendor.rating) score += Number(vendor.rating) || 0;
  return score;
}
