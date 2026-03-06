import type { InsertMultifamilySaleListing } from "@shared/schema";

export type MultifamilySaleFilters = {
  search?: string;
  city?: string;
  region?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
};

const RENTCAST_BASE_URL = process.env.RENTCAST_BASE_URL || "https://api.rentcast.io/v1";
const MULTIFAMILY_KEYWORDS = [
  "multi family",
  "multi-family",
  "multifamily",
  "duplex",
  "triplex",
  "fourplex",
  "quadplex",
  "apartment",
  "apartments",
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.replace(/[$,]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function firstString(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const next = asString(record[key]);
    if (next) return next;
  }
  return null;
}

function firstNumber(record: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const next = asNumber(record[key]);
    if (next !== null) return next;
  }
  return null;
}

function isMultifamily(record: Record<string, unknown>): boolean {
  const propertyType = firstString(record, "propertyType", "type", "subType") ?? "";
  const listingType = firstString(record, "listingType", "description", "title") ?? "";
  const haystack = `${propertyType} ${listingType}`.toLowerCase();
  if (MULTIFAMILY_KEYWORDS.some((keyword) => haystack.includes(keyword))) return true;

  const units = firstNumber(record, "units", "unitCount", "numberOfUnits");
  if (units !== null && units >= 2) return true;

  return false;
}

function toDbListing(raw: Record<string, unknown>): InsertMultifamilySaleListing | null {
  const sourceListingId = firstString(raw, "id", "listingId", "propertyId");
  const city = firstString(raw, "city");
  const price = firstNumber(raw, "price", "listPrice", "askingPrice");
  if (!sourceListingId || !city || price === null || price <= 0) return null;

  const monthlyRent = firstNumber(raw, "rentEstimate", "estimatedRent", "estimatedMonthlyRent", "medianRent");
  const projectedAnnualReturn = monthlyRent !== null ? monthlyRent * 12 * 0.72 : null;
  const photos = Array.isArray(raw.photos) ? raw.photos : [];

  return {
    source: "rentcast",
    sourceListingId,
    formattedAddress: firstString(raw, "formattedAddress", "address"),
    addressLine1: firstString(raw, "addressLine1"),
    addressLine2: firstString(raw, "addressLine2"),
    city,
    state: firstString(raw, "state", "region"),
    stateFips: firstString(raw, "stateFips"),
    zipCode: firstString(raw, "zipCode", "postalCode"),
    county: firstString(raw, "county"),
    countyFips: firstString(raw, "countyFips"),
    latitude: firstNumber(raw, "latitude", "lat")?.toFixed(6) ?? null,
    longitude: firstNumber(raw, "longitude", "lon", "lng")?.toFixed(6) ?? null,
    propertyType: firstString(raw, "propertyType", "type", "subType"),
    bedrooms: firstNumber(raw, "bedrooms", "beds")?.toFixed(1) ?? null,
    bathrooms: firstNumber(raw, "bathrooms", "baths")?.toFixed(1) ?? null,
    squareFootage: firstNumber(raw, "squareFootage", "livingArea", "sqft") !== null
      ? Math.round(firstNumber(raw, "squareFootage", "livingArea", "sqft")!)
      : null,
    lotSize: firstNumber(raw, "lotSize", "lotSizeSqft") !== null
      ? Math.round(firstNumber(raw, "lotSize", "lotSizeSqft")!)
      : null,
    yearBuilt: firstNumber(raw, "yearBuilt") !== null ? Math.round(firstNumber(raw, "yearBuilt")!) : null,
    status: firstString(raw, "status", "listingStatus"),
    price: price.toFixed(2),
    listingType: firstString(raw, "listingType"),
    listedDate: firstString(raw, "listedDate", "listingDate"),
    removedDate: firstString(raw, "removedDate"),
    createdDate: firstString(raw, "createdDate"),
    lastSeenDate: firstString(raw, "lastSeenDate", "lastSeen"),
    daysOnMarket: firstNumber(raw, "daysOnMarket") !== null ? Math.round(firstNumber(raw, "daysOnMarket")!) : null,
    mlsName: firstString(raw, "mlsName"),
    mlsNumber: firstString(raw, "mlsNumber"),
    listingAgent: asRecord(raw.listingAgent),
    listingOffice: asRecord(raw.listingOffice),
    history: asRecord(raw.history),
    projectedAnnualReturn: projectedAnnualReturn !== null ? projectedAnnualReturn.toFixed(2) : null,
    currency: "USD",
    listingUrl: firstString(raw, "listingUrl", "url"),
    photoUrl: asString(photos[0]) ?? firstString(raw, "photoUrl", "thumbnail", "photo"),
    rawPayload: raw,
    lastSyncedAt: new Date(),
  };
}

export async function fetchMultifamilySaleListings(
  filters: MultifamilySaleFilters
): Promise<InsertMultifamilySaleListing[]> {
  const apiKey = process.env.RENTCAST_API_KEY;
  if (!apiKey) {
    throw new Error("RENTCAST_API_KEY is not configured");
  }

  const params = new URLSearchParams();
  if (filters.city) params.set("city", filters.city);
  if (filters.region) params.set("state", filters.region);
  params.set("status", "Active");
  params.set("propertyType", "Multi-Family");
  params.set("limit", String(Math.min(Math.max(filters.limit ?? 250, 1), 500)));

  const url = `${RENTCAST_BASE_URL.replace(/\/+$/, "")}/listings/sale?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Api-Key": apiKey,
    },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const payload = asRecord(body);
    const message = asString(payload?.message) || asString(payload?.error) || `RentCast request failed (${response.status})`;
    throw new Error(message);
  }

  const rows = Array.isArray(body) ? body : [];
  const filtered = rows
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => !!item)
    .filter(isMultifamily)
    .map(toDbListing)
    .filter((item): item is InsertMultifamilySaleListing => !!item);

  return filtered;
}
