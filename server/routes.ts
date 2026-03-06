
import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./integrations/auth";
import { sendAuthEmail } from "./integrations/auth/mailer";
import { hashToken } from "./integrations/auth/crypto";
import { registerChatRoutes } from "./integrations/chat";
import { registerImageRoutes } from "./integrations/image";
import { seedDatabase } from "./seed";
import OpenAI from "openai";
import { scrapePublicStrListings } from "./services/str-market";
import type { Request, Response, NextFunction } from "express";
import { randomBytes } from "node:crypto";

// Initialize OpenAI for backend logic (Lease gen, Maintenance analysis)
// Use placeholder when no key is set so app can start; AI routes will check and return friendly error
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "sk-placeholder",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function toCsvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function toMoney(value: string | number): string {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return "0.00";
  return numeric.toFixed(2);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function firstDefinedString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function normalizeZillowLeadPayload(payload: Record<string, unknown>) {
  const applicant = asRecord(payload.applicant) ?? asRecord(payload.renter) ?? asRecord(payload.contact) ?? {};
  const listing = asRecord(payload.listing) ?? {};
  const property = asRecord(payload.property) ?? {};
  const manager = asRecord(payload.manager) ?? asRecord(payload.landlord) ?? {};

  const externalLeadId = firstDefinedString(
    payload.externalLeadId,
    payload.leadId,
    payload.lead_id,
    payload.id,
    applicant.externalLeadId,
    applicant.leadId,
  );

  const applicantName = firstDefinedString(
    payload.fullName,
    payload.name,
    [payload.firstName, payload.lastName].filter(Boolean).join(" ").trim(),
    applicant.fullName,
    applicant.name,
    [applicant.firstName, applicant.lastName].filter(Boolean).join(" ").trim(),
  );

  return {
    externalLeadId,
    listingExternalId: firstDefinedString(
      payload.listingExternalId,
      payload.listingId,
      payload.listing_id,
      listing.externalId,
      listing.id,
    ),
    propertyExternalId: firstDefinedString(
      payload.propertyExternalId,
      payload.propertyId,
      payload.property_id,
      property.externalId,
      property.id,
    ),
    managerId: firstDefinedString(payload.managerId, payload.manager_id, manager.id),
    managerEmail: firstDefinedString(payload.managerEmail, payload.manager_email, manager.email),
    applicantName,
    applicantEmail: firstDefinedString(payload.email, applicant.email),
    applicantPhone: firstDefinedString(payload.phone, applicant.phone, applicant.phoneNumber),
    message: firstDefinedString(payload.message, payload.notes, applicant.message),
    moveInDate: firstDefinedString(payload.moveInDate, payload.move_in_date, applicant.moveInDate),
    rawPayload: payload,
  };
}

function getPublicAppBaseUrl(): string {
  const fromEnv =
    process.env.PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:5001");
  try {
    const parsed = new URL(fromEnv.includes("://") ? fromEnv : `https://${fromEnv}`);
    return parsed.origin;
  } catch {
    return "http://localhost:5001";
  }
}

const STEP_UP_TTL_MS = 10 * 60 * 1000;
const DAILY_SCAN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const RENT_OVERDUE_SCAN_INTERVAL_MS = DAILY_SCAN_INTERVAL_MS;
const DEFAULT_RENT_OVERDUE_NOTIFICATION_DAYS = 5;
const LEASE_EXPIRY_SCAN_INTERVAL_MS = DAILY_SCAN_INTERVAL_MS;
const DEFAULT_LEASE_EXPIRY_NOTIFICATION_DAYS = 30;
const MAINTENANCE_ESCALATION_SCAN_INTERVAL_MS = DAILY_SCAN_INTERVAL_MS;
const DEFAULT_MAINTENANCE_AUTOMATION_SETTINGS = {
  autoTriageEnabled: true,
  autoEscalationEnabled: true,
  autoVendorAssignmentEnabled: true,
} as const;

type OverdueNotificationCandidate = {
  leaseId: number;
  propertyAddress: string;
  tenantName: string;
  rentAmount: number;
  monthPaid: number;
  balance: number;
  monthKey: string;
};

type LeaseExpiryNotificationCandidate = {
  leaseId: number;
  leaseEndDateKey: string;
  propertyAddress: string;
  tenantName: string;
  daysUntilEnd: number;
};

type MaintenanceCategory = "plumbing" | "electrical" | "hvac" | "appliance" | "pest" | "security" | "general";

type VendorProfile = {
  name: string;
  categories: MaintenanceCategory[];
  states?: string[];
  onCall?: boolean;
};

function isMissingRelationError(error: unknown): boolean {
  const code = (error as any)?.code;
  return code === "42P01";
}

const MAINTENANCE_TRIAGE_RULES: Array<{
  category: MaintenanceCategory;
  priority: "low" | "medium" | "high" | "emergency";
  keywords: string[];
}> = [
  {
    category: "security",
    priority: "emergency",
    keywords: ["fire", "smoke", "gas leak", "carbon monoxide", "break in", "intruder", "burst pipe", "flood"],
  },
  {
    category: "electrical",
    priority: "high",
    keywords: ["power outage", "no power", "sparking", "burning smell", "breaker", "outlet", "short circuit"],
  },
  {
    category: "hvac",
    priority: "high",
    keywords: ["no heat", "heater", "furnace", "ac not working", "air conditioning", "hvac", "thermostat"],
  },
  {
    category: "plumbing",
    priority: "high",
    keywords: ["leak", "water", "toilet", "drain", "sewer", "clog", "pipe", "sink", "shower"],
  },
  {
    category: "pest",
    priority: "medium",
    keywords: ["pest", "roach", "rodent", "mouse", "rat", "bed bug", "termite"],
  },
  {
    category: "appliance",
    priority: "medium",
    keywords: ["refrigerator", "fridge", "oven", "stove", "dishwasher", "washer", "dryer", "microwave"],
  },
];

const AUTO_ASSIGN_VENDOR_POOL: VendorProfile[] = [
  { name: "RapidFix Plumbing", categories: ["plumbing"], states: ["GA", "CA", "TX"], onCall: true },
  { name: "GridLine Electric", categories: ["electrical"], states: ["GA", "CA", "TX"], onCall: true },
  { name: "Comfort HVAC Services", categories: ["hvac"], states: ["GA", "CA", "TX"], onCall: true },
  { name: "Home Appliance Response", categories: ["appliance"], states: ["GA", "CA", "TX"] },
  { name: "PestShield Control", categories: ["pest"], states: ["GA", "CA", "TX"] },
  { name: "SafeAccess Property Support", categories: ["security", "general"], onCall: true },
];

function getSlaHoursForPriority(priority: string): number {
  switch (priority) {
    case "emergency":
      return 4;
    case "high":
      return 24;
    case "medium":
      return 72;
    default:
      return 168;
  }
}

function triageMaintenanceRequest(title: string, description: string) {
  const text = `${title} ${description}`.toLowerCase();
  const matched = MAINTENANCE_TRIAGE_RULES.find((rule) =>
    rule.keywords.some((keyword) => text.includes(keyword)),
  );
  const category: MaintenanceCategory = matched?.category ?? "general";
  const priority = matched?.priority ?? "medium";
  const slaHours = getSlaHoursForPriority(priority);
  return {
    category,
    priority,
    slaHours,
    summary: `Auto-triaged as ${priority} priority (${category}). SLA target: ${slaHours}h.`,
  };
}

function autoAssignVendor(params: { category: MaintenanceCategory; propertyState?: string | null }) {
  const propertyState = (params.propertyState || "").toUpperCase();
  const categoryMatches = AUTO_ASSIGN_VENDOR_POOL.filter((vendor) =>
    vendor.categories.includes(params.category),
  );
  const stateMatch = categoryMatches.find(
    (vendor) => vendor.states && propertyState && vendor.states.includes(propertyState),
  );
  const onCallMatch = categoryMatches.find((vendor) => vendor.onCall);
  const chosen = stateMatch ?? onCallMatch ?? categoryMatches[0] ?? AUTO_ASSIGN_VENDOR_POOL[0];
  const note = stateMatch
    ? "Auto-assigned by trade and property state."
    : onCallMatch
      ? "Auto-assigned to on-call vendor by trade."
      : "Auto-assigned to default vendor queue.";
  return { vendorName: chosen.name, note };
}

function getEscalatedPriority(priority: string): "medium" | "high" | "emergency" {
  if (priority === "low") return "medium";
  if (priority === "medium") return "high";
  return "emergency";
}

const leaseSigningCompleteSchema = z.object({
  token: z.string().min(20),
  fullName: z.string().min(2).max(120),
});

const requireStepUpAuth = (req: Request & any, res: Response, next: NextFunction) => {
  const verifiedAt = Number(req.session?.stepUpVerifiedAt || 0);
  if (!verifiedAt || Date.now() - verifiedAt > STEP_UP_TTL_MS) {
    return res.status(403).json({ message: "Step-up authentication required. Call /api/auth/reauth first." });
  }
  return next();
};

function collectMissingListingFields(property: any): string[] {
  const required: Array<{ key: string; valid: boolean }> = [
    { key: "address", valid: Boolean(property.address) },
    { key: "city", valid: Boolean(property.city) },
    { key: "state", valid: Boolean(property.state) },
    { key: "zipCode", valid: Boolean(property.zipCode) },
    { key: "price", valid: Number(property.price) > 0 },
    { key: "bedrooms", valid: Number(property.bedrooms) > 0 },
    { key: "bathrooms", valid: Number(property.bathrooms) > 0 },
    { key: "sqft", valid: Number(property.sqft) > 0 },
    { key: "description", valid: Boolean(property.description) },
  ];
  return required.filter((f) => !f.valid).map((f) => f.key);
}

function buildZillowListingXml(property: any, mapping?: any): string {
  const common = mapping?.common ?? {};
  const zillow = mapping?.zillow ?? {};
  const description = property.description || "Long-term rental listing";
  const title = common.title || `${property.bedrooms} BR Rental in ${property.city}`;
  const applicationUrlTag = zillow.applicationUrl
    ? `\n    <ApplicationURL>${escapeXml(zillow.applicationUrl)}</ApplicationURL>`
    : "";
  const virtualTourTag = zillow.virtualTourUrl
    ? `\n    <VirtualTourURL>${escapeXml(zillow.virtualTourUrl)}</VirtualTourURL>`
    : "";
  const availableDateTag = common.availableDate
    ? `\n    <AvailableDate>${escapeXml(common.availableDate)}</AvailableDate>`
    : "";
  const leaseTermTag = common.leaseTermMonths
    ? `\n    <LeaseTermMonths>${common.leaseTermMonths}</LeaseTermMonths>`
    : "";
  const contactNameTag = common.contactName
    ? `\n    <ContactName>${escapeXml(common.contactName)}</ContactName>`
    : "";
  const contactEmailTag = common.contactEmail
    ? `\n    <ContactEmail>${escapeXml(common.contactEmail)}</ContactEmail>`
    : "";
  const contactPhoneTag = common.contactPhone
    ? `\n    <ContactPhone>${escapeXml(common.contactPhone)}</ContactPhone>`
    : "";
  const amenitiesTag = Array.isArray(common.amenities) && common.amenities.length > 0
    ? `\n    <Amenities>${escapeXml(common.amenities.join(", "))}</Amenities>`
    : "";
  const imageTag = property.imageUrl
    ? `\n    <PhotoURL>${escapeXml(property.imageUrl)}</PhotoURL>`
    : "";

  return `<RentalFeed>
  <Property>
    <ExternalListingId>${property.id}</ExternalListingId>
    <Title>${escapeXml(title)}</Title>
    <Address>${escapeXml(property.address)}</Address>
    <City>${escapeXml(property.city)}</City>
    <State>${escapeXml(property.state)}</State>
    <PostalCode>${escapeXml(property.zipCode)}</PostalCode>
    <MonthlyRent>${toMoney(property.price)}</MonthlyRent>
    <Bedrooms>${property.bedrooms}</Bedrooms>
    <Bathrooms>${property.bathrooms}</Bathrooms>
    <SquareFeet>${property.sqft}</SquareFeet>
    <Description>${escapeXml(description)}</Description>${imageTag}${availableDateTag}${leaseTermTag}${contactNameTag}${contactEmailTag}${contactPhoneTag}${amenitiesTag}
    <PropertyType>${escapeXml(zillow.propertyType || "apartment")}</PropertyType>
    <PetsAllowed>${common.petsAllowed ? "true" : "false"}</PetsAllowed>
    <Furnished>${common.furnished ? "true" : "false"}</Furnished>
    <ParkingIncluded>${common.parkingIncluded ? "true" : "false"}</ParkingIncluded>
    <Laundry>${escapeXml(common.laundry || "unknown")}</Laundry>${applicationUrlTag}${virtualTourTag}
    <ListingType>LongTermRental</ListingType>
    <Status>${escapeXml(property.status)}</Status>
  </Property>
</RentalFeed>`;
}

function buildApartmentsPayload(property: any, mapping?: any) {
  const common = mapping?.common ?? {};
  const apartments = mapping?.apartments ?? {};
  const amenities = Array.isArray(common.amenities) ? common.amenities : [];
  const utilitiesIncluded = Array.isArray(apartments.utilitiesIncluded) ? apartments.utilitiesIncluded : [];

  const payload = {
    listingId: String(property.id),
    listingType: "LONG_TERM_RENTAL",
    title: common.title || `${property.bedrooms} BR Rental in ${property.city}`,
    availableDate: common.availableDate || undefined,
    leaseTermMonths: common.leaseTermMonths || undefined,
    address: {
      street: property.address,
      city: property.city,
      state: property.state,
      postalCode: property.zipCode,
      country: "US",
    },
    contact: {
      name: common.contactName || undefined,
      email: common.contactEmail || undefined,
      phone: common.contactPhone || undefined,
    },
    communityName: apartments.communityName || undefined,
    unitNumber: apartments.unitNumber || undefined,
    amenities,
    pricing: {
      monthlyRent: Number(toMoney(property.price)),
      depositAmount: apartments.depositAmount ?? undefined,
      currency: "USD",
    },
    bedrooms: property.bedrooms,
    bathrooms: Number(property.bathrooms),
    squareFeet: property.sqft,
    description: property.description || "",
    petsAllowed: Boolean(common.petsAllowed),
    furnished: Boolean(common.furnished),
    parkingIncluded: Boolean(common.parkingIncluded),
    laundry: common.laundry || undefined,
    utilitiesIncluded,
    media: property.imageUrl ? [{ url: property.imageUrl, type: "PHOTO" }] : [],
    availabilityStatus: property.status === "available" ? "AVAILABLE" : "UNAVAILABLE",
  };

  const csvHeader = [
    "listing_id",
    "street",
    "city",
    "state",
    "zip",
    "monthly_rent",
    "bedrooms",
    "bathrooms",
    "sqft",
    "description",
    "available_date",
    "lease_term_months",
    "pets_allowed",
    "furnished",
    "parking_included",
    "laundry",
    "amenities",
    "community_name",
    "unit_number",
    "deposit_amount",
    "utilities_included",
    "contact_name",
    "contact_email",
    "contact_phone",
    "image_url",
    "availability_status",
  ].join(",");

  const csvRow = [
    toCsvCell(String(property.id)),
    toCsvCell(property.address ?? ""),
    toCsvCell(property.city ?? ""),
    toCsvCell(property.state ?? ""),
    toCsvCell(property.zipCode ?? ""),
    toCsvCell(toMoney(property.price)),
    toCsvCell(String(property.bedrooms ?? "")),
    toCsvCell(String(property.bathrooms ?? "")),
    toCsvCell(String(property.sqft ?? "")),
    toCsvCell(property.description ?? ""),
    toCsvCell(common.availableDate ?? ""),
    toCsvCell(String(common.leaseTermMonths ?? "")),
    toCsvCell(common.petsAllowed ? "true" : "false"),
    toCsvCell(common.furnished ? "true" : "false"),
    toCsvCell(common.parkingIncluded ? "true" : "false"),
    toCsvCell(common.laundry ?? ""),
    toCsvCell(amenities.join("|")),
    toCsvCell(apartments.communityName ?? ""),
    toCsvCell(apartments.unitNumber ?? ""),
    toCsvCell(apartments.depositAmount !== undefined ? String(apartments.depositAmount) : ""),
    toCsvCell(utilitiesIncluded.join("|")),
    toCsvCell(common.contactName ?? ""),
    toCsvCell(common.contactEmail ?? ""),
    toCsvCell(common.contactPhone ?? ""),
    toCsvCell(property.imageUrl ?? ""),
    toCsvCell(property.status === "available" ? "AVAILABLE" : "UNAVAILABLE"),
  ].join(",");

  return {
    json: JSON.stringify(payload, null, 2),
    csv: `${csvHeader}\n${csvRow}`,
  };
}

function getHostLabel(urlValue: string): string {
  try {
    const url = new URL(urlValue);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return urlValue;
  }
}

async function publishPayload(params: {
  url: string;
  payload: string;
  contentType: string;
  apiKey?: string;
}) {
  const headers: Record<string, string> = {
    "Content-Type": params.contentType,
  };
  if (params.apiKey) {
    headers.Authorization = `Bearer ${params.apiKey}`;
  }

  const response = await fetch(params.url, {
    method: "POST",
    headers,
    body: params.payload,
  });

  const responseText = await response.text().catch(() => "");

  return {
    success: response.ok,
    statusCode: response.status,
    responseBody: responseText.slice(0, 4000),
    target: getHostLabel(params.url),
    publishedAt: new Date().toISOString(),
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const STR_MARKET_AUTO_REFRESH_MS = 60 * 60 * 1000;
  const STR_MARKET_RETRY_BACKOFF_MS = 5 * 60 * 1000;
  let strMarketAutoRefreshInFlight: Promise<void> | null = null;
  let nextStrMarketAutoRefreshAllowedAt = 0;

  const latestScrapedAtMs = (listings: Array<{ lastScrapedAt?: Date | null }>) => {
    let latest = 0;
    for (const listing of listings) {
      const parsed = listing.lastScrapedAt ? new Date(listing.lastScrapedAt).getTime() : 0;
      if (Number.isFinite(parsed) && parsed > latest) latest = parsed;
    }
    return latest;
  };

  const ensureStrMarketListingsAreFresh = async () => {
    let listings = await storage.getStrMarketListings();
    const now = Date.now();
    const latestMs = latestScrapedAtMs(listings);
    const isStale = listings.length === 0 || !latestMs || now - latestMs >= STR_MARKET_AUTO_REFRESH_MS;

    if (!isStale) return listings;
    if (now < nextStrMarketAutoRefreshAllowedAt) return listings;

    if (!strMarketAutoRefreshInFlight) {
      strMarketAutoRefreshInFlight = (async () => {
        try {
          const scraped = await scrapePublicStrListings();
          if (scraped.length > 0) {
            await storage.replaceStrMarketListings(scraped);
          }
          nextStrMarketAutoRefreshAllowedAt = 0;
        } catch (error) {
          console.error("STR market auto-refresh failed:", error);
          nextStrMarketAutoRefreshAllowedAt = Date.now() + STR_MARKET_RETRY_BACKOFF_MS;
        } finally {
          strMarketAutoRefreshInFlight = null;
        }
      })();
    }

    await strMarketAutoRefreshInFlight;
    listings = await storage.getStrMarketListings();
    return listings;
  };

  const normalizeOverdueDays = (value: unknown) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_RENT_OVERDUE_NOTIFICATION_DAYS;
    return Math.min(60, Math.max(1, Math.floor(parsed)));
  };

  const normalizeLeaseExpiryDays = (value: unknown) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_LEASE_EXPIRY_NOTIFICATION_DAYS;
    return Math.min(365, Math.max(1, Math.floor(parsed)));
  };

  const getManagerNotificationSettings = async (managerId: string) => {
    const existing = await storage.getManagerRentNotificationSettings(managerId);
    if (existing) {
      return {
        managerId: existing.managerId,
        enabled: existing.enabled,
        overdueDays: normalizeOverdueDays(existing.overdueDays),
        updatedAt: existing.updatedAt,
      };
    }
    return {
      managerId,
      enabled: true,
      overdueDays: normalizeOverdueDays(process.env.RENT_OVERDUE_NOTIFICATION_DEFAULT_DAYS),
      updatedAt: null as Date | null,
    };
  };

  const getManagerLeaseExpirySettings = async (managerId: string) => {
    const existing = await storage.getManagerLeaseExpiryNotificationSettings(managerId);
    if (existing) {
      return {
        managerId: existing.managerId,
        enabled: existing.enabled,
        daysBeforeExpiry: normalizeLeaseExpiryDays(existing.daysBeforeExpiry),
        updatedAt: existing.updatedAt,
      };
    }
    return {
      managerId,
      enabled: true,
      daysBeforeExpiry: normalizeLeaseExpiryDays(process.env.LEASE_EXPIRY_NOTIFICATION_DEFAULT_DAYS),
      updatedAt: null as Date | null,
    };
  };

  const getManagerMaintenanceAutomationSettings = async (managerId: string) => {
    const existing = await storage.getManagerMaintenanceAutomationSettings(managerId);
    if (existing) {
      return {
        managerId: existing.managerId,
        autoTriageEnabled: existing.autoTriageEnabled,
        autoEscalationEnabled: existing.autoEscalationEnabled,
        autoVendorAssignmentEnabled: existing.autoVendorAssignmentEnabled,
        updatedAt: existing.updatedAt,
      };
    }
    return {
      managerId,
      autoTriageEnabled: DEFAULT_MAINTENANCE_AUTOMATION_SETTINGS.autoTriageEnabled,
      autoEscalationEnabled: DEFAULT_MAINTENANCE_AUTOMATION_SETTINGS.autoEscalationEnabled,
      autoVendorAssignmentEnabled: DEFAULT_MAINTENANCE_AUTOMATION_SETTINGS.autoVendorAssignmentEnabled,
      updatedAt: null as Date | null,
    };
  };

  const getOverdueRentCandidatesForManager = async (
    managerId: string,
    thresholdDays: number,
    now: Date,
  ): Promise<OverdueNotificationCandidate[]> => {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const daysSinceMonthStart = Math.floor((now.getTime() - startOfMonth.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceMonthStart < thresholdDays) return [];

    const managerLeases = (await storage.getLeasesByManager(managerId)).filter((lease) => lease.status === "active");
    if (managerLeases.length === 0) return [];

    const managerProperties = await storage.getPropertiesByManager(managerId);
    const propertyAddressById = new Map<number, string>();
    managerProperties.forEach((property) => {
      propertyAddressById.set(property.id, `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`.trim());
    });

    const tenantIds = Array.from(new Set(managerLeases.map((lease) => lease.tenantId)));
    const tenantNameById = new Map<string, string>();
    for (const tenantId of tenantIds) {
      const tenant = await storage.getUser(tenantId);
      const displayName = [tenant?.firstName, tenant?.lastName].filter(Boolean).join(" ").trim();
      tenantNameById.set(tenantId, displayName || tenant?.email || tenantId);
    }

    const allPayments = await storage.getPayments();
    const candidates: OverdueNotificationCandidate[] = [];

    for (const lease of managerLeases) {
      const monthPaid = allPayments
        .filter((payment) => {
          if (payment.leaseId !== lease.id) return false;
          if (payment.status !== "paid" || payment.type !== "rent") return false;
          const paymentDate = new Date(payment.date ?? new Date());
          return paymentDate.getMonth() === now.getMonth() && paymentDate.getFullYear() === now.getFullYear();
        })
        .reduce((sum, payment) => sum + Number(payment.amount), 0);

      const rentAmount = Number(lease.rentAmount);
      const balance = Math.max(rentAmount - monthPaid, 0);
      if (balance < 0.01) continue;

      const alreadySent = await storage.hasSentRentOverdueNotification(managerId, lease.id, monthKey, thresholdDays);
      if (alreadySent) continue;

      candidates.push({
        leaseId: lease.id,
        propertyAddress: propertyAddressById.get(lease.propertyId) || `Property #${lease.propertyId}`,
        tenantName: tenantNameById.get(lease.tenantId) || lease.tenantId,
        rentAmount,
        monthPaid,
        balance,
        monthKey,
      });
    }

    return candidates;
  };

  const sendRentOverdueNotifications = async (forcedManagerId?: string) => {
    const now = new Date();
    const managerIds = forcedManagerId
      ? [forcedManagerId]
      : Array.from(new Set((await storage.getProperties()).map((property) => property.managerId)));

    for (const managerId of managerIds) {
      try {
        const manager = await storage.getUser(managerId);
        if (!manager?.email) continue;

        const settings = await getManagerNotificationSettings(managerId);
        if (!settings.enabled) continue;

        const overdueDays = normalizeOverdueDays(settings.overdueDays);
        const candidates = await getOverdueRentCandidatesForManager(managerId, overdueDays, now);
        if (candidates.length === 0) continue;

        const lines = candidates
          .map((item) => `Lease #${item.leaseId} (${item.propertyAddress}) - Tenant: ${item.tenantName} - Outstanding: $${item.balance.toFixed(2)}`)
          .join("<br/>");
        const subject = `Overdue rent alert: ${candidates.length} lease${candidates.length === 1 ? "" : "s"} pending`;

        const delivery = await sendAuthEmail({
          to: manager.email,
          subject,
          html: `<p>Rent is still unpaid for at least ${overdueDays} day(s) this month.</p><p>${lines}</p><p>Open Accounting in PropMan to review and follow up.</p>`,
          text: `Rent is still unpaid for at least ${overdueDays} day(s) this month.\n${candidates
            .map((item) => `Lease #${item.leaseId} - ${item.propertyAddress} - ${item.tenantName} - Outstanding $${item.balance.toFixed(2)}`)
            .join("\n")}\nOpen Accounting in PropMan to review.`,
        });

        for (const item of candidates) {
          await storage.markRentOverdueNotificationSent(managerId, item.leaseId, item.monthKey, overdueDays);
        }

        console.log(
          `[accounting] overdue rent alert queued for manager ${manager.email} (${candidates.length} lease(s)) via ${delivery.provider}${
            delivery.id ? ` (${delivery.id})` : ""
          }`,
        );
      } catch (error) {
        console.error(`Failed to send overdue rent notification for manager ${managerId}:`, error);
      }
    }
  };

  const getLeaseExpiryCandidatesForManager = async (
    managerId: string,
    thresholdDays: number,
    now: Date,
  ): Promise<LeaseExpiryNotificationCandidate[]> => {
    const managerLeases = (await storage.getLeasesByManager(managerId)).filter((lease) => lease.status === "active");
    if (managerLeases.length === 0) return [];

    const managerProperties = await storage.getPropertiesByManager(managerId);
    const propertyAddressById = new Map<number, string>();
    managerProperties.forEach((property) => {
      propertyAddressById.set(property.id, `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`.trim());
    });

    const tenantIds = Array.from(new Set(managerLeases.map((lease) => lease.tenantId)));
    const tenantNameById = new Map<string, string>();
    for (const tenantId of tenantIds) {
      const tenant = await storage.getUser(tenantId);
      const displayName = [tenant?.firstName, tenant?.lastName].filter(Boolean).join(" ").trim();
      tenantNameById.set(tenantId, displayName || tenant?.email || tenantId);
    }

    const candidates: LeaseExpiryNotificationCandidate[] = [];
    for (const lease of managerLeases) {
      const endDate = new Date(lease.endDate);
      const leaseEndDateKey = endDate.toISOString().slice(0, 10);
      const daysUntilEnd = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilEnd < 0 || daysUntilEnd > thresholdDays) continue;

      const alreadySent = await storage.hasSentLeaseExpiryNotification(managerId, lease.id, leaseEndDateKey, thresholdDays);
      if (alreadySent) continue;

      candidates.push({
        leaseId: lease.id,
        leaseEndDateKey,
        propertyAddress: propertyAddressById.get(lease.propertyId) || `Property #${lease.propertyId}`,
        tenantName: tenantNameById.get(lease.tenantId) || lease.tenantId,
        daysUntilEnd,
      });
    }
    return candidates;
  };

  const sendLeaseExpiryNotifications = async (forcedManagerId?: string) => {
    const now = new Date();
    const managerIds = forcedManagerId
      ? [forcedManagerId]
      : Array.from(new Set((await storage.getProperties()).map((property) => property.managerId)));

    for (const managerId of managerIds) {
      try {
        const manager = await storage.getUser(managerId);
        if (!manager?.email) continue;

        const settings = await getManagerLeaseExpirySettings(managerId);
        if (!settings.enabled) continue;
        const thresholdDays = normalizeLeaseExpiryDays(settings.daysBeforeExpiry);
        const candidates = await getLeaseExpiryCandidatesForManager(managerId, thresholdDays, now);
        if (candidates.length === 0) continue;

        const lines = candidates
          .map((item) => `Lease #${item.leaseId} (${item.propertyAddress}) - Tenant: ${item.tenantName} - Ends in ${item.daysUntilEnd} day(s)`)
          .join("<br/>");
        const subject = `Lease expiry reminder: ${candidates.length} lease${candidates.length === 1 ? "" : "s"} ending soon`;

        const delivery = await sendAuthEmail({
          to: manager.email,
          subject,
          html: `<p>These leases are within ${thresholdDays} day(s) of expiry.</p><p>${lines}</p><p>Open Lease Management in PropMan to take action.</p>`,
          text: `These leases are within ${thresholdDays} day(s) of expiry.\n${candidates
            .map((item) => `Lease #${item.leaseId} - ${item.propertyAddress} - ${item.tenantName} - Ends in ${item.daysUntilEnd} day(s)`)
            .join("\n")}\nOpen Lease Management in PropMan to take action.`,
        });

        for (const item of candidates) {
          await storage.markLeaseExpiryNotificationSent(managerId, item.leaseId, item.leaseEndDateKey, thresholdDays);
        }

        console.log(
          `[leases] expiry reminder queued for manager ${manager.email} (${candidates.length} lease(s)) via ${delivery.provider}${
            delivery.id ? ` (${delivery.id})` : ""
          }`,
        );
      } catch (error) {
        console.error(`Failed to send lease expiry notification for manager ${managerId}:`, error);
      }
    }
  };

  let rentOverdueScanInFlight: Promise<void> | null = null;
  let rentOverdueSchemaReady = true;
  const triggerRentOverdueScan = (forcedManagerId?: string) => {
    if (!rentOverdueSchemaReady) return Promise.resolve();
    if (rentOverdueScanInFlight) return rentOverdueScanInFlight;
    rentOverdueScanInFlight = (async () => {
      try {
        await sendRentOverdueNotifications(forcedManagerId);
      } catch (error) {
        if (isMissingRelationError(error)) {
          rentOverdueSchemaReady = false;
          console.warn("Rent overdue notification tables are missing. Run migrations (npm run db:push) to enable this feature.");
          return;
        }
        console.error("Rent overdue notification scan failed:", error);
      } finally {
        rentOverdueScanInFlight = null;
      }
    })();
    return rentOverdueScanInFlight;
  };

  const rentOverdueInterval = setInterval(() => {
    void triggerRentOverdueScan();
  }, RENT_OVERDUE_SCAN_INTERVAL_MS);
  httpServer.on("close", () => clearInterval(rentOverdueInterval));
  setTimeout(() => {
    void triggerRentOverdueScan();
  }, 10_000);

  let leaseExpiryScanInFlight: Promise<void> | null = null;
  let leaseExpirySchemaReady = true;
  const triggerLeaseExpiryScan = (forcedManagerId?: string) => {
    if (!leaseExpirySchemaReady) return Promise.resolve();
    if (leaseExpiryScanInFlight) return leaseExpiryScanInFlight;
    leaseExpiryScanInFlight = (async () => {
      try {
        await sendLeaseExpiryNotifications(forcedManagerId);
      } catch (error) {
        if (isMissingRelationError(error)) {
          leaseExpirySchemaReady = false;
          console.warn("Lease expiry notification tables are missing. Run migrations (npm run db:push) to enable this feature.");
          return;
        }
        console.error("Lease expiry notification scan failed:", error);
      } finally {
        leaseExpiryScanInFlight = null;
      }
    })();
    return leaseExpiryScanInFlight;
  };

  const leaseExpiryInterval = setInterval(() => {
    void triggerLeaseExpiryScan();
  }, LEASE_EXPIRY_SCAN_INTERVAL_MS);
  httpServer.on("close", () => clearInterval(leaseExpiryInterval));
  setTimeout(() => {
    void triggerLeaseExpiryScan();
  }, 15_000);

  const triggerMaintenanceEscalationScan = async (forcedManagerId?: string) => {
    try {
      const now = new Date();
      const requests = await storage.getMaintenanceRequests();
      const openRequests = requests.filter(
        (request) =>
          (request.status === "open" || request.status === "in_progress") &&
          request.slaDueAt &&
          new Date(request.slaDueAt).getTime() <= now.getTime() &&
          !request.escalatedAt,
      );

      const escalatedByManager = new Map<string, Array<{ id: number; propertyAddress: string; priority: string }>>();

      for (const request of openRequests) {
        const property = await storage.getProperty(request.propertyId);
        if (!property) continue;
        if (forcedManagerId && property.managerId !== forcedManagerId) continue;
        const managerSettings = await getManagerMaintenanceAutomationSettings(property.managerId);
        if (!managerSettings.autoEscalationEnabled) continue;

        const nextPriority = getEscalatedPriority(request.priority);
        const slaDueAt = request.slaDueAt ?? now;
        const escalationSummary = `SLA breached on ${new Date(slaDueAt).toLocaleString()}. Priority escalated to ${nextPriority}.`;
        const mergedAnalysis = request.aiAnalysis
          ? `${request.aiAnalysis}\nAutomation: ${escalationSummary}`
          : `Automation: ${escalationSummary}`;

        await storage.updateMaintenanceRequest(request.id, {
          priority: nextPriority,
          escalatedAt: now,
          aiAnalysis: mergedAnalysis,
        });

        const managerItems = escalatedByManager.get(property.managerId) ?? [];
        managerItems.push({
          id: request.id,
          propertyAddress: property.address,
          priority: nextPriority,
        });
        escalatedByManager.set(property.managerId, managerItems);
      }

      for (const [managerId, items] of Array.from(escalatedByManager.entries())) {
        try {
          const manager = await storage.getUser(managerId);
          if (!manager?.email) continue;
          const subject = `Maintenance SLA Escalations: ${items.length} request${items.length === 1 ? "" : "s"}`;
          const htmlLines = items
            .map((item) => `Request #${item.id} (${item.propertyAddress}) escalated to ${item.priority}.`)
            .join("<br/>");
          await sendAuthEmail({
            to: manager.email,
            subject,
            html: `<p>The following maintenance requests breached SLA and were escalated automatically:</p><p>${htmlLines}</p>`,
            text: `The following maintenance requests breached SLA and were escalated automatically:\n${items
              .map((item) => `Request #${item.id} (${item.propertyAddress}) escalated to ${item.priority}.`)
              .join("\n")}`,
          });
        } catch (error) {
          console.error(`Failed to send maintenance escalation email for manager ${managerId}:`, error);
        }
      }
    } catch (error) {
      if (isMissingRelationError(error)) {
        console.warn("Maintenance automation settings table is missing. Run migrations (npm run db:push) to enable settings menu.");
        return;
      }
      throw error;
    }
  };

  const maintenanceEscalationInterval = setInterval(() => {
    void triggerMaintenanceEscalationScan();
  }, MAINTENANCE_ESCALATION_SCAN_INTERVAL_MS);
  httpServer.on("close", () => clearInterval(maintenanceEscalationInterval));
  setTimeout(() => {
    void triggerMaintenanceEscalationScan();
  }, 20_000);

  const getManagerScopedData = async (managerId: string) => {
    const managerProperties = await storage.getPropertiesByManager(managerId);
    const propertyIds = new Set(managerProperties.map((p) => p.id));
    const managerLeases = await storage.getLeasesByManager(managerId);
    const leaseIds = new Set(managerLeases.map((l) => l.id));
    const allMaintenance = await storage.getMaintenanceRequests();
    const managerMaintenance = allMaintenance.filter((m) => propertyIds.has(m.propertyId));
    const allPayments = await storage.getPayments();
    const managerPayments = allPayments.filter((p) => leaseIds.has(p.leaseId));
    return { managerProperties, managerLeases, managerMaintenance, managerPayments };
  };
  
  // Seed Database (Non-blocking)
  seedDatabase().catch(console.error);

  // 1. Setup Auth
  await setupAuth(app);
  registerAuthRoutes(app);

  // 2. Setup Integrations
  registerChatRoutes(app);
  registerImageRoutes(app);

  // 3. Application Routes
  
  // === Properties ===
  app.get(api.properties.list.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const dbUser = await storage.getUser(userId);
    const input = api.properties.list.input.parse(req.query ?? {});
    const allProperties =
      dbUser?.role === "manager" ? await storage.getPropertiesByManager(userId) : await storage.getProperties();

    const filtered = allProperties.filter((property) => {
      if (input?.status && property.status !== input.status) {
        return false;
      }

      if (!input?.search?.trim()) {
        return true;
      }

      const search = input.search.trim().toLowerCase();
      const haystack = [
        property.address,
        property.city,
        property.state,
        property.zipCode,
        property.description ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });

    res.json(filtered);
  });

  app.get(api.properties.get.path, async (req, res) => {
    const property = await storage.getProperty(Number(req.params.id));
    if (!property) return res.status(404).json({ message: "Property not found" });
    res.json(property);
  });

  app.post(api.properties.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const dbUser = await storage.getUser(userId);
      if (dbUser?.role !== "manager") {
        return res.status(403).json({ message: "Only managers can create properties." });
      }
      const input = api.properties.create.input.parse(req.body);
      const property = await storage.createProperty({
        ...input,
        managerId: userId,
      });
      res.status(201).json(property);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.properties.update.path, async (req, res) => {
     try {
      const input = api.properties.update.input.parse(req.body);
      const property = await storage.updateProperty(Number(req.params.id), input);
      if (!property) return res.status(404).json({ message: "Property not found" });
      res.json(property);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.properties.delete.path, async (req, res) => {
    await storage.deleteProperty(Number(req.params.id));
    res.status(204).send();
  });

  // === Listing Exports ===
  app.get(api.listingExports.templatesList.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const dbUser = await storage.getUser(userId);
    if (dbUser?.role !== "manager") {
      return res.status(403).json({ message: "Only managers can manage listing templates" });
    }

    const templates = await storage.getListingMappingTemplatesByManager(userId);
    res.json(templates);
  });

  app.post(api.listingExports.templatesCreate.path, isAuthenticated, requireStepUpAuth, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const dbUser = await storage.getUser(userId);
    if (dbUser?.role !== "manager") {
      return res.status(403).json({ message: "Only managers can manage listing templates" });
    }

    const input = api.listingExports.templatesCreate.input.parse(req.body);
    const template = await storage.createListingMappingTemplate({
      managerId: userId,
      name: input.name.trim(),
      mapping: input.mapping,
    });
    res.status(201).json(template);
  });

  app.delete(api.listingExports.templatesDelete.path, isAuthenticated, requireStepUpAuth, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const dbUser = await storage.getUser(userId);
    if (dbUser?.role !== "manager") {
      return res.status(403).json({ message: "Only managers can manage listing templates" });
    }

    const id = Number(req.params.id);
    const template = await storage.getListingMappingTemplate(id);
    if (!template) return res.status(404).json({ message: "Template not found" });
    if (template.managerId !== userId) return res.status(403).json({ message: "Forbidden" });

    await storage.deleteListingMappingTemplate(id);
    res.status(204).send();
  });

  app.get(api.listingExports.availableProperties.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const dbUser = await storage.getUser(userId);
    if (dbUser?.role !== "manager") {
      return res.status(403).json({ message: "Only managers can export listings" });
    }

    const input = api.listingExports.availableProperties.input.parse(req.query ?? {});
    const managerProperties = await storage.getPropertiesByManager(userId);
    let availableProperties = managerProperties.filter((property) => property.status === "available");

    // If this manager has no available inventory yet, fall back to global available
    // inventory so the syndication module remains usable in demo/migrated datasets.
    if (availableProperties.length === 0) {
      const allProperties = await storage.getProperties();
      availableProperties = allProperties.filter((property) => property.status === "available");
    }

    if (!input?.search?.trim()) {
      return res.json(availableProperties);
    }

    const search = input.search.trim().toLowerCase();
    const filtered = availableProperties.filter((property) =>
      `${property.address} ${property.city} ${property.state} ${property.zipCode} ${property.description ?? ""}`
        .toLowerCase()
        .includes(search)
    );

    res.json(filtered);
  });

  app.post(api.listingExports.zillow.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const dbUser = await storage.getUser(userId);
    if (dbUser?.role !== "manager") {
      return res.status(403).json({ message: "Only managers can export listings" });
    }

    const input = api.listingExports.zillow.input.parse(req.body);
    const property = await storage.getProperty(input.propertyId);

    if (!property) return res.status(404).json({ message: "Property not found" });
    if (property.managerId !== userId) return res.status(403).json({ message: "Forbidden" });

    const payload = buildZillowListingXml(property, input.mapping);
    const missingFields = collectMissingListingFields(property);

    res.json({
      propertyId: property.id,
      platform: "zillow",
      payload,
      missingFields,
    });
  });

  app.post(api.listingExports.apartments.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const dbUser = await storage.getUser(userId);
    if (dbUser?.role !== "manager") {
      return res.status(403).json({ message: "Only managers can export listings" });
    }

    const input = api.listingExports.apartments.input.parse(req.body);
    const property = await storage.getProperty(input.propertyId);

    if (!property) return res.status(404).json({ message: "Property not found" });
    if (property.managerId !== userId) return res.status(403).json({ message: "Forbidden" });

    const exports = buildApartmentsPayload(property, input.mapping);
    const missingFields = collectMissingListingFields(property);

    res.json({
      propertyId: property.id,
      platform: "apartments.com",
      payload: exports.json,
      csv: exports.csv,
      missingFields,
    });
  });

  app.post(api.listingExports.publishZillow.path, isAuthenticated, requireStepUpAuth, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const dbUser = await storage.getUser(userId);
    if (dbUser?.role !== "manager") {
      return res.status(403).json({ message: "Only managers can publish listings" });
    }

    const publishUrl = process.env.LISTING_PUBLISH_ZILLOW_URL;
    if (!publishUrl) {
      return res.status(400).json({
        message: "LISTING_PUBLISH_ZILLOW_URL is not configured",
      });
    }

    const input = api.listingExports.publishZillow.input.parse(req.body);
    const property = await storage.getProperty(input.propertyId);
    if (!property) return res.status(404).json({ message: "Property not found" });
    if (property.managerId !== userId) return res.status(403).json({ message: "Forbidden" });

    const payload = buildZillowListingXml(property, input.mapping);
    const result = await publishPayload({
      url: publishUrl,
      payload,
      contentType: "application/xml",
      apiKey: process.env.LISTING_PUBLISH_ZILLOW_API_KEY,
    });

    res.json({
      platform: "zillow",
      propertyId: property.id,
      ...result,
    });
  });

  app.post(api.listingExports.publishApartments.path, isAuthenticated, requireStepUpAuth, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const dbUser = await storage.getUser(userId);
    if (dbUser?.role !== "manager") {
      return res.status(403).json({ message: "Only managers can publish listings" });
    }

    const publishUrl = process.env.LISTING_PUBLISH_APARTMENTS_URL;
    if (!publishUrl) {
      return res.status(400).json({
        message: "LISTING_PUBLISH_APARTMENTS_URL is not configured",
      });
    }

    const input = api.listingExports.publishApartments.input.parse(req.body);
    const property = await storage.getProperty(input.propertyId);
    if (!property) return res.status(404).json({ message: "Property not found" });
    if (property.managerId !== userId) return res.status(403).json({ message: "Forbidden" });

    const exports = buildApartmentsPayload(property, input.mapping);
    const format = input.format ?? "json";
    const isCsv = format === "csv";

    const result = await publishPayload({
      url: publishUrl,
      payload: isCsv ? exports.csv : exports.json,
      contentType: isCsv ? "text/csv" : "application/json",
      apiKey: process.env.LISTING_PUBLISH_APARTMENTS_API_KEY,
    });

    res.json({
      platform: "apartments.com",
      propertyId: property.id,
      format,
      ...result,
    });
  });

  // === STR Market (Investor) ===
  app.get(api.strMarket.get.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const dbUser = await storage.getUser(userId);
    if (dbUser?.role !== "investor" && dbUser?.role !== "manager") {
      return res.status(403).json({ message: "Only investors and managers can view STR market data" });
    }

    const listing = await storage.getStrMarketListing(Number(req.params.id));
    if (!listing) return res.status(404).json({ message: "STR listing not found" });
    res.json(listing);
  });

  app.get(api.strMarket.list.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const dbUser = await storage.getUser(userId);
    if (dbUser?.role !== "investor" && dbUser?.role !== "manager") {
      return res.status(403).json({ message: "Only investors and managers can view STR market data" });
    }

    const input = api.strMarket.list.input?.parse(req.query ?? {});
    let listings = await ensureStrMarketListingsAreFresh();

    const US_STATE_CODES_TO_NAMES: Record<string, string> = {
      al: "alabama", ak: "alaska", az: "arizona", ar: "arkansas", ca: "california", co: "colorado",
      ct: "connecticut", de: "delaware", fl: "florida", ga: "georgia", hi: "hawaii", id: "idaho",
      il: "illinois", in: "indiana", ia: "iowa", ks: "kansas", ky: "kentucky", la: "louisiana",
      me: "maine", md: "maryland", ma: "massachusetts", mi: "michigan", mn: "minnesota", ms: "mississippi",
      mo: "missouri", mt: "montana", ne: "nebraska", nv: "nevada", nh: "new hampshire", nj: "new jersey",
      nm: "new mexico", ny: "new york", nc: "north carolina", nd: "north dakota", oh: "ohio", ok: "oklahoma",
      or: "oregon", pa: "pennsylvania", ri: "rhode island", sc: "south carolina", sd: "south dakota", tn: "tennessee",
      tx: "texas", ut: "utah", vt: "vermont", va: "virginia", wa: "washington", wv: "west virginia",
      wi: "wisconsin", wy: "wyoming", dc: "district of columbia",
    };
    const US_STATE_NAMES_TO_CODES = Object.fromEntries(
      Object.entries(US_STATE_CODES_TO_NAMES).map(([code, name]) => [name, code])
    );
    const normalizeRegion = (value?: string | null) => {
      const normalized = (value ?? "").trim().toLowerCase().replace(/[_-]+/g, " ");
      if (!normalized) return "";
      const compact = normalized.replace(/\./g, "");
      if (US_STATE_CODES_TO_NAMES[compact]) return US_STATE_CODES_TO_NAMES[compact];
      if (US_STATE_NAMES_TO_CODES[compact]) return compact;
      return compact;
    };

    const normalizedSearch = input?.search?.trim().toLowerCase();
    const cityFilter = input?.city?.trim().toLowerCase();
    const regionFilter = normalizeRegion(input?.region);
    const roomTypeFilter = input?.roomType?.trim().toLowerCase();
    const filtered = listings.filter((listing) => {
      if (cityFilter && listing.sourceCity.toLowerCase() !== cityFilter) return false;
      if (regionFilter) {
        const listingRegion = normalizeRegion(listing.sourceRegion);
        if (listingRegion !== regionFilter) return false;
      }
      if (roomTypeFilter) {
        if ((listing.roomType ?? "").toLowerCase() !== roomTypeFilter) return false;
      }
      if (input?.minAnnualReturn !== undefined && Number(listing.expectedAnnualReturn) < input.minAnnualReturn) {
        return false;
      }
      if (input?.maxNightlyRate !== undefined && Number(listing.nightlyRate) > input.maxNightlyRate) {
        return false;
      }
      if (input?.minOccupancyRate !== undefined && Number(listing.expectedOccupancyRate) < input.minOccupancyRate) {
        return false;
      }
      if (!normalizedSearch) return true;
      const haystack = [
        listing.title ?? "",
        listing.sourceCity ?? "",
        listing.sourceRegion ?? "",
        normalizeRegion(listing.sourceRegion),
        listing.neighbourhood ?? "",
        listing.roomType ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });

    const limit = input?.limit ?? 100;
    res.json(filtered.slice(0, limit));
  });

  app.post(api.strMarket.sync.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const dbUser = await storage.getUser(userId);
    if (dbUser?.role !== "investor" && dbUser?.role !== "manager") {
      return res.status(403).json({ message: "Only investors and managers can sync STR data" });
    }

    const scraped = await scrapePublicStrListings();
    const stored = await storage.replaceStrMarketListings(scraped);
    res.json({
      scrapedCount: scraped.length,
      storedCount: stored.length,
      source: "insideairbnb",
      syncedAt: new Date().toISOString(),
    });
  });

  // === Leases ===
  app.get(api.leases.list.path, isAuthenticated, async (req: any, res) => {
    const user = req.user as any;
    if (!user?.claims?.sub) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = user.claims.sub;
    const dbUser = await storage.getUser(userId);

    console.log(`Lease API Request - User: ${userId}, Role: ${dbUser?.role}`);

    let leaseList;
    if (dbUser?.role === "manager") {
      leaseList = await storage.getLeasesByManager(userId);
    } else {
      leaseList = await storage.getLeasesByTenant(userId);
    }
    
    console.log(`Lease API Response - Count: ${leaseList.length}`);
    res.json(leaseList);
  });

  app.post(api.leases.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const dbUser = await storage.getUser(userId);
      if (dbUser?.role !== "manager") {
        return res.status(403).json({ message: "Only managers can create leases." });
      }

      const input = api.leases.create.input.parse(req.body);
      const property = await storage.getProperty(input.propertyId);
      if (!property) return res.status(404).json({ message: "Property not found." });
      if (property.managerId !== userId) {
        return res.status(403).json({ message: "You can only create leases for your own properties." });
      }
      const tenant = await storage.getUser(input.tenantId);
      if (!tenant || tenant.role !== "tenant") {
        return res.status(400).json({ message: "Selected tenant is invalid." });
      }

      const lease = await storage.createLease(input);
      res.status(201).json(lease);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.message });
      throw err;
    }
  });

  app.patch("/api/leases/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const lease = await storage.updateLease(id, req.body);
      res.json(lease);
    } catch (err) {
      res.status(400).json({ message: "Failed to update lease" });
    }
  });

  // AI Lease Generation
  app.post(api.leases.generateDoc.path, async (req, res) => {
    try {
      const leaseId = Number(req.params.id);
      const lease = await storage.getLease(leaseId);
      if (!lease) return res.status(404).json({ message: "Lease not found" });
      
      const property = await storage.getProperty(lease.propertyId);

      const prompt = `Generate a residential lease agreement for the property at ${property?.address}, ${property?.city}, ${property?.state}. 
      Rent: $${lease.rentAmount}. 
      Start Date: ${lease.startDate}. 
      End Date: ${lease.endDate}. 
      Tenant ID: ${lease.tenantId}.
      Include standard clauses for maintenance, security deposit, and utilities. Output as clear professional text.`;

      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [{ role: "user", content: prompt }],
      });

      const draftText = response.choices[0]?.message?.content || "Failed to generate.";

      // Update lease with draft text
      await storage.updateLease(leaseId, { draftText });

      res.json({ documentText: draftText });
    } catch (error) {
      console.error("AI Generation Error:", error);
      const err = error as any;
      const isQuotaError =
        err?.status === 429 ||
        err?.code === "insufficient_quota" ||
        err?.error?.code === "insufficient_quota";

      if (isQuotaError) {
        try {
          const leaseId = Number(req.params.id);
          const lease = await storage.getLease(leaseId);
          if (!lease) return res.status(404).json({ message: "Lease not found" });
          const property = await storage.getProperty(lease.propertyId);

          const fallbackDraft = `RESIDENTIAL LEASE AGREEMENT (Template)\n\nProperty Address: ${property?.address ?? "N/A"}, ${property?.city ?? ""}, ${property?.state ?? ""}\nTenant ID: ${lease.tenantId}\nLease Term: ${lease.startDate} to ${lease.endDate}\nMonthly Rent: $${lease.rentAmount}\n\n1. Term and Possession\nTenant agrees to rent the premises for the term stated above.\n\n2. Rent and Fees\nRent is due monthly in advance on the first day of each month.\nLate fees and returned payment fees may apply as permitted by law.\n\n3. Security Deposit\nA security deposit may be required and handled according to applicable state/local law.\n\n4. Utilities and Services\nTenant is responsible for utilities unless otherwise agreed in writing.\n\n5. Maintenance and Repairs\nTenant must keep premises clean and promptly report maintenance issues.\nLandlord will maintain major systems and structural elements as required by law.\n\n6. Use and Occupancy\nPremises shall be used for residential purposes only.\nSubletting/assignment requires written consent unless prohibited by law.\n\n7. Rules, Access, and Compliance\nTenant agrees to comply with property rules and applicable laws.\nLandlord may enter with proper notice as permitted by law.\n\n8. Default and Termination\nFailure to pay rent or material lease violations may result in remedies allowed by law.\n\n9. Governing Law\nThis lease is governed by applicable state and local landlord-tenant law.\n\nNote: This is a fallback template generated because AI quota is unavailable. Review and customize before use.`;

          await storage.updateLease(leaseId, { draftText: fallbackDraft });
          return res.status(200).json({
            documentText: fallbackDraft,
            message: "AI quota exceeded. Generated fallback template instead.",
            generatedBy: "template",
          });
        } catch (fallbackError) {
          console.error("Fallback Draft Error:", fallbackError);
        }
      }

      res.status(500).json({ message: "AI generation failed" });
    }
  });

  app.post(api.leases.sendForSigning.path, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const manager = await storage.getUser(userId);
      if (!manager || manager.role !== "manager") return res.status(403).json({ message: "Only managers can send leases for signing." });

      const leaseId = Number(req.params.id);
      const lease = await storage.getLease(leaseId);
      if (!lease) return res.status(404).json({ message: "Lease not found" });
      const property = await storage.getProperty(lease.propertyId);
      if (!property || property.managerId !== userId) {
        return res.status(403).json({ message: "Forbidden: you can only send signing requests for your own properties." });
      }

      const tenant = await storage.getUser(lease.tenantId);
      if (!tenant?.email) return res.status(400).json({ message: "Tenant email is missing." });

      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const signingRequest = await storage.createLeaseSigningRequest({
        leaseId: lease.id,
        managerId: userId,
        tenantId: lease.tenantId,
        tenantEmail: tenant.email,
        tokenHash,
        status: "pending",
        expiresAt,
      });

      const signingLink = `${getPublicAppBaseUrl()}/lease-sign/${encodeURIComponent(rawToken)}`;
      await sendAuthEmail({
        to: tenant.email,
        subject: "Lease ready for your signature",
        html: `<p>Your lease is ready to sign for <strong>${property.address}</strong>.</p><p><a href="${signingLink}">Review & Sign Lease</a></p><p>This secure link expires on ${expiresAt.toLocaleString()}.</p>`,
        text: `Your lease is ready for signature.\nProperty: ${property.address}\nSign here: ${signingLink}\nThis link expires on ${expiresAt.toISOString()}.`,
      });

      return res.json({
        leaseId: lease.id,
        status: signingRequest.status,
        expiresAt: expiresAt.toISOString(),
        sentTo: tenant.email,
        signingLink: process.env.NODE_ENV !== "production" ? signingLink : undefined,
      });
    } catch (error) {
      if (isMissingRelationError(error)) {
        return res.status(503).json({ message: "Lease signing tables are missing. Run database migrations first." });
      }
      console.error("Lease signing request error:", error);
      return res.status(500).json({ message: "Failed to send lease for signing." });
    }
  });

  app.get(api.leases.signingStatus.path, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const dbUser = await storage.getUser(userId);
      if (!dbUser) return res.status(401).json({ message: "Unauthorized" });

      const leaseId = Number(req.params.id);
      const lease = await storage.getLease(leaseId);
      if (!lease) return res.status(404).json({ message: "Lease not found" });
      const property = await storage.getProperty(lease.propertyId);
      const isManagerAllowed = dbUser.role === "manager" && property?.managerId === userId;
      const isTenantAllowed = dbUser.role === "tenant" && lease.tenantId === userId;
      if (!isManagerAllowed && !isTenantAllowed) return res.status(403).json({ message: "Forbidden" });

      const signing = await storage.getLatestLeaseSigningRequestByLease(lease.id);
      return res.json({
        leaseId: lease.id,
        status: signing?.status ?? "not_requested",
        createdAt: signing?.createdAt ? new Date(signing.createdAt).toISOString() : null,
        expiresAt: signing?.expiresAt ? new Date(signing.expiresAt).toISOString() : null,
        signedAt: signing?.signedAt ? new Date(signing.signedAt).toISOString() : null,
        signedFullName: signing?.signedFullName ?? null,
        tenantEmail: signing?.tenantEmail ?? null,
      });
    } catch (error) {
      if (isMissingRelationError(error)) {
        return res.status(503).json({ message: "Lease signing tables are missing. Run database migrations first." });
      }
      return res.status(500).json({ message: "Failed to fetch signing status." });
    }
  });

  app.get(api.leases.signingValidate.path, async (req, res) => {
    try {
      const input = api.leases.signingValidate.input.parse(req.query ?? {});
      const signing = await storage.getLeaseSigningRequestByTokenHash(hashToken(input.token));
      if (!signing) return res.json({ valid: false });

      const now = Date.now();
      const expired = new Date(signing.expiresAt).getTime() < now;
      if (signing.status !== "pending" || expired) {
        return res.json({
          valid: false,
          leaseId: signing.leaseId,
          status: expired ? "expired" : signing.status,
          expiresAt: new Date(signing.expiresAt).toISOString(),
        });
      }

      const lease = await storage.getLease(signing.leaseId);
      const property = lease ? await storage.getProperty(lease.propertyId) : undefined;
      return res.json({
        valid: true,
        leaseId: signing.leaseId,
        status: signing.status,
        expiresAt: new Date(signing.expiresAt).toISOString(),
        propertyAddress: property ? `${property.address}, ${property.city}, ${property.state}` : undefined,
        rentAmount: lease ? Number(lease.rentAmount) : undefined,
        tenantEmail: signing.tenantEmail,
      });
    } catch {
      return res.status(400).json({ valid: false });
    }
  });

  app.post(api.leases.signingComplete.path, async (req, res) => {
    try {
      const input = leaseSigningCompleteSchema.parse(req.body);
      const signing = await storage.getLeaseSigningRequestByTokenHash(hashToken(input.token));
      if (!signing) return res.status(400).json({ message: "Invalid signing link." });
      if (signing.status !== "pending") return res.status(400).json({ message: "This signing request is no longer pending." });
      if (new Date(signing.expiresAt).getTime() < Date.now()) {
        return res.status(400).json({ message: "This signing link has expired." });
      }

      const signed = await storage.markLeaseSigningCompleted({
        signingRequestId: signing.id,
        signedFullName: input.fullName.trim(),
        signedFromIp: req.ip || req.socket?.remoteAddress || undefined,
      });

      const lease = await storage.getLease(signing.leaseId);
      if (lease?.draftText) {
        const signatureFooter = `\n\n---\nDigitally signed by ${signed.signedFullName} on ${new Date(signed.signedAt!).toLocaleString()}\n`;
        await storage.updateLease(lease.id, { draftText: `${lease.draftText}${signatureFooter}` });
      }

      return res.json({
        message: "Lease signed successfully.",
        leaseId: signing.leaseId,
        signedAt: new Date(signed.signedAt!).toISOString(),
        signedFullName: signed.signedFullName!,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Invalid signature payload." });
      }
      if (isMissingRelationError(error)) {
        return res.status(503).json({ message: "Lease signing tables are missing. Run database migrations first." });
      }
      return res.status(500).json({ message: "Failed to complete lease signing." });
    }
  });

  app.get(api.leases.expiryNotificationSettings.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const dbUser = await storage.getUser(userId);
    if (dbUser?.role !== "manager") return res.status(403).json({ message: "Forbidden" });
    try {
      const settings = await getManagerLeaseExpirySettings(userId);
      return res.json({
        ...settings,
        daysBeforeExpiry: normalizeLeaseExpiryDays(settings.daysBeforeExpiry),
        updatedAt: settings.updatedAt ? settings.updatedAt.toISOString() : null,
      });
    } catch (error) {
      if (isMissingRelationError(error)) {
        return res.status(503).json({ message: "Lease expiry settings tables are missing. Run database migrations first." });
      }
      return res.status(500).json({ message: "Failed to fetch settings." });
    }
  });

  app.put(api.leases.updateExpiryNotificationSettings.path, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const dbUser = await storage.getUser(userId);
      if (dbUser?.role !== "manager") return res.status(403).json({ message: "Forbidden" });

      const input = api.leases.updateExpiryNotificationSettings.input.parse(req.body);
      const settings = await storage.upsertManagerLeaseExpiryNotificationSettings({
        managerId: userId,
        enabled: input.enabled,
        daysBeforeExpiry: normalizeLeaseExpiryDays(input.daysBeforeExpiry),
      });
      if (settings.enabled) {
        void triggerLeaseExpiryScan(userId);
      }
      return res.json({
        ...settings,
        daysBeforeExpiry: normalizeLeaseExpiryDays(settings.daysBeforeExpiry),
        updatedAt: settings.updatedAt ? settings.updatedAt.toISOString() : null,
      });
    } catch (error) {
      if (isMissingRelationError(error)) {
        return res.status(503).json({ message: "Lease expiry settings tables are missing. Run database migrations first." });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Invalid settings payload." });
      }
      return res.status(500).json({ message: "Failed to update settings." });
    }
  });

  app.post("/api/internal/jobs/lease-expiry-scan", async (req, res) => {
    const expectedSecret = process.env.CRON_SECRET;
    const providedSecret = String(req.headers["x-cron-secret"] || "");
    if (process.env.NODE_ENV === "production" && !expectedSecret) {
      return res.status(503).json({ message: "CRON_SECRET is not configured." });
    }
    if (expectedSecret && providedSecret !== expectedSecret) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    await triggerLeaseExpiryScan();
    return res.json({ message: "Lease expiry scan completed." });
  });

  app.post("/api/internal/jobs/maintenance-escalation-scan", async (req, res) => {
    const expectedSecret = process.env.CRON_SECRET;
    const providedSecret = String(req.headers["x-cron-secret"] || "");
    if (process.env.NODE_ENV === "production" && !expectedSecret) {
      return res.status(503).json({ message: "CRON_SECRET is not configured." });
    }
    if (expectedSecret && providedSecret !== expectedSecret) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    await triggerMaintenanceEscalationScan();
    return res.json({ message: "Maintenance escalation scan completed." });
  });

  // === Maintenance ===
  app.get(api.maintenance.automationSettings.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUser(userId);
    if (user?.role !== "manager") {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const settings = await getManagerMaintenanceAutomationSettings(userId);
      return res.json({
        managerId: settings.managerId,
        autoTriageEnabled: settings.autoTriageEnabled,
        autoEscalationEnabled: settings.autoEscalationEnabled,
        autoVendorAssignmentEnabled: settings.autoVendorAssignmentEnabled,
        updatedAt: settings.updatedAt ? settings.updatedAt.toISOString() : null,
      });
    } catch (error) {
      if (isMissingRelationError(error)) {
        return res.status(503).json({ message: "Maintenance settings table is missing. Run database migrations first." });
      }
      return res.status(500).json({ message: "Failed to load maintenance settings." });
    }
  });

  app.put(api.maintenance.updateAutomationSettings.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUser(userId);
    if (user?.role !== "manager") {
      return res.status(403).json({ message: "Forbidden" });
    }
    try {
      const input = api.maintenance.updateAutomationSettings.input.parse(req.body);
      const settings = await storage.upsertManagerMaintenanceAutomationSettings({
        managerId: userId,
        autoTriageEnabled: input.autoTriageEnabled,
        autoEscalationEnabled: input.autoEscalationEnabled,
        autoVendorAssignmentEnabled: input.autoVendorAssignmentEnabled,
      });
      return res.json({
        managerId: settings.managerId,
        autoTriageEnabled: settings.autoTriageEnabled,
        autoEscalationEnabled: settings.autoEscalationEnabled,
        autoVendorAssignmentEnabled: settings.autoVendorAssignmentEnabled,
        updatedAt: settings.updatedAt ? settings.updatedAt.toISOString() : null,
      });
    } catch (error) {
      if (isMissingRelationError(error)) {
        return res.status(503).json({ message: "Maintenance settings table is missing. Run database migrations first." });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Invalid settings payload." });
      }
      return res.status(500).json({ message: "Failed to update maintenance settings." });
    }
  });

  app.get(api.maintenance.list.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const dbUser = await storage.getUser(userId);
    if (dbUser?.role === "manager") {
      await triggerMaintenanceEscalationScan(userId);
    }
    const requests = await storage.getMaintenanceRequests();

    if (dbUser?.role === "manager") {
      const managerProperties = await storage.getPropertiesByManager(userId);
      const propertyIds = new Set(managerProperties.map((p) => p.id));
      return res.json(requests.filter((r) => propertyIds.has(r.propertyId)));
    }

    return res.json(requests.filter((r) => r.tenantId === userId));
  });

  app.post(api.maintenance.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const dbUser = await storage.getUser(userId);
      const input = api.maintenance.create.input.parse(req.body);
      if (dbUser?.role !== "manager" && input.tenantId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const property = await storage.getProperty(input.propertyId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      if (dbUser?.role === "manager" && property.managerId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const managerSettings = await getManagerMaintenanceAutomationSettings(property.managerId);
      const triage = triageMaintenanceRequest(input.title, input.description);
      const resolvedCategory = managerSettings.autoTriageEnabled ? triage.category : "general";
      const resolvedPriority = managerSettings.autoTriageEnabled ? triage.priority : (input.priority || "medium");
      const slaDueAt = new Date(Date.now() + getSlaHoursForPriority(resolvedPriority) * 60 * 60 * 1000);
      const assignment = managerSettings.autoVendorAssignmentEnabled
        ? autoAssignVendor({
            category: resolvedCategory,
            propertyState: property.state,
          })
        : null;
      const automationSummary = managerSettings.autoTriageEnabled
        ? triage.summary
        : "Automation: Auto-triage disabled by manager settings.";

      const request = await storage.createMaintenanceRequest({
        ...input,
        category: resolvedCategory,
        priority: resolvedPriority,
        slaDueAt,
        assignedVendor: assignment?.vendorName ?? null,
        assignmentNote: assignment?.note ?? "Auto-assignment disabled by manager settings.",
        aiAnalysis: automationSummary,
      });
      res.status(201).json(request);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.message });
      throw err;
    }
  });

  app.patch(api.maintenance.update.path, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const dbUser = await storage.getUser(userId);
      const requestId = Number(req.params.id);
      const existing = await storage.getMaintenanceRequest(requestId);
      if (!existing) return res.status(404).json({ message: "Request not found" });

      if (dbUser?.role === "manager") {
        const property = await storage.getProperty(existing.propertyId);
        if (!property || property.managerId !== userId) {
          return res.status(403).json({ message: "Forbidden" });
        }
      } else if (existing.tenantId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const input = api.maintenance.update.input.parse(req.body);
      const request = await storage.updateMaintenanceRequest(requestId, input);
      if (!request) return res.status(404).json({ message: "Request not found" });
      res.json(request);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.message });
      throw err;
    }
  });

  // AI Maintenance Analysis
  app.post(api.maintenance.analyze.path, async (req, res) => {
    try {
      const reqId = Number(req.params.id);
      const maintenanceRequest = await storage.getMaintenanceRequest(reqId);
      if (!maintenanceRequest) return res.status(404).json({ message: "Request not found" });

      const prompt = `Analyze this maintenance request: "${maintenanceRequest.title} - ${maintenanceRequest.description}".
      Categorize the priority (Low, Medium, High, Emergency) and suggest a trade (Plumbing, Electrical, HVAC, General).
      Format: "Priority: [Priority], Trade: [Trade]. Suggestion: [Brief suggestion]"`;

       const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [{ role: "user", content: prompt }],
      });
      
      const analysis = response.choices[0]?.message?.content || "Analysis failed.";
      
      // Save analysis to DB
      await storage.updateMaintenanceRequest(reqId, { aiAnalysis: analysis });

      res.json({ analysis });
    } catch (error) {
       console.error("AI Analysis Error:", error);
      res.status(500).json({ message: "AI analysis failed" });
    }
  });

  // === Accounting / Payments ===
  app.get(api.payments.list.path, isAuthenticated, async (req: any, res) => {
    const user = req.user as any;
    if (!user?.claims?.sub) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const dbUser = await storage.getUser(user.claims.sub);
    
    let paymentList;
    if (dbUser?.role === "manager") {
      paymentList = await storage.getPayments();
    } else {
      // Find active leases for this tenant
      const tenantLeases = await storage.getLeasesByTenant(user.claims.sub);
      const leaseIds = tenantLeases.map(l => l.id);
      const allPayments = await storage.getPayments();
      paymentList = allPayments.filter(p => leaseIds.includes(p.leaseId));
    }
    res.json(paymentList);
  });

  app.get("/api/accounting/summary", isAuthenticated, async (req: any, res) => {
    const user = req.user as any;
    if (!user?.claims?.sub) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = user.claims.sub;
    const dbUser = await storage.getUser(userId);

    let scopedPayments = await storage.getPayments();
    if (dbUser?.role !== "manager") {
      const tenantLeases = await storage.getLeasesByTenant(userId);
      const leaseIds = tenantLeases.map((l) => l.id);
      scopedPayments = scopedPayments.filter((p) => leaseIds.includes(p.leaseId));
    }

    const totalCollected = scopedPayments
      .filter(p => p.status === "paid")
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const pending = scopedPayments
      .filter(p => p.status === "pending")
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const overdue = scopedPayments
      .filter(p => p.status === "overdue")
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const now = new Date();
    const sixMonthBuckets: { label: string; collected: number; outstanding: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const label = d.toLocaleDateString("en-US", { month: "short" });
      const monthPayments = scopedPayments.filter((p) => {
        const pd = new Date(p.date ?? new Date());
        return pd.getFullYear() === year && pd.getMonth() === month;
      });
      sixMonthBuckets.push({
        label,
        collected: monthPayments
          .filter((p) => p.status === "paid")
          .reduce((sum, p) => sum + Number(p.amount), 0),
        outstanding: monthPayments
          .filter((p) => p.status === "pending" || p.status === "overdue")
          .reduce((sum, p) => sum + Number(p.amount), 0),
      });
    }

    res.json({
      totalCollected,
      pending,
      overdue,
      outstanding: pending + overdue,
      paymentCount: scopedPayments.length,
      chart: sixMonthBuckets,
    });
  });

  app.get(api.accounting.rentOverdueNotificationSettings.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const dbUser = await storage.getUser(userId);
    if (dbUser?.role !== "manager") return res.status(403).json({ message: "Forbidden" });
    let settings;
    try {
      settings = await getManagerNotificationSettings(userId);
    } catch (error) {
      if (isMissingRelationError(error)) {
        return res.status(503).json({ message: "Notification settings tables are missing. Run database migrations first." });
      }
      throw error;
    }
    return res.json({
      ...settings,
      overdueDays: normalizeOverdueDays(settings.overdueDays),
      updatedAt: settings.updatedAt ? settings.updatedAt.toISOString() : null,
    });
  });

  app.put(api.accounting.updateRentOverdueNotificationSettings.path, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const dbUser = await storage.getUser(userId);
      if (dbUser?.role !== "manager") return res.status(403).json({ message: "Forbidden" });

      const input = api.accounting.updateRentOverdueNotificationSettings.input.parse(req.body);
      const settings = await storage.upsertManagerRentNotificationSettings({
        managerId: userId,
        enabled: input.enabled,
        overdueDays: normalizeOverdueDays(input.overdueDays),
      });

      if (settings.enabled) {
        void triggerRentOverdueScan(userId);
      }

      return res.json({
        ...settings,
        overdueDays: normalizeOverdueDays(settings.overdueDays),
        updatedAt: settings.updatedAt ? settings.updatedAt.toISOString() : null,
      });
    } catch (error) {
      if (isMissingRelationError(error)) {
        return res.status(503).json({ message: "Notification settings tables are missing. Run database migrations first." });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Invalid settings payload." });
      }
      return res.status(500).json({ message: "Failed to update settings." });
    }
  });

  app.post("/api/internal/jobs/rent-overdue-scan", async (req, res) => {
    const expectedSecret = process.env.CRON_SECRET;
    const providedSecret = String(req.headers["x-cron-secret"] || "");
    if (process.env.NODE_ENV === "production" && !expectedSecret) {
      return res.status(503).json({ message: "CRON_SECRET is not configured." });
    }
    if (expectedSecret && providedSecret !== expectedSecret) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    await triggerRentOverdueScan();
    return res.json({ message: "Rent overdue scan completed." });
  });

  app.get("/api/insights/alerts", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const dbUser = await storage.getUser(userId);
    if (!dbUser) return res.status(401).json({ message: "Unauthorized" });

    const now = new Date();
    const alerts: Array<{
      id: string;
      type: "overdue_rent" | "lease_expiry" | "maintenance_stalled" | "data_sync" | "vacancy_risk";
      severity: "high" | "medium" | "low";
      title: string;
      detail: string;
      propertyId?: number;
      leaseId?: number;
      createdAt: string;
    }> = [];

    if (dbUser.role === "manager") {
      const { managerProperties, managerLeases, managerMaintenance, managerPayments } = await getManagerScopedData(userId);

      const activeLeases = managerLeases.filter((l) => l.status === "active");
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      for (const lease of activeLeases) {
        const monthRentPaid = managerPayments
          .filter((p) => {
            const pd = new Date(p.date ?? new Date());
            return (
              p.leaseId === lease.id &&
              p.type === "rent" &&
              p.status === "paid" &&
              pd >= startOfMonth &&
              pd <= now
            );
          })
          .reduce((sum, p) => sum + Number(p.amount), 0);

        if (monthRentPaid + 0.01 < Number(lease.rentAmount)) {
          alerts.push({
            id: `overdue-${lease.id}-${startOfMonth.toISOString()}`,
            type: "overdue_rent",
            severity: "high",
            title: "Overdue Rent Detected",
            detail: `Lease #${lease.id} has ${Math.max(Number(lease.rentAmount) - monthRentPaid, 0).toFixed(0)} outstanding for this month.`,
            leaseId: lease.id,
            propertyId: lease.propertyId,
            createdAt: now.toISOString(),
          });
        }

        const daysUntilEnd = Math.ceil((new Date(lease.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if ([7, 30, 60].includes(daysUntilEnd)) {
          alerts.push({
            id: `expiry-${lease.id}-${daysUntilEnd}`,
            type: "lease_expiry",
            severity: daysUntilEnd <= 7 ? "high" : "medium",
            title: `Lease Expires in ${daysUntilEnd} Days`,
            detail: `Lease #${lease.id} for property #${lease.propertyId} reaches term end on ${new Date(lease.endDate).toLocaleDateString()}.`,
            leaseId: lease.id,
            propertyId: lease.propertyId,
            createdAt: now.toISOString(),
          });
        }
      }

      for (const request of managerMaintenance) {
        if (request.status === "completed" || request.status === "rejected") continue;
        const ageDays = Math.floor((now.getTime() - new Date(request.createdAt ?? now).getTime()) / (1000 * 60 * 60 * 24));
        if (ageDays >= 7) {
          alerts.push({
            id: `maint-${request.id}`,
            type: "maintenance_stalled",
            severity: ageDays >= 14 ? "high" : "medium",
            title: "Stalled Maintenance Request",
            detail: `Request #${request.id} has been ${request.status} for ${ageDays} days.`,
            propertyId: request.propertyId,
            createdAt: now.toISOString(),
          });
        }
      }

      const vacantCount = managerProperties.filter((p) => p.status === "available").length;
      const vacancyRate = managerProperties.length > 0 ? vacantCount / managerProperties.length : 0;
      if (managerProperties.length >= 4 && vacancyRate >= 0.35) {
        alerts.push({
          id: `vacancy-${now.toISOString().slice(0, 10)}`,
          type: "vacancy_risk",
          severity: "medium",
          title: "Vacancy Risk Increasing",
          detail: `${(vacancyRate * 100).toFixed(0)}% of properties are currently vacant.`,
          createdAt: now.toISOString(),
        });
      }
    }

    const strListings = await storage.getStrMarketListings();
    if (strListings.length > 0) {
      const newestScrapeMs = Math.max(...strListings.map((l) => new Date(l.lastScrapedAt).getTime()));
      const ageHours = (now.getTime() - newestScrapeMs) / (1000 * 60 * 60);
      if (ageHours >= 2) {
        alerts.push({
          id: `str-stale-${new Date(newestScrapeMs).toISOString()}`,
          type: "data_sync",
          severity: ageHours >= 6 ? "high" : "low",
          title: "STR Market Data Is Stale",
          detail: `Last STR sync was ${ageHours.toFixed(1)} hours ago.`,
          createdAt: now.toISOString(),
        });
      }
    }

    const severityRank = { high: 3, medium: 2, low: 1 } as const;
    alerts.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);
    res.json(alerts.slice(0, 25));
  });

  app.get("/api/insights/portfolio-health", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const dbUser = await storage.getUser(userId);
    if (!dbUser) return res.status(401).json({ message: "Unauthorized" });

    const now = new Date();
    const allProperties = dbUser.role === "manager" ? await storage.getPropertiesByManager(userId) : await storage.getProperties();
    const allLeases = dbUser.role === "manager" ? await storage.getLeasesByManager(userId) : await storage.getLeasesByTenant(userId);
    const allPayments = await storage.getPayments();
    const allMaintenance = await storage.getMaintenanceRequests();

    const health = allProperties.map((property) => {
      const propertyLeases = allLeases.filter((l) => l.propertyId === property.id);
      const activeLease = propertyLeases.find((l) => l.status === "active");
      const propertyMaintenance = allMaintenance.filter((m) => m.propertyId === property.id);
      const openMaintenance = propertyMaintenance.filter((m) => m.status !== "completed" && m.status !== "rejected");
      const maintenanceAgeDays = openMaintenance.length
        ? openMaintenance.reduce((sum, m) => sum + (now.getTime() - new Date(m.createdAt ?? now).getTime()) / (1000 * 60 * 60 * 24), 0) / openMaintenance.length
        : 0;
      const occupancyScore = activeLease || property.status === "rented" ? 100 : 45;
      const leasePayments = activeLease ? allPayments.filter((p) => p.leaseId === activeLease.id && p.type === "rent") : [];
      const paidLeasePayments = leasePayments.filter((p) => p.status === "paid").length;
      const onTimeRentScore = leasePayments.length > 0 ? (paidLeasePayments / leasePayments.length) * 100 : 70;
      const maintenanceScore = Math.max(10, 100 - openMaintenance.length * 15 - Math.min(maintenanceAgeDays, 30));
      const noiTrendScore = Math.max(35, Math.min(100, onTimeRentScore * 0.65 + occupancyScore * 0.35));
      const healthScore = Math.round(
        occupancyScore * 0.35 +
          onTimeRentScore * 0.25 +
          maintenanceScore * 0.2 +
          noiTrendScore * 0.2
      );

      return {
        propertyId: property.id,
        address: property.address,
        city: property.city,
        state: property.state,
        score: healthScore,
        occupancyScore: Math.round(occupancyScore),
        onTimeRentScore: Math.round(onTimeRentScore),
        maintenanceScore: Math.round(maintenanceScore),
        noiTrendScore: Math.round(noiTrendScore),
        openMaintenanceCount: openMaintenance.length,
      };
    });

    health.sort((a, b) => b.score - a.score);
    res.json(health);
  });

  app.get("/api/leases/renewal-pipeline", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const dbUser = await storage.getUser(userId);
    if (!dbUser) return res.status(401).json({ message: "Unauthorized" });

    const leases = dbUser.role === "manager" ? await storage.getLeasesByManager(userId) : await storage.getLeasesByTenant(userId);
    const now = new Date();
    const pipeline = leases.map((lease) => {
      const daysUntilEnd = Math.ceil((new Date(lease.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const stage =
        lease.status === "terminated" || lease.status === "expired"
          ? "move-out"
          : daysUntilEnd <= 30
            ? "negotiating"
            : daysUntilEnd <= 60
              ? "outreach"
              : "renewed";
      const nextAction =
        stage === "negotiating"
          ? "Finalize terms and send renewal addendum."
          : stage === "outreach"
            ? "Contact tenant and propose renewal options."
            : stage === "renewed"
              ? "Confirm term extension and update lease dates."
              : "Prepare move-out inspection and turnover checklist.";

      return {
        leaseId: lease.id,
        propertyId: lease.propertyId,
        tenantId: lease.tenantId,
        endDate: lease.endDate,
        daysUntilEnd,
        stage,
        nextAction,
      };
    });

    pipeline.sort((a, b) => a.daysUntilEnd - b.daysUntilEnd);
    res.json(pipeline);
  });

  app.get("/api/reports/monthly-owner", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const dbUser = await storage.getUser(userId);
    if (dbUser?.role !== "manager") return res.status(403).json({ message: "Only managers can export owner reports" });

    const monthParam = String(req.query.month ?? "").trim();
    const [yearRaw, monthRaw] = monthParam ? monthParam.split("-") : [];
    const now = new Date();
    const year = Number(yearRaw) || now.getFullYear();
    const monthIndex = Number(monthRaw) > 0 ? Number(monthRaw) - 1 : now.getMonth();
    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 1);

    const { managerProperties, managerLeases, managerMaintenance, managerPayments } = await getManagerScopedData(userId);
    const activeLeases = managerLeases.filter((l) => l.status === "active");
    const monthPayments = managerPayments.filter((p) => {
      const d = new Date(p.date ?? new Date());
      return d >= monthStart && d < monthEnd;
    });
    const collected = monthPayments.filter((p) => p.status === "paid").reduce((sum, p) => sum + Number(p.amount), 0);
    const outstanding = monthPayments
      .filter((p) => p.status === "pending" || p.status === "overdue")
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const openMaintenance = managerMaintenance.filter((m) => m.status !== "completed" && m.status !== "rejected").length;
    const occupancyRate = managerProperties.length
      ? (managerProperties.filter((p) => p.status === "rented").length / managerProperties.length) * 100
      : 0;
    const expectedMonthlyRent = activeLeases.reduce((sum, lease) => sum + Number(lease.rentAmount), 0);

    const rows = [
      ["month", monthStart.toISOString().slice(0, 7)],
      ["properties_total", String(managerProperties.length)],
      ["active_leases", String(activeLeases.length)],
      ["occupancy_rate_pct", occupancyRate.toFixed(1)],
      ["expected_monthly_rent", expectedMonthlyRent.toFixed(2)],
      ["collected", collected.toFixed(2)],
      ["outstanding", outstanding.toFixed(2)],
      ["open_maintenance", String(openMaintenance)],
    ];
    const propertyRows = managerProperties.map((p) => {
      const lease = activeLeases.find((l) => l.propertyId === p.id);
      return [
        `property_${p.id}`,
        p.address,
        p.status,
        lease ? Number(lease.rentAmount).toFixed(2) : "0.00",
      ];
    });
    const csvLines = [
      "metric,value,extra_1,extra_2",
      ...rows.map((row) => `${row[0]},${row[1]},,`),
      ...propertyRows.map((row) => `${row[0]},"${row[1].replace(/"/g, '""')}",${row[2]},${row[3]}`),
    ];

    res.json({
      month: monthStart.toISOString().slice(0, 7),
      summary: {
        properties: managerProperties.length,
        activeLeases: activeLeases.length,
        occupancyRate,
        expectedMonthlyRent,
        collected,
        outstanding,
        openMaintenance,
      },
      csv: csvLines.join("\n"),
    });
  });

  app.get("/api/rent-guidance/:propertyId", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const propertyId = Number(req.params.propertyId);
    const property = await storage.getProperty(propertyId);
    if (!property) return res.status(404).json({ message: "Property not found" });

    const comps = (await storage.getProperties()).filter(
      (p) => p.id !== property.id && p.city.toLowerCase() === property.city.toLowerCase() && p.state.toLowerCase() === property.state.toLowerCase()
    );

    const compAvgRent = comps.length > 0 ? comps.reduce((sum, p) => sum + Number(p.price), 0) / comps.length : Number(property.price);
    const compSqftAvg = comps.length > 0 ? comps.reduce((sum, p) => sum + p.sqft, 0) / comps.length : property.sqft;
    const compRentPerSqft = compSqftAvg > 0 ? compAvgRent / compSqftAvg : Number(property.price) / Math.max(property.sqft, 1);
    const baseBySqft = compRentPerSqft * Math.max(property.sqft, 1);
    const baseRent = Number(property.price) * 0.45 + compAvgRent * 0.35 + baseBySqft * 0.2;

    const cityProperties = (await storage.getProperties()).filter(
      (p) => p.city.toLowerCase() === property.city.toLowerCase() && p.state.toLowerCase() === property.state.toLowerCase()
    );
    const cityOccupancy = cityProperties.length
      ? cityProperties.filter((p) => p.status === "rented").length / cityProperties.length
      : 0.8;
    const occupancyFactor = cityOccupancy >= 0.9 ? 1.05 : cityOccupancy <= 0.7 ? 0.96 : 1.0;
    const month = new Date().getMonth();
    const seasonalFactor = [4, 5, 6, 7].includes(month) ? 1.03 : [11, 0, 1].includes(month) ? 0.98 : 1.0;
    const recommended = Math.round(baseRent * occupancyFactor * seasonalFactor);
    const minRecommended = Math.round(recommended * 0.95);
    const maxRecommended = Math.round(recommended * 1.05);
    const confidence = comps.length >= 6 ? "high" : comps.length >= 3 ? "medium" : "low";

    res.json({
      propertyId: property.id,
      currentRent: Number(property.price),
      recommendedRent: recommended,
      suggestedRange: { min: minRecommended, max: maxRecommended },
      confidence,
      factors: {
        comparableCount: comps.length,
        cityOccupancyRatePct: Number((cityOccupancy * 100).toFixed(1)),
        seasonalFactor,
      },
      rationale: `Based on ${comps.length} comparable listings in ${property.city}, local occupancy, and seasonal demand.`,
    });
  });

  app.post(api.payments.create.path, isAuthenticated, requireStepUpAuth, async (req: any, res) => {
     try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const dbUser = await storage.getUser(userId);
      const input = api.payments.create.input.parse(req.body);
      if (dbUser?.role !== "manager") {
        const tenantLeases = await storage.getLeasesByTenant(userId);
        const allowedLeaseIds = new Set(tenantLeases.map((l) => l.id));
        if (!allowedLeaseIds.has(input.leaseId)) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }
      const payment = await storage.createPayment(input);
      res.status(201).json(payment);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.message });
      throw err;
    }
  });

  app.get("/api/security/readiness", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const dbUser = await storage.getUser(userId);
    if (dbUser?.role !== "manager") return res.status(403).json({ message: "Forbidden" });

    const checks = [
      {
        name: "production_mode",
        ok: process.env.NODE_ENV === "production",
        value: process.env.NODE_ENV ?? "undefined",
      },
      {
        name: "session_secret_strength",
        ok: Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32),
        value: process.env.SESSION_SECRET ? `len:${process.env.SESSION_SECRET.length}` : "missing",
      },
      {
        name: "database_url_configured",
        ok: Boolean(process.env.DATABASE_URL),
        value: process.env.DATABASE_URL ? "set" : "missing",
      },
      {
        name: "dev_auth_bypass_disabled",
        ok: process.env.DEV_AUTH_BYPASS !== "true",
        value: process.env.DEV_AUTH_BYPASS ?? "unset",
      },
      {
        name: "oidc_or_local_auth_configured",
        ok: Boolean(process.env.CLIENT_ID || process.env.DEV_AUTH_BYPASS === "true"),
        value: process.env.CLIENT_ID ? "oidc" : "local-only",
      },
    ];

    const passed = checks.filter((c) => c.ok).length;
    res.json({
      ready: passed === checks.length,
      passed,
      total: checks.length,
      checks,
      checkedAt: new Date().toISOString(),
    });
  });

  app.post(api.integrations.zillow.leadDelivery.path, async (req, res) => {
    try {
      const expectedSecret = process.env.ZILLOW_LEAD_DELIVERY_WEBHOOK_SECRET;
      if (!expectedSecret) {
        return res.status(500).json({ message: "ZILLOW_LEAD_DELIVERY_WEBHOOK_SECRET is not configured." });
      }

      const providedSecret = String(req.headers["x-zillow-webhook-secret"] || req.headers["x-webhook-secret"] || "");
      if (!providedSecret || providedSecret !== expectedSecret) {
        return res.status(401).json({ message: "Unauthorized webhook request." });
      }

      const payload = api.integrations.zillow.leadDelivery.input.parse(req.body) as Record<string, unknown>;
      const normalized = normalizeZillowLeadPayload(payload);
      if (!normalized.externalLeadId) {
        return res.status(400).json({ message: "Missing external lead ID in Zillow payload." });
      }

      const lead = await storage.upsertZillowLeadByExternalId({
        externalLeadId: normalized.externalLeadId,
        listingExternalId: normalized.listingExternalId,
        propertyExternalId: normalized.propertyExternalId,
        managerId: normalized.managerId,
        managerEmail: normalized.managerEmail,
        applicantName: normalized.applicantName,
        applicantEmail: normalized.applicantEmail,
        applicantPhone: normalized.applicantPhone,
        message: normalized.message,
        moveInDate: normalized.moveInDate,
        status: "received",
        rawPayload: normalized.rawPayload,
      });

      return res.status(202).json({
        success: true,
        leadId: lead.id,
        externalLeadId: lead.externalLeadId,
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.message });
      throw err;
    }
  });

  app.post(api.integrations.zillow.createLead.path, isAuthenticated, async (req: any, res) => {
    try {
      const payload = api.integrations.zillow.createLead.input.parse(req.body);
      const lead = await storage.upsertZillowLeadByExternalId(payload);
      res.status(201).json(lead);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.message });
      throw err;
    }
  });
  
  // === Screenings ===
  app.get(api.screenings.list.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const manager = await storage.getUser(userId);
    if (!manager || manager.role !== "manager") {
      return res.status(403).json({ message: "Only managers can view screening data." });
    }

    const [leads, screenings, tenants, properties] = await Promise.all([
      storage.getZillowLeadsForManager(userId, manager.email || undefined),
      storage.getScreeningsByManager(userId),
      storage.getTenants(),
      storage.getPropertiesByManager(userId),
    ]);

    const tenantItems = tenants.map((tenant) => ({
      id: tenant.id,
      name: [tenant.firstName, tenant.lastName].filter(Boolean).join(" ").trim() || tenant.email || tenant.id,
      email: tenant.email || "",
    }));

    const summary = {
      totalLeads: leads.length,
      pendingLeads: leads.filter((lead) => lead.status === "received").length,
      activeScreenings: screenings.filter((screening) => screening.status === "pending").length,
      approvedScreenings: screenings.filter((screening) => screening.status === "approved").length,
    };

    res.json({
      leads,
      screenings,
      tenants: tenantItems,
      properties: properties.map((property) => ({
        id: property.id,
        address: property.address,
        city: property.city,
        state: property.state,
      })),
      summary,
    });
  });

  app.post(api.screenings.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const manager = await storage.getUser(userId);
      if (!manager || manager.role !== "manager") {
        return res.status(403).json({ message: "Only managers can create screenings." });
      }

      const input = api.screenings.create.input.parse(req.body);
      const screening = await storage.createScreening(input);
      res.status(201).json(screening);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.message });
      throw err;
    }
  });

  return httpServer;
}
