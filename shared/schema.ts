
import { pgTable, text, serial, integer, boolean, timestamp, jsonb, decimal, varchar, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Export Auth and Chat models
export * from "./models/auth";
export * from "./models/chat";

import { users } from "./models/auth";

// === PROPMAN SPECIFIC TABLES ===

export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  managerId: varchar("manager_id").notNull().references(() => users.id), // Links to users.id
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  bedrooms: integer("bedrooms").notNull(),
  bathrooms: decimal("bathrooms", { precision: 3, scale: 1 }).notNull(),
  sqft: integer("sqft").notNull(),
  description: text("description"),
  status: text("status").notNull().default("available"), // available, rented, maintenance
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const leases = pgTable("leases", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull().references(() => properties.id),
  tenantId: varchar("tenant_id").notNull().references(() => users.id), // Links to users.id
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  rentAmount: decimal("rent_amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("active"), // active, terminated, expired
  documentUrl: text("document_url"), // Link to generated/signed doc
  draftText: text("draft_text"), // AI generated draft
  createdAt: timestamp("created_at").defaultNow(),
});

export const maintenanceRequests = pgTable("maintenance_requests", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull().references(() => properties.id),
  tenantId: varchar("tenant_id").notNull().references(() => users.id), // Links to users.id
  title: text("title").notNull(),
  description: text("description").notNull(),
  priority: text("priority").notNull().default("medium"), // low, medium, high, emergency
  status: text("status").notNull().default("open"), // open, in_progress, completed, rejected
  aiAnalysis: text("ai_analysis"), // AI categorization/suggestion
  createdAt: timestamp("created_at").defaultNow(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  leaseId: integer("lease_id").notNull().references(() => leases.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  date: timestamp("date").defaultNow(),
  status: text("status").notNull().default("pending"), // pending, paid, failed, overdue
  type: text("type").notNull(), // rent, deposit, fee
  stripePaymentId: text("stripe_payment_id"),
});

// Tenant Screening (Mock for now)
export const screenings = pgTable("screenings", {
  id: serial("id").primaryKey(),
  tenantId: varchar("tenant_id").notNull().references(() => users.id), // Links to users.id
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  creditScore: integer("credit_score"),
  backgroundCheck: text("background_check"), // "clear", "flagged"
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const listingMappingTemplates = pgTable("listing_mapping_templates", {
  id: serial("id").primaryKey(),
  managerId: varchar("manager_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  mapping: jsonb("mapping").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const strMarketListings = pgTable(
  "str_market_listings",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull().default("insideairbnb"),
    sourceCountry: text("source_country").notNull().default("united-states"),
    sourceRegion: text("source_region"),
    sourceCity: text("source_city").notNull(),
    sourceSnapshotDate: text("source_snapshot_date"),
    sourceUrl: text("source_url").notNull(),
    externalListingId: text("external_listing_id").notNull(),
    listingUrl: text("listing_url"),
    pictureUrl: text("picture_url"),
    title: text("title"),
    propertyType: text("property_type"),
    roomType: text("room_type"),
    neighbourhood: text("neighbourhood"),
    latitude: decimal("latitude", { precision: 9, scale: 6 }),
    longitude: decimal("longitude", { precision: 9, scale: 6 }),
    accommodates: integer("accommodates"),
    bedrooms: decimal("bedrooms", { precision: 4, scale: 1 }),
    bathrooms: decimal("bathrooms", { precision: 4, scale: 1 }),
    minimumNights: integer("minimum_nights"),
    numberOfReviews: integer("number_of_reviews"),
    reviewScoreRating: decimal("review_score_rating", { precision: 5, scale: 2 }),
    hostIsSuperhost: boolean("host_is_superhost"),
    nightlyRate: decimal("nightly_rate", { precision: 10, scale: 2 }).notNull(),
    availability365: integer("availability_365"),
    expectedOccupancyRate: decimal("expected_occupancy_rate", { precision: 5, scale: 2 }).notNull(),
    expectedMonthlyReturn: decimal("expected_monthly_return", { precision: 12, scale: 2 }).notNull(),
    expectedAnnualReturn: decimal("expected_annual_return", { precision: 12, scale: 2 }).notNull(),
    estimatedSalePrice: decimal("estimated_sale_price", { precision: 12, scale: 2 }).notNull(),
    valuationMethod: text("valuation_method").notNull().default("cap-rate-8pct"),
    currency: text("currency").notNull().default("USD"),
    lastScrapedAt: timestamp("last_scraped_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("str_market_source_city_listing_idx").on(
      table.source,
      table.sourceCity,
      table.externalListingId
    ),
  ]
);

// === RELATIONS ===
export const propertiesRelations = relations(properties, ({ one, many }) => ({
  leases: many(leases),
  maintenanceRequests: many(maintenanceRequests),
}));

export const leasesRelations = relations(leases, ({ one, many }) => ({
  property: one(properties, {
    fields: [leases.propertyId],
    references: [properties.id],
  }),
  payments: many(payments),
}));

export const maintenanceRequestsRelations = relations(maintenanceRequests, ({ one }) => ({
  property: one(properties, {
    fields: [maintenanceRequests.propertyId],
    references: [properties.id],
  }),
}));

// === ZOD SCHEMAS ===
export const insertPropertySchema = createInsertSchema(properties).omit({ id: true, createdAt: true });
export const insertLeaseSchema = createInsertSchema(leases, {
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  rentAmount: z.union([z.string(), z.number()]).transform((v) => v.toString()),
}).omit({ id: true, createdAt: true });
export const insertMaintenanceRequestSchema = createInsertSchema(maintenanceRequests).omit({ id: true, createdAt: true, aiAnalysis: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, date: true });
export const insertScreeningSchema = createInsertSchema(screenings).omit({ id: true, createdAt: true });
export const insertListingMappingTemplateSchema = createInsertSchema(listingMappingTemplates).omit({ id: true, createdAt: true });
export const insertStrMarketListingSchema = createInsertSchema(strMarketListings).omit({ id: true, createdAt: true });

// === TYPES ===
export type Property = typeof properties.$inferSelect;
export type InsertProperty = z.infer<typeof insertPropertySchema>;

export type Lease = typeof leases.$inferSelect;
export type InsertLease = z.infer<typeof insertLeaseSchema>;

export type MaintenanceRequest = typeof maintenanceRequests.$inferSelect;
export type InsertMaintenanceRequest = z.infer<typeof insertMaintenanceRequestSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type Screening = typeof screenings.$inferSelect;
export type InsertScreening = z.infer<typeof insertScreeningSchema>;

export type ListingMappingTemplate = typeof listingMappingTemplates.$inferSelect;
export type InsertListingMappingTemplate = z.infer<typeof insertListingMappingTemplateSchema>;

export type StrMarketListing = typeof strMarketListings.$inferSelect;
export type InsertStrMarketListing = z.infer<typeof insertStrMarketListingSchema>;
