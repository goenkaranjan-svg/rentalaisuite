
import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./integrations/auth";
import { registerChatRoutes } from "./integrations/chat";
import { registerImageRoutes } from "./integrations/image";
import { seedDatabase } from "./seed";
import OpenAI from "openai";
import { scrapePublicStrListings } from "./services/str-market";

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
  app.get(api.properties.list.path, async (req, res) => {
    const input = api.properties.list.input.parse(req.query ?? {});
    const allProperties = await storage.getProperties();

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

  app.post(api.properties.create.path, async (req, res) => {
    try {
      const input = api.properties.create.input.parse(req.body);
      const property = await storage.createProperty(input);
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

  app.post(api.listingExports.templatesCreate.path, isAuthenticated, async (req: any, res) => {
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

  app.delete(api.listingExports.templatesDelete.path, isAuthenticated, async (req: any, res) => {
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

  app.post(api.listingExports.publishZillow.path, isAuthenticated, async (req: any, res) => {
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

  app.post(api.listingExports.publishApartments.path, isAuthenticated, async (req: any, res) => {
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
  app.get(api.strMarket.list.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const dbUser = await storage.getUser(userId);
    if (dbUser?.role !== "investor" && dbUser?.role !== "manager") {
      return res.status(403).json({ message: "Only investors and managers can view STR market data" });
    }

    let listings = await storage.getStrMarketListings();

    // Auto-bootstrap initial market data for first investor session.
    if (listings.length === 0) {
      const scraped = await scrapePublicStrListings();
      if (scraped.length > 0) {
        listings = await storage.replaceStrMarketListings(scraped);
      }
    }

    res.json(listings);
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
      leaseList = await storage.getLeases();
    } else {
      leaseList = await storage.getLeasesByTenant(userId);
    }
    
    console.log(`Lease API Response - Count: ${leaseList.length}`);
    res.json(leaseList);
  });

  app.post(api.leases.create.path, async (req, res) => {
    try {
      const input = api.leases.create.input.parse(req.body);
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

  // === Maintenance ===
  app.get(api.maintenance.list.path, async (req, res) => {
    const requests = await storage.getMaintenanceRequests();
    res.json(requests);
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
      const request = await storage.createMaintenanceRequest(input);
      res.status(201).json(request);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.message });
      throw err;
    }
  });

  app.patch(api.maintenance.update.path, async (req, res) => {
    try {
      const input = api.maintenance.update.input.parse(req.body);
      const request = await storage.updateMaintenanceRequest(Number(req.params.id), input);
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

  app.post(api.payments.create.path, isAuthenticated, async (req: any, res) => {
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
  
  // === Screenings ===
   app.post(api.screenings.create.path, async (req, res) => {
     try {
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
