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

function buildLocationText(input: VendorDiscoveryInput): string {
  const city = input.property?.city || input.city;
  const state = input.property?.state || input.state;
  const zipCode = input.property?.zipCode || input.zipCode;
  return zipCode || [city, state].filter(Boolean).join(", ");
}

function getGoogleSearchTerm(trade: string): string {
  const normalized = normalizeTrade(trade);
  if (normalized.includes("plumb")) return "plumber";
  if (normalized.includes("electric")) return "electrician";
  if (normalized.includes("hvac") || normalized.includes("air")) return "hvac repair";
  if (normalized.includes("pest")) return "pest control";
  if (normalized.includes("lock") || normalized.includes("security")) return "locksmith";
  if (normalized.includes("appliance")) return "appliance repair";
  return trade;
}

function buildSearchText(input: VendorDiscoveryInput): string {
  const location = buildLocationText(input);
  const trade = input.query?.trim() || getGoogleSearchTerm(input.trade);
  return location ? `${trade} near ${location}` : trade;
}

function mapGoogleCandidate(
  item: Record<string, any>,
  input: VendorDiscoveryInput,
): Omit<InsertVendor, "managerId"> {
  const state = normalizeState(input.property?.state || input.state);
  const city = input.property?.city || input.city || null;
  const zipCode = input.property?.zipCode || input.zipCode || null;
  const location = item.formattedAddress || item.shortFormattedAddress || "";
  return {
    name: item.displayName?.text || item.name || "Unknown vendor",
    tradeCategories: inferTrades(input.trade),
    serviceStates: state ? [state] : [],
    serviceCities: city ? [city] : [],
    serviceZipCodes: zipCode ? [zipCode] : [],
    phone: normalizePhone(item.nationalPhoneNumber || item.internationalPhoneNumber || null),
    email: null,
    website: item.websiteUri || item.googleMapsUri || null,
    rating: item.rating ? String(item.rating) : null,
    reviewCount: typeof item.userRatingCount === "number" ? item.userRatingCount : null,
    licenseNumber: null,
    insuranceExpiry: null,
    isOnCall: false,
    isActive: true,
    source: "google_places",
    sourceExternalId: item.id || item.name || null,
    confidenceScore: item.rating ? String(Math.min(0.99, Number(item.rating) / 5)) : "0.550",
    rawIntakeData: {
      location,
      googlePrimaryType: item.primaryType,
      businessStatus: item.businessStatus,
    },
  };
}

async function discoverFromGoogle(input: VendorDiscoveryInput): Promise<VendorDiscoveryResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[vendors] Google Places API key missing");
    }
    return null;
  }

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.shortFormattedAddress",
        "places.nationalPhoneNumber",
        "places.internationalPhoneNumber",
        "places.websiteUri",
        "places.googleMapsUri",
        "places.rating",
        "places.userRatingCount",
        "places.businessStatus",
        "places.primaryType",
      ].join(","),
    },
    body: JSON.stringify({
      textQuery: buildSearchText(input),
      maxResultCount: 10,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Places discovery failed: ${response.status} ${text}`);
  }

  const payload = await response.json();
  const places = Array.isArray(payload.places) ? payload.places : [];
  if (process.env.NODE_ENV !== "production") {
    console.log("[vendors] Google Places response", {
      trade: input.trade,
      query: buildSearchText(input),
      count: places.length,
    });
  }
  return {
    provider: "google_places",
    candidates: places.map((place: Record<string, any>) => mapGoogleCandidate(place, input)),
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
        rawIntakeData: { note: "Fallback candidate generated because no supported provider is configured." },
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
        rawIntakeData: { note: "Replace with Google Places results after GOOGLE_MAPS_API_KEY or GOOGLE_PLACES_API_KEY is configured." },
      },
    ],
  };
}

export async function discoverVendors(input: VendorDiscoveryInput): Promise<VendorDiscoveryResult> {
  try {
    const google = await discoverFromGoogle(input);
    if (google && google.candidates.length > 0) return google;
  } catch (error) {
    console.error("Vendor discovery provider error:", error);
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[vendors] Falling back to local seed", {
      trade: input.trade,
      city: input.property?.city || input.city || null,
      state: input.property?.state || input.state || null,
      zipCode: input.property?.zipCode || input.zipCode || null,
    });
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
