var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path2 from "path";
var vite_config_default;
var init_vite_config = __esm({
  "vite.config.ts"() {
    "use strict";
    vite_config_default = defineConfig({
      plugins: [
        react()
      ],
      resolve: {
        alias: {
          "@": path2.resolve(import.meta.dirname, "client", "src"),
          "@shared": path2.resolve(import.meta.dirname, "shared"),
          "@assets": path2.resolve(import.meta.dirname, "attached_assets")
        }
      },
      root: path2.resolve(import.meta.dirname, "client"),
      build: {
        outDir: path2.resolve(import.meta.dirname, "dist/public"),
        emptyOutDir: true
      },
      server: {
        fs: {
          strict: true,
          deny: ["**/.*"]
        }
      }
    });
  }
});

// server/vite.ts
var vite_exports = {};
__export(vite_exports, {
  setupVite: () => setupVite
});
import { createServer as createViteServer, createLogger } from "vite";
import fs2 from "fs";
import path3 from "path";
import { nanoid } from "nanoid";
async function setupVite(server, app) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("/{*path}", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path3.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
var viteLogger;
var init_vite = __esm({
  "server/vite.ts"() {
    "use strict";
    init_vite_config();
    viteLogger = createLogger();
  }
});

// server/app.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";

// server/db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  conversations: () => conversations,
  insertConversationSchema: () => insertConversationSchema,
  insertLeaseSchema: () => insertLeaseSchema,
  insertLeaseSigningRequestSchema: () => insertLeaseSigningRequestSchema,
  insertListingMappingTemplateSchema: () => insertListingMappingTemplateSchema,
  insertMaintenanceRequestSchema: () => insertMaintenanceRequestSchema,
  insertMessageSchema: () => insertMessageSchema,
  insertMultifamilySaleListingSchema: () => insertMultifamilySaleListingSchema,
  insertPaymentSchema: () => insertPaymentSchema,
  insertPropertySchema: () => insertPropertySchema,
  insertScreeningSchema: () => insertScreeningSchema,
  insertStrMarketListingSchema: () => insertStrMarketListingSchema,
  insertZillowLeadSchema: () => insertZillowLeadSchema,
  leaseExpiryNotificationHistory: () => leaseExpiryNotificationHistory,
  leaseSigningRequests: () => leaseSigningRequests,
  leases: () => leases,
  leasesRelations: () => leasesRelations,
  listingMappingTemplates: () => listingMappingTemplates,
  maintenanceRequests: () => maintenanceRequests,
  maintenanceRequestsRelations: () => maintenanceRequestsRelations,
  managerLeaseExpiryNotificationSettings: () => managerLeaseExpiryNotificationSettings,
  managerMaintenanceAutomationSettings: () => managerMaintenanceAutomationSettings,
  managerRentNotificationSettings: () => managerRentNotificationSettings,
  messages: () => messages,
  multifamilySaleListings: () => multifamilySaleListings,
  payments: () => payments,
  properties: () => properties,
  propertiesRelations: () => propertiesRelations,
  rentOverdueNotificationHistory: () => rentOverdueNotificationHistory,
  screenings: () => screenings,
  sessions: () => sessions,
  strMarketListings: () => strMarketListings,
  upsertManagerLeaseExpiryNotificationSettingsSchema: () => upsertManagerLeaseExpiryNotificationSettingsSchema,
  upsertManagerMaintenanceAutomationSettingsSchema: () => upsertManagerMaintenanceAutomationSettingsSchema,
  upsertManagerRentNotificationSettingsSchema: () => upsertManagerRentNotificationSettingsSchema,
  upsertUserProfileSettingsSchema: () => upsertUserProfileSettingsSchema,
  userProfileSettings: () => userProfileSettings,
  users: () => users,
  zillowLeads: () => zillowLeads
});
import { pgTable as pgTable3, text as text2, serial as serial2, integer as integer3, boolean as boolean2, timestamp as timestamp3, jsonb as jsonb2, decimal, varchar as varchar2, uniqueIndex, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema as createInsertSchema2 } from "drizzle-zod";
import { z } from "zod";

// shared/models/auth.ts
import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
var sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull()
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  role: varchar("role").notNull().default("tenant"),
  // "manager" | "tenant" | "investor"
  authProvider: varchar("auth_provider").notNull().default("oidc"),
  // "oidc" | "local"
  passwordHash: varchar("password_hash"),
  emailVerifiedAt: timestamp("email_verified_at"),
  resetTokenHash: varchar("reset_token_hash"),
  resetTokenExpiresAt: timestamp("reset_token_expires_at"),
  failedLoginCount: integer("failed_login_count").notNull().default(0),
  lockoutUntil: timestamp("lockout_until"),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  mfaSecret: varchar("mfa_secret"),
  mfaBackupCodes: jsonb("mfa_backup_codes").$type().notNull().default([]),
  lastLoginAt: timestamp("last_login_at"),
  securityVersion: integer("security_version").notNull().default(1),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// shared/models/chat.ts
import { pgTable as pgTable2, serial, integer as integer2, text, timestamp as timestamp2 } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql as sql2 } from "drizzle-orm";
var conversations = pgTable2("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp2("created_at").default(sql2`CURRENT_TIMESTAMP`).notNull()
});
var messages = pgTable2("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer2("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp2("created_at").default(sql2`CURRENT_TIMESTAMP`).notNull()
});
var insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true
});
var insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true
});

// shared/schema.ts
var properties = pgTable3("properties", {
  id: serial2("id").primaryKey(),
  managerId: varchar2("manager_id").notNull().references(() => users.id),
  // Links to users.id
  address: text2("address").notNull(),
  city: text2("city").notNull(),
  state: text2("state").notNull(),
  zipCode: text2("zip_code").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  bedrooms: integer3("bedrooms").notNull(),
  bathrooms: decimal("bathrooms", { precision: 3, scale: 1 }).notNull(),
  sqft: integer3("sqft").notNull(),
  description: text2("description"),
  status: text2("status").notNull().default("available"),
  // available, rented, maintenance
  imageUrl: text2("image_url"),
  createdAt: timestamp3("created_at").defaultNow()
});
var leases = pgTable3("leases", {
  id: serial2("id").primaryKey(),
  propertyId: integer3("property_id").notNull().references(() => properties.id),
  tenantId: varchar2("tenant_id").notNull().references(() => users.id),
  // Links to users.id
  startDate: timestamp3("start_date").notNull(),
  endDate: timestamp3("end_date").notNull(),
  rentAmount: decimal("rent_amount", { precision: 10, scale: 2 }).notNull(),
  status: text2("status").notNull().default("active"),
  // active, terminated, expired
  documentUrl: text2("document_url"),
  // Link to generated/signed doc
  draftText: text2("draft_text"),
  // AI generated draft
  createdAt: timestamp3("created_at").defaultNow()
});
var leaseSigningRequests = pgTable3("lease_signing_requests", {
  id: serial2("id").primaryKey(),
  leaseId: integer3("lease_id").notNull().references(() => leases.id),
  managerId: varchar2("manager_id").notNull().references(() => users.id),
  tenantId: varchar2("tenant_id").notNull().references(() => users.id),
  tenantEmail: text2("tenant_email").notNull(),
  tokenHash: text2("token_hash").notNull(),
  status: text2("status").notNull().default("pending"),
  // pending, signed, expired, cancelled
  expiresAt: timestamp3("expires_at").notNull(),
  signedAt: timestamp3("signed_at"),
  signedFullName: text2("signed_full_name"),
  signedFromIp: text2("signed_from_ip"),
  createdAt: timestamp3("created_at").defaultNow()
}, (table) => [
  uniqueIndex("lease_signing_requests_token_hash_idx").on(table.tokenHash)
]);
var maintenanceRequests = pgTable3("maintenance_requests", {
  id: serial2("id").primaryKey(),
  propertyId: integer3("property_id").notNull().references(() => properties.id),
  tenantId: varchar2("tenant_id").notNull().references(() => users.id),
  // Links to users.id
  title: text2("title").notNull(),
  description: text2("description").notNull(),
  category: text2("category").notNull().default("general"),
  // plumbing, electrical, hvac, appliance, pest, security, general
  priority: text2("priority").notNull().default("medium"),
  // low, medium, high, emergency
  status: text2("status").notNull().default("open"),
  // open, in_progress, completed, rejected
  slaDueAt: timestamp3("sla_due_at"),
  escalatedAt: timestamp3("escalated_at"),
  assignedVendor: text2("assigned_vendor"),
  assignmentNote: text2("assignment_note"),
  aiAnalysis: text2("ai_analysis"),
  // AI categorization/suggestion
  createdAt: timestamp3("created_at").defaultNow()
});
var payments = pgTable3("payments", {
  id: serial2("id").primaryKey(),
  leaseId: integer3("lease_id").notNull().references(() => leases.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  date: timestamp3("date").defaultNow(),
  status: text2("status").notNull().default("pending"),
  // pending, paid, failed, overdue
  type: text2("type").notNull(),
  // rent, deposit, fee
  stripePaymentId: text2("stripe_payment_id")
});
var managerRentNotificationSettings = pgTable3("manager_rent_notification_settings", {
  managerId: varchar2("manager_id").notNull().references(() => users.id),
  enabled: boolean2("enabled").notNull().default(true),
  overdueDays: integer3("overdue_days").notNull().default(5),
  updatedAt: timestamp3("updated_at").defaultNow()
}, (table) => [
  primaryKey({ columns: [table.managerId] })
]);
var rentOverdueNotificationHistory = pgTable3(
  "rent_overdue_notification_history",
  {
    id: serial2("id").primaryKey(),
    managerId: varchar2("manager_id").notNull().references(() => users.id),
    leaseId: integer3("lease_id").notNull().references(() => leases.id),
    monthKey: text2("month_key").notNull(),
    // YYYY-MM
    thresholdDays: integer3("threshold_days").notNull(),
    sentAt: timestamp3("sent_at").defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("rent_overdue_notification_dedupe_idx").on(
      table.managerId,
      table.leaseId,
      table.monthKey,
      table.thresholdDays
    )
  ]
);
var managerLeaseExpiryNotificationSettings = pgTable3("manager_lease_expiry_notification_settings", {
  managerId: varchar2("manager_id").notNull().references(() => users.id),
  enabled: boolean2("enabled").notNull().default(true),
  daysBeforeExpiry: integer3("days_before_expiry").notNull().default(30),
  updatedAt: timestamp3("updated_at").defaultNow()
}, (table) => [
  primaryKey({ columns: [table.managerId] })
]);
var managerMaintenanceAutomationSettings = pgTable3("manager_maintenance_automation_settings", {
  managerId: varchar2("manager_id").notNull().references(() => users.id),
  autoTriageEnabled: boolean2("auto_triage_enabled").notNull().default(true),
  autoEscalationEnabled: boolean2("auto_escalation_enabled").notNull().default(true),
  autoVendorAssignmentEnabled: boolean2("auto_vendor_assignment_enabled").notNull().default(true),
  updatedAt: timestamp3("updated_at").defaultNow()
}, (table) => [
  primaryKey({ columns: [table.managerId] })
]);
var userProfileSettings = pgTable3("user_profile_settings", {
  userId: varchar2("user_id").notNull().references(() => users.id),
  phoneNumber: text2("phone_number"),
  twoFactorMethod: text2("two_factor_method"),
  updatedAt: timestamp3("updated_at").defaultNow()
}, (table) => [
  primaryKey({ columns: [table.userId] })
]);
var leaseExpiryNotificationHistory = pgTable3(
  "lease_expiry_notification_history",
  {
    id: serial2("id").primaryKey(),
    managerId: varchar2("manager_id").notNull().references(() => users.id),
    leaseId: integer3("lease_id").notNull().references(() => leases.id),
    leaseEndDateKey: text2("lease_end_date_key").notNull(),
    // YYYY-MM-DD
    thresholdDays: integer3("threshold_days").notNull(),
    sentAt: timestamp3("sent_at").defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("lease_expiry_notification_dedupe_idx").on(
      table.managerId,
      table.leaseId,
      table.leaseEndDateKey,
      table.thresholdDays
    )
  ]
);
var screenings = pgTable3("screenings", {
  id: serial2("id").primaryKey(),
  tenantId: varchar2("tenant_id").notNull().references(() => users.id),
  // Links to users.id
  status: text2("status").notNull().default("pending"),
  // pending, approved, rejected
  creditScore: integer3("credit_score"),
  backgroundCheck: text2("background_check"),
  // "clear", "flagged"
  notes: text2("notes"),
  createdAt: timestamp3("created_at").defaultNow()
});
var zillowLeads = pgTable3(
  "zillow_leads",
  {
    id: serial2("id").primaryKey(),
    externalLeadId: text2("external_lead_id").notNull(),
    listingExternalId: text2("listing_external_id"),
    propertyExternalId: text2("property_external_id"),
    managerId: varchar2("manager_id"),
    managerEmail: text2("manager_email"),
    applicantName: text2("applicant_name"),
    applicantEmail: text2("applicant_email"),
    applicantPhone: text2("applicant_phone"),
    message: text2("message"),
    moveInDate: text2("move_in_date"),
    status: text2("status").notNull().default("received"),
    rawPayload: jsonb2("raw_payload").notNull(),
    receivedAt: timestamp3("received_at").notNull().defaultNow(),
    updatedAt: timestamp3("updated_at").notNull().defaultNow()
  },
  (table) => [uniqueIndex("zillow_leads_external_lead_id_idx").on(table.externalLeadId)]
);
var listingMappingTemplates = pgTable3("listing_mapping_templates", {
  id: serial2("id").primaryKey(),
  managerId: varchar2("manager_id").notNull().references(() => users.id),
  name: text2("name").notNull(),
  mapping: jsonb2("mapping").notNull(),
  createdAt: timestamp3("created_at").defaultNow()
});
var strMarketListings = pgTable3(
  "str_market_listings",
  {
    id: serial2("id").primaryKey(),
    source: text2("source").notNull().default("insideairbnb"),
    sourceCountry: text2("source_country").notNull().default("united-states"),
    sourceRegion: text2("source_region"),
    sourceCity: text2("source_city").notNull(),
    sourceSnapshotDate: text2("source_snapshot_date"),
    sourceUrl: text2("source_url").notNull(),
    externalListingId: text2("external_listing_id").notNull(),
    listingUrl: text2("listing_url"),
    pictureUrl: text2("picture_url"),
    title: text2("title"),
    propertyType: text2("property_type"),
    roomType: text2("room_type"),
    neighbourhood: text2("neighbourhood"),
    latitude: decimal("latitude", { precision: 9, scale: 6 }),
    longitude: decimal("longitude", { precision: 9, scale: 6 }),
    accommodates: integer3("accommodates"),
    bedrooms: decimal("bedrooms", { precision: 4, scale: 1 }),
    bathrooms: decimal("bathrooms", { precision: 4, scale: 1 }),
    minimumNights: integer3("minimum_nights"),
    numberOfReviews: integer3("number_of_reviews"),
    reviewScoreRating: decimal("review_score_rating", { precision: 5, scale: 2 }),
    hostIsSuperhost: boolean2("host_is_superhost"),
    nightlyRate: decimal("nightly_rate", { precision: 10, scale: 2 }).notNull(),
    availability365: integer3("availability_365"),
    expectedOccupancyRate: decimal("expected_occupancy_rate", { precision: 5, scale: 2 }).notNull(),
    expectedMonthlyReturn: decimal("expected_monthly_return", { precision: 12, scale: 2 }).notNull(),
    expectedAnnualReturn: decimal("expected_annual_return", { precision: 12, scale: 2 }).notNull(),
    estimatedSalePrice: decimal("estimated_sale_price", { precision: 12, scale: 2 }).notNull(),
    valuationMethod: text2("valuation_method").notNull().default("cap-rate-8pct"),
    currency: text2("currency").notNull().default("USD"),
    lastScrapedAt: timestamp3("last_scraped_at").defaultNow().notNull(),
    createdAt: timestamp3("created_at").defaultNow()
  },
  (table) => [
    uniqueIndex("str_market_source_city_listing_idx").on(
      table.source,
      table.sourceCity,
      table.externalListingId
    )
  ]
);
var multifamilySaleListings = pgTable3(
  "multifamily_sale_listings",
  {
    id: serial2("id").primaryKey(),
    source: text2("source").notNull().default("rentcast"),
    sourceListingId: text2("source_listing_id").notNull(),
    formattedAddress: text2("formatted_address"),
    addressLine1: text2("address_line_1"),
    addressLine2: text2("address_line_2"),
    city: text2("city").notNull(),
    state: text2("state"),
    stateFips: text2("state_fips"),
    zipCode: text2("zip_code"),
    county: text2("county"),
    countyFips: text2("county_fips"),
    latitude: decimal("latitude", { precision: 9, scale: 6 }),
    longitude: decimal("longitude", { precision: 9, scale: 6 }),
    propertyType: text2("property_type"),
    bedrooms: decimal("bedrooms", { precision: 4, scale: 1 }),
    bathrooms: decimal("bathrooms", { precision: 4, scale: 1 }),
    squareFootage: integer3("square_footage"),
    lotSize: integer3("lot_size"),
    yearBuilt: integer3("year_built"),
    status: text2("status"),
    price: decimal("price", { precision: 12, scale: 2 }).notNull(),
    listingType: text2("listing_type"),
    listedDate: text2("listed_date"),
    removedDate: text2("removed_date"),
    createdDate: text2("created_date"),
    lastSeenDate: text2("last_seen_date"),
    daysOnMarket: integer3("days_on_market"),
    mlsName: text2("mls_name"),
    mlsNumber: text2("mls_number"),
    listingAgent: jsonb2("listing_agent"),
    listingOffice: jsonb2("listing_office"),
    history: jsonb2("history"),
    projectedAnnualReturn: decimal("projected_annual_return", { precision: 12, scale: 2 }),
    currency: text2("currency").notNull().default("USD"),
    listingUrl: text2("listing_url"),
    photoUrl: text2("photo_url"),
    rawPayload: jsonb2("raw_payload").notNull(),
    lastSyncedAt: timestamp3("last_synced_at").defaultNow().notNull(),
    createdAt: timestamp3("created_at").defaultNow()
  },
  (table) => [
    uniqueIndex("multifamily_sale_source_listing_idx").on(table.source, table.sourceListingId)
  ]
);
var propertiesRelations = relations(properties, ({ one, many }) => ({
  leases: many(leases),
  maintenanceRequests: many(maintenanceRequests)
}));
var leasesRelations = relations(leases, ({ one, many }) => ({
  property: one(properties, {
    fields: [leases.propertyId],
    references: [properties.id]
  }),
  payments: many(payments)
}));
var maintenanceRequestsRelations = relations(maintenanceRequests, ({ one }) => ({
  property: one(properties, {
    fields: [maintenanceRequests.propertyId],
    references: [properties.id]
  })
}));
var insertPropertySchema = createInsertSchema2(properties).omit({ id: true, createdAt: true });
var insertLeaseSchema = createInsertSchema2(leases, {
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  rentAmount: z.union([z.string(), z.number()]).transform((v) => v.toString())
}).omit({ id: true, createdAt: true });
var insertMaintenanceRequestSchema = createInsertSchema2(maintenanceRequests).omit({
  id: true,
  createdAt: true,
  aiAnalysis: true,
  category: true,
  slaDueAt: true,
  escalatedAt: true,
  assignedVendor: true,
  assignmentNote: true
});
var insertPaymentSchema = createInsertSchema2(payments).omit({ id: true, date: true });
var insertScreeningSchema = createInsertSchema2(screenings).omit({ id: true, createdAt: true });
var insertZillowLeadSchema = createInsertSchema2(zillowLeads).omit({
  id: true,
  receivedAt: true,
  updatedAt: true
});
var insertListingMappingTemplateSchema = createInsertSchema2(listingMappingTemplates).omit({ id: true, createdAt: true });
var insertStrMarketListingSchema = createInsertSchema2(strMarketListings).omit({ id: true, createdAt: true });
var insertMultifamilySaleListingSchema = createInsertSchema2(multifamilySaleListings).omit({
  id: true,
  createdAt: true
});
var upsertManagerRentNotificationSettingsSchema = createInsertSchema2(managerRentNotificationSettings, {
  overdueDays: z.coerce.number().int().min(1).max(60)
}).omit({ updatedAt: true });
var upsertManagerLeaseExpiryNotificationSettingsSchema = createInsertSchema2(managerLeaseExpiryNotificationSettings, {
  daysBeforeExpiry: z.coerce.number().int().min(1).max(365)
}).omit({ updatedAt: true });
var upsertManagerMaintenanceAutomationSettingsSchema = createInsertSchema2(managerMaintenanceAutomationSettings).omit({ updatedAt: true });
var upsertUserProfileSettingsSchema = createInsertSchema2(userProfileSettings, {
  phoneNumber: z.string().trim().min(7).max(25).regex(/^[0-9+()\-\s]+$/, "Phone number contains invalid characters").nullable().optional(),
  twoFactorMethod: z.enum(["email", "phone"]).nullable().optional()
}).omit({ updatedAt: true });
var insertLeaseSigningRequestSchema = createInsertSchema2(leaseSigningRequests).omit({
  id: true,
  createdAt: true,
  signedAt: true,
  signedFullName: true,
  signedFromIp: true
});

// server/db.ts
var { Pool } = pg;
var databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.warn(
    "DATABASE_URL is not set. Using default local Postgres URL postgres://localhost:5432/postgres. Start a local Postgres instance or set DATABASE_URL to avoid connection errors when hitting the API."
  );
}
var pool = new Pool({
  connectionString: databaseUrl ?? "postgres://localhost:5432/postgres"
});
var db = drizzle(pool, { schema: schema_exports });

// server/storage.ts
import { and, eq, desc, ilike, inArray, or } from "drizzle-orm";
var DatabaseStorage = class {
  // Users
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getTenants() {
    return await db.select().from(users).where(eq(users.role, "tenant"));
  }
  // Properties
  async getProperties() {
    return await db.select().from(properties).orderBy(desc(properties.createdAt));
  }
  async getProperty(id) {
    const [property] = await db.select().from(properties).where(eq(properties.id, id));
    return property;
  }
  async getPropertiesByManager(managerId) {
    return await db.select().from(properties).where(eq(properties.managerId, managerId)).orderBy(desc(properties.createdAt));
  }
  async createProperty(insertProperty) {
    const [property] = await db.insert(properties).values(insertProperty).returning();
    return property;
  }
  async updateProperty(id, update) {
    const [property] = await db.update(properties).set(update).where(eq(properties.id, id)).returning();
    return property;
  }
  async deleteProperty(id) {
    await db.delete(properties).where(eq(properties.id, id));
  }
  // Leases
  async getLeases() {
    return await db.select().from(leases).orderBy(desc(leases.createdAt));
  }
  async getLeasesByManager(managerId) {
    const results = await db.select({
      id: leases.id,
      propertyId: leases.propertyId,
      tenantId: leases.tenantId,
      startDate: leases.startDate,
      endDate: leases.endDate,
      rentAmount: leases.rentAmount,
      status: leases.status,
      documentUrl: leases.documentUrl,
      draftText: leases.draftText,
      createdAt: leases.createdAt
    }).from(leases).innerJoin(properties, eq(leases.propertyId, properties.id)).where(eq(properties.managerId, managerId)).orderBy(desc(leases.createdAt));
    return results;
  }
  async getLeasesByTenant(tenantId) {
    return await db.select().from(leases).where(eq(leases.tenantId, tenantId)).orderBy(desc(leases.createdAt));
  }
  async createLease(insertLease) {
    const [lease] = await db.insert(leases).values(insertLease).returning();
    return lease;
  }
  async updateLease(id, update) {
    const [lease] = await db.update(leases).set(update).where(eq(leases.id, id)).returning();
    return lease;
  }
  async getLease(id) {
    const [lease] = await db.select().from(leases).where(eq(leases.id, id));
    return lease;
  }
  // Maintenance
  async getMaintenanceRequests() {
    return await db.select().from(maintenanceRequests).orderBy(desc(maintenanceRequests.createdAt));
  }
  async getMaintenanceRequestsByTenant(tenantId) {
    return await db.select().from(maintenanceRequests).where(eq(maintenanceRequests.tenantId, tenantId)).orderBy(desc(maintenanceRequests.createdAt));
  }
  async getMaintenanceRequestsByProperty(propertyId) {
    return await db.select().from(maintenanceRequests).where(eq(maintenanceRequests.propertyId, propertyId)).orderBy(desc(maintenanceRequests.createdAt));
  }
  async createMaintenanceRequest(insertRequest) {
    const [request] = await db.insert(maintenanceRequests).values(insertRequest).returning();
    return request;
  }
  async getMaintenanceRequest(id) {
    const [request] = await db.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, id));
    return request;
  }
  async updateMaintenanceRequest(id, update) {
    const [request] = await db.update(maintenanceRequests).set(update).where(eq(maintenanceRequests.id, id)).returning();
    return request;
  }
  async getManagerMaintenanceAutomationSettings(managerId) {
    const [settings] = await db.select().from(managerMaintenanceAutomationSettings).where(eq(managerMaintenanceAutomationSettings.managerId, managerId));
    return settings;
  }
  async upsertManagerMaintenanceAutomationSettings(settings) {
    const [upserted] = await db.insert(managerMaintenanceAutomationSettings).values(settings).onConflictDoUpdate({
      target: managerMaintenanceAutomationSettings.managerId,
      set: {
        autoTriageEnabled: settings.autoTriageEnabled,
        autoEscalationEnabled: settings.autoEscalationEnabled,
        autoVendorAssignmentEnabled: settings.autoVendorAssignmentEnabled,
        updatedAt: /* @__PURE__ */ new Date()
      }
    }).returning();
    return upserted;
  }
  // Payments
  async getPayments() {
    return await db.select().from(payments).orderBy(desc(payments.date));
  }
  async getPaymentsByLease(leaseId) {
    return await db.select().from(payments).where(eq(payments.leaseId, leaseId)).orderBy(desc(payments.date));
  }
  async createPayment(insertPayment) {
    const [payment] = await db.insert(payments).values(insertPayment).returning();
    return payment;
  }
  async getManagerRentNotificationSettings(managerId) {
    const [settings] = await db.select().from(managerRentNotificationSettings).where(eq(managerRentNotificationSettings.managerId, managerId));
    return settings;
  }
  async upsertManagerRentNotificationSettings(settings) {
    const [upserted] = await db.insert(managerRentNotificationSettings).values(settings).onConflictDoUpdate({
      target: managerRentNotificationSettings.managerId,
      set: {
        enabled: settings.enabled,
        overdueDays: settings.overdueDays,
        updatedAt: /* @__PURE__ */ new Date()
      }
    }).returning();
    return upserted;
  }
  async hasSentRentOverdueNotification(managerId, leaseId, monthKey, thresholdDays) {
    const [entry] = await db.select({ id: rentOverdueNotificationHistory.id }).from(rentOverdueNotificationHistory).where(and(
      eq(rentOverdueNotificationHistory.managerId, managerId),
      eq(rentOverdueNotificationHistory.leaseId, leaseId),
      eq(rentOverdueNotificationHistory.monthKey, monthKey),
      eq(rentOverdueNotificationHistory.thresholdDays, thresholdDays)
    )).limit(1);
    return Boolean(entry);
  }
  async markRentOverdueNotificationSent(managerId, leaseId, monthKey, thresholdDays) {
    await db.insert(rentOverdueNotificationHistory).values({
      managerId,
      leaseId,
      monthKey,
      thresholdDays,
      sentAt: /* @__PURE__ */ new Date()
    }).onConflictDoNothing({
      target: [
        rentOverdueNotificationHistory.managerId,
        rentOverdueNotificationHistory.leaseId,
        rentOverdueNotificationHistory.monthKey,
        rentOverdueNotificationHistory.thresholdDays
      ]
    });
  }
  async getManagerLeaseExpiryNotificationSettings(managerId) {
    const [settings] = await db.select().from(managerLeaseExpiryNotificationSettings).where(eq(managerLeaseExpiryNotificationSettings.managerId, managerId));
    return settings;
  }
  async upsertManagerLeaseExpiryNotificationSettings(settings) {
    const [upserted] = await db.insert(managerLeaseExpiryNotificationSettings).values(settings).onConflictDoUpdate({
      target: managerLeaseExpiryNotificationSettings.managerId,
      set: {
        enabled: settings.enabled,
        daysBeforeExpiry: settings.daysBeforeExpiry,
        updatedAt: /* @__PURE__ */ new Date()
      }
    }).returning();
    return upserted;
  }
  async hasSentLeaseExpiryNotification(managerId, leaseId, leaseEndDateKey, thresholdDays) {
    const [entry] = await db.select({ id: leaseExpiryNotificationHistory.id }).from(leaseExpiryNotificationHistory).where(and(
      eq(leaseExpiryNotificationHistory.managerId, managerId),
      eq(leaseExpiryNotificationHistory.leaseId, leaseId),
      eq(leaseExpiryNotificationHistory.leaseEndDateKey, leaseEndDateKey),
      eq(leaseExpiryNotificationHistory.thresholdDays, thresholdDays)
    )).limit(1);
    return Boolean(entry);
  }
  async markLeaseExpiryNotificationSent(managerId, leaseId, leaseEndDateKey, thresholdDays) {
    await db.insert(leaseExpiryNotificationHistory).values({
      managerId,
      leaseId,
      leaseEndDateKey,
      thresholdDays,
      sentAt: /* @__PURE__ */ new Date()
    }).onConflictDoNothing({
      target: [
        leaseExpiryNotificationHistory.managerId,
        leaseExpiryNotificationHistory.leaseId,
        leaseExpiryNotificationHistory.leaseEndDateKey,
        leaseExpiryNotificationHistory.thresholdDays
      ]
    });
  }
  async createLeaseSigningRequest(input) {
    const [record] = await db.insert(leaseSigningRequests).values(input).returning();
    return record;
  }
  async getLeaseSigningRequestByTokenHash(tokenHash) {
    const [record] = await db.select().from(leaseSigningRequests).where(eq(leaseSigningRequests.tokenHash, tokenHash));
    return record;
  }
  async getLatestLeaseSigningRequestByLease(leaseId) {
    const [record] = await db.select().from(leaseSigningRequests).where(eq(leaseSigningRequests.leaseId, leaseId)).orderBy(desc(leaseSigningRequests.createdAt)).limit(1);
    return record;
  }
  async markLeaseSigningCompleted(input) {
    const [record] = await db.update(leaseSigningRequests).set({
      status: "signed",
      signedAt: /* @__PURE__ */ new Date(),
      signedFullName: input.signedFullName,
      signedFromIp: input.signedFromIp ?? null
    }).where(eq(leaseSigningRequests.id, input.signingRequestId)).returning();
    return record;
  }
  // Screenings
  async createScreening(insertScreening) {
    const [screening] = await db.insert(screenings).values(insertScreening).returning();
    return screening;
  }
  async getScreeningsByTenant(tenantId) {
    return await db.select().from(screenings).where(eq(screenings.tenantId, tenantId)).orderBy(desc(screenings.createdAt));
  }
  async getScreeningsByManager(managerId) {
    const managerLeases = await this.getLeasesByManager(managerId);
    const tenantIds = Array.from(new Set(managerLeases.map((lease) => lease.tenantId))).filter(Boolean);
    if (tenantIds.length === 0) return [];
    return await db.select().from(screenings).where(inArray(screenings.tenantId, tenantIds)).orderBy(desc(screenings.createdAt));
  }
  async upsertZillowLeadByExternalId(lead) {
    const [record] = await db.insert(zillowLeads).values(lead).onConflictDoUpdate({
      target: zillowLeads.externalLeadId,
      set: {
        listingExternalId: lead.listingExternalId ?? null,
        propertyExternalId: lead.propertyExternalId ?? null,
        managerId: lead.managerId ?? null,
        managerEmail: lead.managerEmail ?? null,
        applicantName: lead.applicantName ?? null,
        applicantEmail: lead.applicantEmail ?? null,
        applicantPhone: lead.applicantPhone ?? null,
        message: lead.message ?? null,
        moveInDate: lead.moveInDate ?? null,
        status: lead.status ?? "received",
        rawPayload: lead.rawPayload,
        updatedAt: /* @__PURE__ */ new Date()
      }
    }).returning();
    return record;
  }
  async getZillowLeadByExternalId(externalLeadId) {
    const [record] = await db.select().from(zillowLeads).where(eq(zillowLeads.externalLeadId, externalLeadId));
    return record;
  }
  async getZillowLeadsForManager(managerId, managerEmail) {
    const managerProperties = await this.getPropertiesByManager(managerId);
    const managerPropertyIds = managerProperties.map((property) => String(property.id));
    const normalizedManagerEmail = managerEmail?.trim();
    const whereClauses = [eq(zillowLeads.managerId, managerId)];
    if (normalizedManagerEmail) {
      whereClauses.push(ilike(zillowLeads.managerEmail, normalizedManagerEmail));
    }
    if (managerPropertyIds.length > 0) {
      whereClauses.push(inArray(zillowLeads.propertyExternalId, managerPropertyIds));
    }
    const scopedLeads = await db.select().from(zillowLeads).where(or(...whereClauses)).orderBy(desc(zillowLeads.receivedAt));
    if (scopedLeads.length === 0 && process.env.NODE_ENV !== "production") {
      return await db.select().from(zillowLeads).orderBy(desc(zillowLeads.receivedAt));
    }
    return scopedLeads;
  }
  // Listing Mapping Templates
  async getListingMappingTemplatesByManager(managerId) {
    return await db.select().from(listingMappingTemplates).where(eq(listingMappingTemplates.managerId, managerId)).orderBy(desc(listingMappingTemplates.createdAt));
  }
  async getListingMappingTemplate(id) {
    const [template] = await db.select().from(listingMappingTemplates).where(eq(listingMappingTemplates.id, id));
    return template;
  }
  async createListingMappingTemplate(insertTemplate) {
    const [template] = await db.insert(listingMappingTemplates).values(insertTemplate).returning();
    return template;
  }
  async deleteListingMappingTemplate(id) {
    await db.delete(listingMappingTemplates).where(eq(listingMappingTemplates.id, id));
  }
  // STR Market Listings
  async getStrMarketListing(id) {
    const [listing] = await db.select().from(strMarketListings).where(eq(strMarketListings.id, id));
    return listing;
  }
  async getStrMarketListings() {
    return await db.select().from(strMarketListings).orderBy(desc(strMarketListings.expectedAnnualReturn));
  }
  async replaceStrMarketListings(listings) {
    if (listings.length === 0) return [];
    return await db.transaction(async (tx) => {
      await tx.delete(strMarketListings);
      return await tx.insert(strMarketListings).values(listings).returning();
    });
  }
  // Multifamily For-Sale Listings
  async getMultifamilySaleListings() {
    return await db.select().from(multifamilySaleListings).orderBy(desc(multifamilySaleListings.price));
  }
  async replaceMultifamilySaleListings(listings) {
    return await db.transaction(async (tx) => {
      await tx.delete(multifamilySaleListings);
      if (listings.length === 0) return [];
      return await tx.insert(multifamilySaleListings).values(listings).returning();
    });
  }
};
var storage = new DatabaseStorage();

// shared/routes.ts
import { z as z2 } from "zod";
var errorSchemas = {
  validation: z2.object({
    message: z2.string(),
    field: z2.string().optional()
  }),
  notFound: z2.object({
    message: z2.string()
  }),
  internal: z2.object({
    message: z2.string()
  })
};
var listingFieldMappingSchema = z2.object({
  common: z2.object({
    title: z2.string().optional(),
    availableDate: z2.string().optional(),
    leaseTermMonths: z2.number().int().positive().optional(),
    contactName: z2.string().optional(),
    contactEmail: z2.string().optional(),
    contactPhone: z2.string().optional(),
    amenities: z2.array(z2.string()).optional(),
    petsAllowed: z2.boolean().optional(),
    furnished: z2.boolean().optional(),
    parkingIncluded: z2.boolean().optional(),
    laundry: z2.string().optional()
  }).optional(),
  zillow: z2.object({
    propertyType: z2.string().optional(),
    applicationUrl: z2.string().optional(),
    virtualTourUrl: z2.string().optional()
  }).optional(),
  apartments: z2.object({
    communityName: z2.string().optional(),
    unitNumber: z2.string().optional(),
    depositAmount: z2.number().nonnegative().optional(),
    utilitiesIncluded: z2.array(z2.string()).optional()
  }).optional()
});
var zillowLeadDeliveryPayloadSchema = z2.object({
  leadId: z2.string().optional(),
  externalLeadId: z2.string().optional(),
  listingId: z2.union([z2.string(), z2.number()]).optional(),
  listingExternalId: z2.string().optional(),
  propertyId: z2.union([z2.string(), z2.number()]).optional(),
  propertyExternalId: z2.string().optional(),
  managerId: z2.string().optional(),
  managerEmail: z2.string().optional(),
  firstName: z2.string().optional(),
  lastName: z2.string().optional(),
  fullName: z2.string().optional(),
  name: z2.string().optional(),
  email: z2.string().optional(),
  phone: z2.string().optional(),
  message: z2.string().optional(),
  moveInDate: z2.string().optional(),
  applicant: z2.record(z2.unknown()).optional(),
  renter: z2.record(z2.unknown()).optional()
}).passthrough();
var api = {
  properties: {
    list: {
      method: "GET",
      path: "/api/properties",
      input: z2.object({
        status: z2.enum(["available", "rented", "maintenance"]).optional(),
        search: z2.string().optional()
      }).optional(),
      responses: {
        200: z2.array(z2.custom())
      }
    },
    get: {
      method: "GET",
      path: "/api/properties/:id",
      responses: {
        200: z2.custom(),
        404: errorSchemas.notFound
      }
    },
    create: {
      method: "POST",
      path: "/api/properties",
      input: insertPropertySchema,
      responses: {
        201: z2.custom(),
        400: errorSchemas.validation
      }
    },
    update: {
      method: "PUT",
      path: "/api/properties/:id",
      input: insertPropertySchema.partial(),
      responses: {
        200: z2.custom(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound
      }
    },
    delete: {
      method: "DELETE",
      path: "/api/properties/:id",
      responses: {
        204: z2.void(),
        404: errorSchemas.notFound
      }
    }
  },
  listingExports: {
    availableProperties: {
      method: "GET",
      path: "/api/listings/available",
      input: z2.object({
        search: z2.string().optional()
      }).optional(),
      responses: {
        200: z2.array(z2.custom())
      }
    },
    zillow: {
      method: "POST",
      path: "/api/listings/export/zillow",
      input: z2.object({
        propertyId: z2.number(),
        mapping: listingFieldMappingSchema.optional()
      }),
      responses: {
        200: z2.object({
          propertyId: z2.number(),
          platform: z2.literal("zillow"),
          payload: z2.string(),
          missingFields: z2.array(z2.string())
        })
      }
    },
    apartments: {
      method: "POST",
      path: "/api/listings/export/apartments",
      input: z2.object({
        propertyId: z2.number(),
        mapping: listingFieldMappingSchema.optional()
      }),
      responses: {
        200: z2.object({
          propertyId: z2.number(),
          platform: z2.literal("apartments.com"),
          payload: z2.string(),
          csv: z2.string(),
          missingFields: z2.array(z2.string())
        })
      }
    },
    publishZillow: {
      method: "POST",
      path: "/api/listings/publish/zillow",
      input: z2.object({
        propertyId: z2.number(),
        mapping: listingFieldMappingSchema.optional()
      }),
      responses: {
        200: z2.object({
          platform: z2.literal("zillow"),
          propertyId: z2.number(),
          success: z2.boolean(),
          statusCode: z2.number(),
          target: z2.string(),
          responseBody: z2.string(),
          publishedAt: z2.string()
        })
      }
    },
    publishApartments: {
      method: "POST",
      path: "/api/listings/publish/apartments",
      input: z2.object({
        propertyId: z2.number(),
        format: z2.enum(["json", "csv"]).optional(),
        mapping: listingFieldMappingSchema.optional()
      }),
      responses: {
        200: z2.object({
          platform: z2.literal("apartments.com"),
          propertyId: z2.number(),
          success: z2.boolean(),
          statusCode: z2.number(),
          target: z2.string(),
          responseBody: z2.string(),
          publishedAt: z2.string(),
          format: z2.enum(["json", "csv"])
        })
      }
    },
    templatesList: {
      method: "GET",
      path: "/api/listings/templates",
      responses: {
        200: z2.array(
          z2.object({
            id: z2.number(),
            managerId: z2.string(),
            name: z2.string(),
            mapping: listingFieldMappingSchema,
            createdAt: z2.string().nullable()
          })
        )
      }
    },
    templatesCreate: {
      method: "POST",
      path: "/api/listings/templates",
      input: z2.object({
        name: z2.string().min(1).max(120),
        mapping: listingFieldMappingSchema
      }),
      responses: {
        201: z2.object({
          id: z2.number(),
          managerId: z2.string(),
          name: z2.string(),
          mapping: listingFieldMappingSchema,
          createdAt: z2.string().nullable()
        })
      }
    },
    templatesDelete: {
      method: "DELETE",
      path: "/api/listings/templates/:id",
      responses: {
        204: z2.void()
      }
    }
  },
  strMarket: {
    get: {
      method: "GET",
      path: "/api/str-market/listings/:id",
      responses: {
        200: z2.custom(),
        404: errorSchemas.notFound
      }
    },
    list: {
      method: "GET",
      path: "/api/str-market/listings",
      input: z2.object({
        search: z2.string().optional(),
        city: z2.string().optional(),
        region: z2.string().optional(),
        roomType: z2.string().optional(),
        minAnnualReturn: z2.coerce.number().nonnegative().optional(),
        maxNightlyRate: z2.coerce.number().positive().optional(),
        minOccupancyRate: z2.coerce.number().min(0).max(100).optional(),
        limit: z2.coerce.number().int().positive().max(5e3).optional()
      }).optional(),
      responses: {
        200: z2.array(z2.custom())
      }
    },
    sync: {
      method: "POST",
      path: "/api/str-market/sync",
      responses: {
        200: z2.object({
          scrapedCount: z2.number(),
          storedCount: z2.number(),
          source: z2.string(),
          syncedAt: z2.string()
        })
      }
    }
  },
  multifamilySale: {
    list: {
      method: "GET",
      path: "/api/investor/multifamily/listings",
      input: z2.object({
        search: z2.string().optional(),
        city: z2.string().optional(),
        region: z2.string().optional(),
        minPrice: z2.coerce.number().nonnegative().optional(),
        maxPrice: z2.coerce.number().positive().optional(),
        limit: z2.coerce.number().int().positive().max(500).optional()
      }).optional(),
      responses: {
        200: z2.array(z2.custom())
      }
    },
    sync: {
      method: "POST",
      path: "/api/investor/multifamily/sync",
      responses: {
        200: z2.object({
          fetchedCount: z2.number(),
          storedCount: z2.number(),
          source: z2.string(),
          syncedAt: z2.string()
        })
      }
    }
  },
  leases: {
    list: {
      method: "GET",
      path: "/api/leases",
      responses: {
        200: z2.array(z2.custom())
      }
    },
    create: {
      method: "POST",
      path: "/api/leases",
      input: insertLeaseSchema,
      responses: {
        201: z2.custom(),
        400: errorSchemas.validation
      }
    },
    generateDoc: {
      method: "POST",
      path: "/api/leases/:id/generate",
      // AI generation endpoint
      responses: {
        200: z2.object({ documentText: z2.string() }),
        404: errorSchemas.notFound
      }
    },
    sendForSigning: {
      method: "POST",
      path: "/api/leases/:id/signing/request",
      responses: {
        200: z2.object({
          leaseId: z2.number(),
          status: z2.string(),
          expiresAt: z2.string(),
          sentTo: z2.string(),
          signingLink: z2.string().optional()
        })
      }
    },
    signingStatus: {
      method: "GET",
      path: "/api/leases/:id/signing-status",
      responses: {
        200: z2.object({
          leaseId: z2.number(),
          status: z2.string(),
          createdAt: z2.string().nullable(),
          expiresAt: z2.string().nullable(),
          signedAt: z2.string().nullable(),
          signedFullName: z2.string().nullable(),
          tenantEmail: z2.string().nullable()
        })
      }
    },
    signingValidate: {
      method: "GET",
      path: "/api/leases/signing/validate",
      input: z2.object({ token: z2.string().min(20) }),
      responses: {
        200: z2.object({
          valid: z2.boolean(),
          leaseId: z2.number().optional(),
          status: z2.string().optional(),
          expiresAt: z2.string().optional(),
          propertyAddress: z2.string().optional(),
          rentAmount: z2.number().optional(),
          tenantEmail: z2.string().optional()
        })
      }
    },
    signingComplete: {
      method: "POST",
      path: "/api/leases/signing/complete",
      input: z2.object({
        token: z2.string().min(20),
        fullName: z2.string().min(2).max(120)
      }),
      responses: {
        200: z2.object({
          message: z2.string(),
          leaseId: z2.number(),
          signedAt: z2.string(),
          signedFullName: z2.string()
        })
      }
    },
    expiryNotificationSettings: {
      method: "GET",
      path: "/api/leases/expiry-notification-settings",
      responses: {
        200: z2.object({
          managerId: z2.string(),
          enabled: z2.boolean(),
          daysBeforeExpiry: z2.number().int().min(1).max(365),
          updatedAt: z2.string().nullable()
        })
      }
    },
    updateExpiryNotificationSettings: {
      method: "PUT",
      path: "/api/leases/expiry-notification-settings",
      input: upsertManagerLeaseExpiryNotificationSettingsSchema.pick({
        enabled: true,
        daysBeforeExpiry: true
      }),
      responses: {
        200: z2.object({
          managerId: z2.string(),
          enabled: z2.boolean(),
          daysBeforeExpiry: z2.number().int().min(1).max(365),
          updatedAt: z2.string().nullable()
        })
      }
    }
  },
  maintenance: {
    list: {
      method: "GET",
      path: "/api/maintenance",
      input: z2.object({
        status: z2.string().optional()
      }).optional(),
      responses: {
        200: z2.array(z2.custom())
      }
    },
    create: {
      method: "POST",
      path: "/api/maintenance",
      input: insertMaintenanceRequestSchema,
      responses: {
        201: z2.custom(),
        400: errorSchemas.validation
      }
    },
    analyze: {
      method: "POST",
      path: "/api/maintenance/:id/analyze",
      // AI analysis
      responses: {
        200: z2.object({ analysis: z2.string() }),
        404: errorSchemas.notFound
      }
    },
    update: {
      method: "PATCH",
      path: "/api/maintenance/:id",
      input: insertMaintenanceRequestSchema.partial(),
      responses: {
        200: z2.custom(),
        404: errorSchemas.notFound
      }
    },
    automationSettings: {
      method: "GET",
      path: "/api/maintenance/automation-settings",
      responses: {
        200: z2.object({
          managerId: z2.string(),
          autoTriageEnabled: z2.boolean(),
          autoEscalationEnabled: z2.boolean(),
          autoVendorAssignmentEnabled: z2.boolean(),
          updatedAt: z2.string().nullable()
        })
      }
    },
    updateAutomationSettings: {
      method: "PUT",
      path: "/api/maintenance/automation-settings",
      input: upsertManagerMaintenanceAutomationSettingsSchema.pick({
        autoTriageEnabled: true,
        autoEscalationEnabled: true,
        autoVendorAssignmentEnabled: true
      }),
      responses: {
        200: z2.object({
          managerId: z2.string(),
          autoTriageEnabled: z2.boolean(),
          autoEscalationEnabled: z2.boolean(),
          autoVendorAssignmentEnabled: z2.boolean(),
          updatedAt: z2.string().nullable()
        })
      }
    }
  },
  payments: {
    list: {
      method: "GET",
      path: "/api/payments",
      responses: {
        200: z2.array(z2.custom())
      }
    },
    create: {
      method: "POST",
      path: "/api/payments",
      input: insertPaymentSchema,
      responses: {
        201: z2.custom(),
        400: errorSchemas.validation
      }
    }
  },
  accounting: {
    summary: {
      method: "GET",
      path: "/api/accounting/summary",
      responses: {
        200: z2.object({
          totalCollected: z2.number(),
          pending: z2.number(),
          overdue: z2.number(),
          outstanding: z2.number(),
          paymentCount: z2.number(),
          chart: z2.array(
            z2.object({
              label: z2.string(),
              collected: z2.number(),
              outstanding: z2.number()
            })
          )
        })
      }
    },
    rentOverdueNotificationSettings: {
      method: "GET",
      path: "/api/accounting/rent-overdue-notification-settings",
      responses: {
        200: z2.object({
          managerId: z2.string(),
          enabled: z2.boolean(),
          overdueDays: z2.number().int().min(1).max(60),
          updatedAt: z2.string().nullable()
        })
      }
    },
    updateRentOverdueNotificationSettings: {
      method: "PUT",
      path: "/api/accounting/rent-overdue-notification-settings",
      input: upsertManagerRentNotificationSettingsSchema.pick({
        enabled: true,
        overdueDays: true
      }),
      responses: {
        200: z2.object({
          managerId: z2.string(),
          enabled: z2.boolean(),
          overdueDays: z2.number().int().min(1).max(60),
          updatedAt: z2.string().nullable()
        })
      }
    }
  },
  screenings: {
    list: {
      method: "GET",
      path: "/api/screenings",
      responses: {
        200: z2.object({
          leads: z2.array(z2.custom()),
          screenings: z2.array(z2.custom()),
          tenants: z2.array(z2.object({
            id: z2.string(),
            name: z2.string(),
            email: z2.string()
          })),
          properties: z2.array(z2.object({
            id: z2.number().int().positive(),
            address: z2.string(),
            city: z2.string(),
            state: z2.string()
          })),
          summary: z2.object({
            totalLeads: z2.number().int().nonnegative(),
            pendingLeads: z2.number().int().nonnegative(),
            activeScreenings: z2.number().int().nonnegative(),
            approvedScreenings: z2.number().int().nonnegative()
          })
        })
      }
    },
    create: {
      method: "POST",
      path: "/api/screenings",
      input: insertScreeningSchema,
      responses: {
        201: z2.custom(),
        400: errorSchemas.validation
      }
    }
  },
  integrations: {
    zillow: {
      leadDelivery: {
        method: "POST",
        path: "/api/integrations/zillow/lead-delivery",
        input: zillowLeadDeliveryPayloadSchema,
        responses: {
          202: z2.object({
            success: z2.literal(true),
            leadId: z2.number().int().positive(),
            externalLeadId: z2.string()
          }),
          400: errorSchemas.validation,
          401: errorSchemas.validation
        }
      },
      createLead: {
        method: "POST",
        path: "/api/integrations/zillow/leads",
        input: insertZillowLeadSchema,
        responses: {
          201: z2.custom(),
          400: errorSchemas.validation
        }
      }
    }
  }
};

// server/routes.ts
import { z as z4 } from "zod";

// server/integrations/auth/oidcAuth.ts
import * as client from "openid-client";
import { Strategy } from "openid-client/passport";
import passport from "passport";
import session from "express-session";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";

// server/integrations/auth/storage.ts
import { and as and2, eq as eq2, gt } from "drizzle-orm";
import { randomUUID } from "crypto";
var AuthStorage = class {
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq2(users.id, id));
    return user;
  }
  async getUserByEmail(email) {
    const [user] = await db.select().from(users).where(eq2(users.email, email));
    return user;
  }
  async getTenants() {
    return await db.select().from(users).where(eq2(users.role, "tenant"));
  }
  async upsertUser(userData) {
    const allUsers = await db.select().from(users).limit(1);
    const role = allUsers.length === 0 ? "manager" : userData.role || "tenant";
    const [user] = await db.insert(users).values({ ...userData, role }).onConflictDoUpdate({
      target: users.id,
      set: {
        ...userData,
        updatedAt: /* @__PURE__ */ new Date()
      }
    }).returning();
    return user;
  }
  async createLocalUser(input) {
    const [user] = await db.insert(users).values({
      id: `local_${randomUUID()}`,
      email: input.email,
      passwordHash: input.passwordHash,
      authProvider: "local",
      role: input.role,
      emailVerifiedAt: null,
      firstName: input.firstName,
      lastName: input.lastName
    }).returning();
    return user;
  }
  async updateUserRole(id, role) {
    const [user] = await db.update(users).set({ role, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(users.id, id)).returning();
    return user;
  }
  async linkLocalCredentials(input) {
    const [user] = await db.update(users).set({
      passwordHash: input.passwordHash,
      authProvider: "local",
      role: input.role,
      firstName: input.firstName,
      lastName: input.lastName,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq2(users.id, input.userId)).returning();
    return user;
  }
  async setResetToken(userId, tokenHash, expiresAt) {
    await db.update(users).set({
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: expiresAt,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq2(users.id, userId));
  }
  async findUserByResetToken(tokenHash) {
    const [user] = await db.select().from(users).where(and2(eq2(users.resetTokenHash, tokenHash), gt(users.resetTokenExpiresAt, /* @__PURE__ */ new Date())));
    return user;
  }
  async updatePassword(userId, passwordHash) {
    await db.update(users).set({
      passwordHash,
      authProvider: "local",
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq2(users.id, userId));
  }
  async markEmailVerified(userId) {
    await db.update(users).set({
      emailVerifiedAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq2(users.id, userId));
  }
  async updateLoginSecurityState(input) {
    await db.update(users).set({
      ...input.failedLoginCount !== void 0 ? { failedLoginCount: input.failedLoginCount } : {},
      ...input.lockoutUntil !== void 0 ? { lockoutUntil: input.lockoutUntil } : {},
      ...input.lastLoginAt !== void 0 ? { lastLoginAt: input.lastLoginAt } : {},
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq2(users.id, input.userId));
  }
  async updateMfaConfig(input) {
    await db.update(users).set({
      mfaEnabled: input.enabled,
      mfaSecret: input.secret ?? null,
      mfaBackupCodes: input.backupCodes ?? [],
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq2(users.id, input.userId));
  }
  async updateUserEmail(userId, email) {
    const [user] = await db.update(users).set({
      email,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq2(users.id, userId)).returning();
    return user;
  }
  async getUserProfileSettings(userId) {
    const [settings] = await db.select().from(userProfileSettings).where(eq2(userProfileSettings.userId, userId));
    return settings;
  }
  async upsertUserProfileSettings(input) {
    const [settings] = await db.insert(userProfileSettings).values({
      userId: input.userId,
      phoneNumber: input.phoneNumber ?? null,
      twoFactorMethod: input.twoFactorMethod ?? null
    }).onConflictDoUpdate({
      target: userProfileSettings.userId,
      set: {
        phoneNumber: input.phoneNumber ?? null,
        twoFactorMethod: input.twoFactorMethod ?? null,
        updatedAt: /* @__PURE__ */ new Date()
      }
    }).returning();
    return settings;
  }
};
var authStorage = new AuthStorage();

// server/integrations/auth/security.ts
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
var failedAttempts = /* @__PURE__ */ new Map();
var lockedUsers = /* @__PURE__ */ new Map();
var emailVerifyTokens = /* @__PURE__ */ new Map();
var magicLinkTokens = /* @__PURE__ */ new Map();
var mfaLoginTokens = /* @__PURE__ */ new Map();
var recoveryTokens = /* @__PURE__ */ new Map();
var knownDeviceHashes = /* @__PURE__ */ new Map();
var pendingStepUp = /* @__PURE__ */ new Map();
var authAuditLog = [];
var MAX_AUDIT_ITEMS = 1e3;
function base32Decode(input) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  const normalized = input.toUpperCase().replace(/=+$/, "");
  for (const char of normalized) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}
function base32Encode(data) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (let i = 0; i < data.length; i++) {
    bits += data[i].toString(2).padStart(8, "0");
  }
  let output = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, "0");
    output += alphabet[parseInt(chunk, 2)];
  }
  return output;
}
function hotp(secretBase32, counter) {
  const key = base32Decode(secretBase32);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 4294967296), 0);
  buffer.writeUInt32BE(counter & 4294967295, 4);
  const hmac = createHmac("sha1", key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const code = (hmac[offset] & 127) << 24 | (hmac[offset + 1] & 255) << 16 | (hmac[offset + 2] & 255) << 8 | hmac[offset + 3] & 255;
  return String(code % 1e6).padStart(6, "0");
}
function nowStep(stepSeconds = 30) {
  return Math.floor(Date.now() / 1e3 / stepSeconds);
}
function generateMfaSecret() {
  return base32Encode(randomBytes(20));
}
function verifyTotp(secret, code) {
  const cleaned = code.replace(/\s+/g, "");
  const current = nowStep();
  for (let offset = -1; offset <= 1; offset++) {
    if (hotp(secret, current + offset) === cleaned) return true;
  }
  return false;
}
function generateBackupCodes() {
  return Array.from({ length: 8 }, () => randomBytes(4).toString("hex"));
}
function hashCode(code) {
  return createHash("sha256").update(code).digest("hex");
}
function verifyHashedCode(raw, hashed) {
  const a = Buffer.from(hashCode(raw), "hex");
  const b = Buffer.from(hashed, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
function isUserLocked(email) {
  const until = lockedUsers.get(email.toLowerCase()) ?? 0;
  return until > Date.now();
}
function registerFailedLogin(email, ip) {
  const key = `${email.toLowerCase()}::${ip}`;
  const now = Date.now();
  const existing = failedAttempts.get(key);
  if (!existing || now >= existing.windowResetAt) {
    failedAttempts.set(key, { count: 1, windowResetAt: now + 15 * 60 * 1e3 });
    return { locked: false, remaining: 4 };
  }
  existing.count += 1;
  const remaining = Math.max(5 - existing.count, 0);
  if (existing.count >= 5) {
    lockedUsers.set(email.toLowerCase(), now + 15 * 60 * 1e3);
    return { locked: true, remaining: 0 };
  }
  return { locked: false, remaining };
}
function clearFailedLogins(email, ip) {
  failedAttempts.delete(`${email.toLowerCase()}::${ip}`);
  lockedUsers.delete(email.toLowerCase());
}
function createVerificationToken(userId) {
  const token = randomBytes(24).toString("hex");
  emailVerifyTokens.set(hashCode(token), { userId, expiresAt: Date.now() + 60 * 60 * 1e3 });
  return token;
}
function consumeVerificationToken(token) {
  const key = hashCode(token);
  const payload = emailVerifyTokens.get(key);
  if (!payload || payload.used || payload.expiresAt < Date.now()) return null;
  payload.used = true;
  return payload.userId;
}
function createMagicLinkToken(userId) {
  const token = randomBytes(24).toString("hex");
  magicLinkTokens.set(hashCode(token), { userId, expiresAt: Date.now() + 15 * 60 * 1e3 });
  return token;
}
function consumeMagicLinkToken(token) {
  const key = hashCode(token);
  const payload = magicLinkTokens.get(key);
  if (!payload || payload.used || payload.expiresAt < Date.now()) return null;
  payload.used = true;
  return payload.userId;
}
function consumeMfaLoginToken(token) {
  const key = hashCode(token);
  const payload = mfaLoginTokens.get(key);
  if (!payload || payload.used || payload.expiresAt < Date.now()) return null;
  payload.used = true;
  return payload.userId;
}
function createRecoveryToken(userId) {
  const token = randomBytes(24).toString("hex");
  recoveryTokens.set(hashCode(token), {
    userId,
    expiresAt: Date.now() + 2 * 60 * 60 * 1e3,
    notBefore: Date.now() + 10 * 60 * 1e3
  });
  return token;
}
function consumeRecoveryToken(token) {
  const key = hashCode(token);
  const payload = recoveryTokens.get(key);
  if (!payload || payload.used || payload.expiresAt < Date.now()) return null;
  if (Date.now() < payload.notBefore) return { userId: payload.userId, ready: false };
  payload.used = true;
  return { userId: payload.userId, ready: true };
}
function deviceFingerprint(ip, userAgent) {
  return hashCode(`${ip}::${userAgent}`);
}
function rememberDevice(userId, fingerprint) {
  const set = knownDeviceHashes.get(userId) ?? /* @__PURE__ */ new Set();
  set.add(fingerprint);
  knownDeviceHashes.set(userId, set);
}
function consumeStepUpToken(token) {
  const key = hashCode(token);
  const payload = pendingStepUp.get(key);
  if (!payload || payload.used || payload.expiresAt < Date.now()) return null;
  payload.used = true;
  return payload.userId;
}
function writeAuthAudit(event) {
  authAuditLog.unshift({ at: (/* @__PURE__ */ new Date()).toISOString(), ...event });
  if (authAuditLog.length > MAX_AUDIT_ITEMS) authAuditLog.length = MAX_AUDIT_ITEMS;
}
function readAuthAudit(userId) {
  if (!userId) return authAuditLog.slice(0, 200);
  return authAuditLog.filter((e) => e.userId === userId).slice(0, 200);
}
function parseCountryFromHeaders(headers) {
  const raw = headers["x-vercel-ip-country"] || headers["cf-ipcountry"] || headers["x-country"] || "";
  return String(raw || "").trim().toUpperCase();
}
function validateGeoPolicy(countryCode) {
  const allow = (process.env.AUTH_ALLOW_COUNTRIES || "").split(",").map((v) => v.trim().toUpperCase()).filter(Boolean);
  const deny = (process.env.AUTH_DENY_COUNTRIES || "").split(",").map((v) => v.trim().toUpperCase()).filter(Boolean);
  if (countryCode && deny.includes(countryCode)) return { ok: false, reason: "Login blocked from your region." };
  if (allow.length > 0 && countryCode && !allow.includes(countryCode)) return { ok: false, reason: "Login not allowed from this region." };
  return { ok: true };
}
function isCaptchaSatisfied(req) {
  if (process.env.REQUIRE_CAPTCHA_ON_AUTH !== "true") return true;
  const token = req.headers["x-captcha-token"];
  return typeof token === "string" && token.trim().length >= 20;
}
function isPasskeyFeatureEnabled() {
  return process.env.ENABLE_PASSKEYS === "true";
}

// server/integrations/auth/sessionRegistry.ts
var bySession = /* @__PURE__ */ new Map();
function trackSession(meta) {
  bySession.set(meta.sid, meta);
}
function touchSession(sid) {
  const existing = bySession.get(sid);
  if (!existing) return;
  existing.lastSeenAt = Date.now();
}
function removeSession(sid) {
  bySession.delete(sid);
}
function sessionsForUser(userId) {
  return Array.from(bySession.values()).filter((s) => s.userId === userId).sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

// server/integrations/auth/oidcAuth.ts
var OIDC_PLACEHOLDERS = [
  "your-auth-provider.com",
  "your-client-id-here",
  "your-tenant.auth0.com"
];
function isDevAuthBypassEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_BYPASS === "true";
}
function isOidcConfigured() {
  const issuer = process.env.ISSUER_URL ?? process.env.OIDC_ISSUER_URL ?? "";
  const clientId = process.env.CLIENT_ID ?? "";
  if (!issuer || !clientId) return false;
  const isPlaceholder = OIDC_PLACEHOLDERS.some(
    (p) => issuer.includes(p) || clientId.includes(p)
  );
  return !isPlaceholder;
}
var getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? process.env.OIDC_ISSUER_URL),
      process.env.CLIENT_ID
    );
  },
  { maxAge: 3600 * 1e3 }
);
function getSession() {
  const configuredSecret = process.env.SESSION_SECRET ?? "";
  const hasStrongSecret = configuredSecret.length >= 32;
  if (process.env.NODE_ENV === "production" && !hasStrongSecret) {
    console.warn(
      "SESSION_SECRET is missing or too short in production. Falling back to a temporary secret; rotate SESSION_SECRET to a 32+ character value."
    );
  }
  const sessionSecret = hasStrongSecret ? configuredSecret : "prod-fallback-session-secret-change-immediately-0123456789";
  const sessionTtl = 7 * 24 * 60 * 60 * 1e3;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions"
  });
  return session({
    name: process.env.NODE_ENV === "production" ? "__Host-propman.sid" : "propman.sid",
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    unset: "destroy",
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: sessionTtl
    }
  });
}
function updateUserSession(user, tokens) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}
async function upsertUser(claims) {
  await authStorage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"]
  });
}
async function setupAuth(app) {
  app.set("trust proxy", process.env.NODE_ENV === "production" ? 1 : 0);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(async (req, res, next) => {
    try {
      const sid = req.sessionID;
      if (!sid) return next();
      if (req.user?.claims?.sub) {
        const ip = getClientIp(req);
        const ua = String(req.headers["user-agent"] || "unknown");
        const fp = deviceFingerprint(ip, ua);
        if (!req.session.securityBinding) {
          req.session.securityBinding = fp;
        } else if (req.session.securityBinding !== fp) {
          req.logout?.(() => {
            req.session?.destroy(() => {
              removeSession(sid);
              return res.status(401).json({ message: "Session security check failed. Please sign in again." });
            });
          });
          return;
        }
        let userRole = String(req.session.userRole || "").trim();
        if (!userRole) {
          const dbUser = await authStorage.getUser(req.user.claims.sub);
          if (dbUser?.role) {
            userRole = dbUser.role;
            req.session.userRole = userRole;
          }
        }
        const defaultIdleMaxMs = Number(process.env.SESSION_IDLE_TIMEOUT_MS || 30 * 60 * 1e3);
        const adminIdleRequestedMs = Number(process.env.ADMIN_SESSION_IDLE_TIMEOUT_MS || 10 * 60 * 1e3);
        const adminIdleMaxMs = Math.min(10 * 60 * 1e3, Math.max(5 * 60 * 1e3, adminIdleRequestedMs));
        const idleMaxMs = userRole === "manager" ? adminIdleMaxMs : defaultIdleMaxMs;
        const lastActivityAt = Number(req.session.lastActivityAt || Date.now());
        if (Date.now() - lastActivityAt > idleMaxMs) {
          req.logout?.(() => {
            req.session?.destroy(() => {
              removeSession(sid);
              return res.status(401).json({ message: "Session expired due to inactivity." });
            });
          });
          return;
        }
        req.session.lastActivityAt = Date.now();
        touchSession(sid);
        trackSession({
          sid,
          userId: req.user.claims.sub,
          ip,
          userAgent: ua,
          createdAt: Number(req.session.createdAt || Date.now()),
          lastSeenAt: Date.now()
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/auth/logout", (req, res) => {
    const sid = req.sessionID;
    const finish = () => {
      req.session?.destroy(() => {
        if (sid) removeSession(sid);
        res.status(204).send();
      });
    };
    if (typeof req.logout === "function") return req.logout(finish);
    return finish();
  });
  passport.serializeUser((user, cb) => cb(null, user));
  passport.deserializeUser((user, cb) => cb(null, user));
  if (isDevAuthBypassEnabled()) {
    const devUserId = process.env.DEV_AUTH_BYPASS_USER_ID ?? "dev-local-user";
    const devUserEmail = process.env.DEV_AUTH_BYPASS_EMAIL ?? "dev@localhost";
    await authStorage.upsertUser({
      id: devUserId,
      email: devUserEmail,
      firstName: "Dev",
      lastName: "User",
      role: "manager"
    });
    app.use((req, _res, next) => {
      req.user = {
        claims: {
          sub: devUserId,
          email: devUserEmail
        },
        expires_at: Math.floor(Date.now() / 1e3) + 60 * 60 * 24 * 7
      };
      req.isAuthenticated = () => true;
      next();
    });
    app.get("/api/login", (_req, res) => {
      res.redirect("/");
    });
    app.get("/api/login/google", (_req, res) => {
      res.redirect("/");
    });
    app.get("/api/login/facebook", (_req, res) => {
      res.redirect("/");
    });
    app.get("/api/callback", (_req, res) => {
      res.redirect("/");
    });
    app.get("/api/logout", (req, res) => {
      req.logout?.(() => {
        const sid = req.sessionID;
        req.session?.destroy(() => {
          if (sid) removeSession(sid);
          res.redirect("/");
        });
      });
    });
    return;
  }
  if (!isOidcConfigured()) {
    app.get("/api/login", (_req, res) => {
      res.status(503).json({
        message: "OIDC not configured. Set ISSUER_URL and CLIENT_ID in .env (see QUICK_OIDC_SETUP.md)."
      });
    });
    app.get("/api/callback", (_req, res) => {
      res.redirect("/?error=oidc-not-configured");
    });
    app.get("/api/login/google", (_req, res) => {
      res.status(503).json({ message: "OIDC not configured." });
    });
    app.get("/api/login/facebook", (_req, res) => {
      res.status(503).json({ message: "OIDC not configured." });
    });
    app.get("/api/logout", (req, res) => {
      req.logout?.(() => {
        const sid = req.sessionID;
        req.session?.destroy(() => {
          if (sid) removeSession(sid);
          res.redirect("/");
        });
      });
    });
    return;
  }
  let config;
  try {
    config = await getOidcConfig();
  } catch (error) {
    console.error(
      "OIDC discovery failed. Auth routes will return 503 until configuration/connectivity is fixed.",
      error
    );
    app.get("/api/login", (_req, res) => {
      res.status(503).json({ message: "OIDC provider unavailable." });
    });
    app.get("/api/login/google", (_req, res) => {
      res.status(503).json({ message: "OIDC provider unavailable." });
    });
    app.get("/api/login/facebook", (_req, res) => {
      res.status(503).json({ message: "OIDC provider unavailable." });
    });
    app.get("/api/callback", (_req, res) => {
      res.redirect("/?error=oidc-provider-unavailable");
    });
    app.get("/api/logout", (req, res) => {
      req.logout?.(() => {
        const sid = req.sessionID;
        req.session?.destroy(() => {
          if (sid) removeSession(sid);
          res.redirect("/");
        });
      });
    });
    return;
  }
  const verify = async (tokens, verified) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };
  const registeredStrategies = /* @__PURE__ */ new Set();
  const ensureStrategy = (req) => {
    const domain = req.hostname;
    const protocol = req.protocol || (req.secure ? "https" : "http");
    const strategyName = `oidcauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `${protocol}://${domain}/api/callback`
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };
  const startOidcLogin = (req, res, next, provider) => {
    const desiredRole = typeof req.query.role === "string" ? req.query.role : void 0;
    if (desiredRole === "manager" || desiredRole === "tenant" || desiredRole === "investor") {
      req.session.desiredRole = desiredRole;
    }
    ensureStrategy(req);
    const providerParams = provider === "google" ? { connection: "google-oauth2" } : provider === "facebook" ? { connection: "facebook" } : {};
    passport.authenticate(`oidcauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
      ...providerParams
    })(req, res, next);
  };
  app.get("/api/login", (req, res, next) => {
    startOidcLogin(req, res, next);
  });
  app.get("/api/login/google", (req, res, next) => {
    startOidcLogin(req, res, next, "google");
  });
  app.get("/api/login/facebook", (req, res, next) => {
    startOidcLogin(req, res, next, "facebook");
  });
  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req);
    passport.authenticate(`oidcauth:${req.hostname}`, async (err, user) => {
      if (err || !user) {
        return res.redirect("/api/login");
      }
      req.logIn(user, async (loginErr) => {
        if (loginErr) return next(loginErr);
        const desiredRole = req.session?.desiredRole;
        if ((desiredRole === "manager" || desiredRole === "tenant" || desiredRole === "investor") && req.user?.claims?.sub) {
          await authStorage.updateUserRole(req.user.claims.sub, desiredRole);
          delete req.session.desiredRole;
        }
        return res.redirect("/");
      });
    })(req, res, next);
  });
  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      const sid = req.sessionID;
      if (sid) removeSession(sid);
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.CLIENT_ID,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`
        }).href
      );
    });
  });
}
var isAuthenticated = async (req, res, next) => {
  const user = req.user;
  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const now = Math.floor(Date.now() / 1e3);
  if (now <= user.expires_at) {
    return next();
  }
  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};

// server/integrations/auth/routes.ts
import { z as z3 } from "zod";

// server/integrations/auth/crypto.ts
import { createHash as createHash2, randomBytes as randomBytes2, scryptSync, timingSafeEqual as timingSafeEqual2 } from "crypto";
function hashPassword(password) {
  const salt = randomBytes2(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}
function verifyPassword(password, hashed) {
  const [salt, expected] = hashed.split(":");
  if (!salt || !expected) return false;
  const derived = scryptSync(password, salt, 64).toString("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const derivedBuf = Buffer.from(derived, "hex");
  if (expectedBuf.length !== derivedBuf.length) return false;
  return timingSafeEqual2(expectedBuf, derivedBuf);
}
function generateResetToken() {
  return randomBytes2(32).toString("hex");
}
function hashToken(token) {
  return createHash2("sha256").update(token).digest("hex");
}

// server/middleware/rateLimit.ts
var buckets = /* @__PURE__ */ new Map();
function getClientIp2(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}
function createRateLimiter(options) {
  const {
    windowMs,
    max,
    keyPrefix,
    keyGenerator = (req) => getClientIp2(req),
    message = "Too many requests. Please try again later."
  } = options;
  return (req, res, next) => {
    const now = Date.now();
    const key = `${keyPrefix}:${keyGenerator(req)}`;
    const existing = buckets.get(key);
    if (!existing || now >= existing.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", String(max - 1));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil((now + windowMs) / 1e3)));
      return next();
    }
    existing.count += 1;
    const remaining = Math.max(max - existing.count, 0);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(existing.resetAt / 1e3)));
    if (existing.count > max) {
      return res.status(429).json({ message });
    }
    return next();
  };
}

// server/integrations/auth/mailer.ts
function getAppBaseUrl() {
  const fromEnv = process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (fromEnv) {
    const trimmed = fromEnv.trim();
    try {
      const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
      return parsed.origin;
    } catch {
      return trimmed.replace(/\/+$/, "").replace(/\/.*$/, "");
    }
  }
  return "http://localhost:5001";
}
function getFromAddress() {
  return process.env.AUTH_EMAIL_FROM || "PropMan Security <security@propman.local>";
}
async function sendWithResend(payload) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: getFromAddress(),
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text
    })
  });
  if (!response.ok) {
    const body2 = await response.text().catch(() => "");
    throw new Error(`Resend request failed (${response.status}): ${body2.slice(0, 300)}`);
  }
  const body = await response.json().catch(() => ({}));
  return { provider: "resend", id: body?.id };
}
async function sendAuthEmail(payload) {
  const provider = (process.env.AUTH_EMAIL_PROVIDER || "resend").toLowerCase();
  if (provider === "resend") {
    return sendWithResend(payload);
  }
  throw new Error(`Unsupported AUTH_EMAIL_PROVIDER: ${provider}`);
}
async function sendVerificationEmail(input) {
  const base = getAppBaseUrl();
  const verifyLink = `${base}/api/auth/verify-email?token=${encodeURIComponent(input.token)}`;
  return sendAuthEmail({
    to: input.to,
    subject: "Verify your email",
    html: `<p>Verify your email to activate your account:</p><p><a href="${verifyLink}">Verify Email</a></p><p>If you did not create this account, ignore this email.</p>`,
    text: `Verify your email to activate your account: ${verifyLink}`
  });
}
async function sendPasswordResetEmail(input) {
  const base = getAppBaseUrl();
  const resetLink = `${base}/login?mode=forgot&token=${encodeURIComponent(input.token)}`;
  return sendAuthEmail({
    to: input.to,
    subject: "Reset your password",
    html: `<p>Use the link below to reset your password:</p><p><a href="${resetLink}">Reset Password</a></p><p>This link expires in 1 hour.</p>`,
    text: `Reset your password: ${resetLink}`
  });
}
async function sendMagicLinkEmail(input) {
  const base = getAppBaseUrl();
  const rolePart = input.role ? `&role=${encodeURIComponent(input.role)}` : "";
  const link = `${base}/api/auth/magic-link/consume?token=${encodeURIComponent(input.token)}${rolePart}`;
  return sendAuthEmail({
    to: input.to,
    subject: "Your secure sign-in link",
    html: `<p>Use this one-time link to sign in:</p><p><a href="${link}">Sign in to PropMan</a></p><p>This link expires in 15 minutes.</p>`,
    text: `Use this one-time sign-in link (expires in 15 minutes): ${link}`
  });
}
async function sendRecoveryEmail(input) {
  const base = getAppBaseUrl();
  const link = `${base}/login?mode=recovery&recoveryToken=${encodeURIComponent(input.token)}`;
  return sendAuthEmail({
    to: input.to,
    subject: "Account recovery request",
    html: `<p>An account recovery was requested for your account.</p><p><a href="${link}">Continue recovery</a></p><p>For security, recovery has a short cooldown before completion.</p>`,
    text: `Account recovery link: ${link}`
  });
}

// server/integrations/auth/routes.ts
var signupSchema = z3.object({
  email: z3.string().email(),
  password: z3.string().min(8),
  role: z3.enum(["manager", "tenant", "investor"]),
  firstName: z3.string().optional(),
  lastName: z3.string().optional()
});
var loginSchema = z3.object({
  email: z3.string().email(),
  password: z3.string().min(1),
  role: z3.enum(["manager", "tenant", "investor"])
});
var forgotSchema = z3.object({
  email: z3.string().email()
});
var resetSchema = z3.object({
  token: z3.string().min(1),
  password: z3.string().min(8)
});
var mfaSetupSchema = z3.object({
  password: z3.string().min(1)
});
var mfaEnableSchema = z3.object({
  secret: z3.string().min(16),
  code: z3.string().min(6)
});
var loginMfaVerifySchema = z3.object({
  loginToken: z3.string().min(1),
  code: z3.string().optional(),
  backupCode: z3.string().optional()
});
var emailVerifySchema = z3.object({
  token: z3.string().min(1)
});
var resendVerifySchema = z3.object({
  email: z3.string().email()
});
var magicLinkRequestSchema = z3.object({
  email: z3.string().email()
});
var magicLinkConsumeSchema = z3.object({
  token: z3.string().min(1),
  role: z3.enum(["manager", "tenant", "investor"]).optional()
});
var recoveryStartSchema = z3.object({
  email: z3.string().email()
});
var recoveryCompleteSchema = z3.object({
  token: z3.string().min(1),
  password: z3.string().min(12)
});
var stepUpCompleteSchema = z3.object({
  token: z3.string().min(1),
  password: z3.string().min(1)
});
var reauthSchema = z3.object({
  password: z3.string().min(1)
});
var updateProfileSchema = z3.object({
  email: z3.string().email(),
  phoneNumber: z3.string().trim().min(7).max(25).regex(/^[0-9+()\-\s]+$/, "Phone number contains invalid characters").optional().nullable(),
  twoFactorEnabled: z3.boolean().optional(),
  twoFactorMethod: z3.enum(["email", "phone"]).optional().nullable()
});
function buildLocalSessionUser(user) {
  return {
    claims: {
      sub: user.id,
      email: user.email
    },
    expires_at: Math.floor(Date.now() / 1e3) + 60 * 60 * 24 * 7,
    provider: "local"
  };
}
function getClientIp3(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}
async function establishSession(req, res, user) {
  await new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      return resolve();
    });
  });
  return req.login(buildLocalSessionUser(user), (err) => {
    if (err) return res.status(500).json({ message: "Failed to create session." });
    req.session.createdAt = Date.now();
    req.session.lastActivityAt = Date.now();
    req.session.securityBinding = deviceFingerprint(getClientIp3(req), String(req.headers["user-agent"] || "unknown"));
    return res.json({ id: user.id, email: user.email, role: user.role });
  });
}
function mapAuthDbError(error) {
  const message = error?.message ?? "";
  if (typeof message === "string") {
    if (message.includes("column") && (message.includes("auth_provider") || message.includes("password_hash") || message.includes("reset_token_hash") || message.includes("reset_token_expires_at"))) {
      return "Database schema is out of date. Run `npm run db:push` and retry.";
    }
    if (message.includes("gen_random_uuid")) {
      return "Database is missing UUID support. Run `npm run db:push` or enable pgcrypto.";
    }
  }
  return "Authentication service error. Check server logs.";
}
function registerAuthRoutes(app) {
  const strictAuthLimiter = createRateLimiter({
    keyPrefix: "auth-strict",
    windowMs: 15 * 60 * 1e3,
    max: 20,
    message: "Too many auth attempts. Please wait and try again."
  });
  const loginLimiter = createRateLimiter({
    keyPrefix: "auth-login",
    windowMs: 15 * 60 * 1e3,
    max: 10,
    keyGenerator: (req) => {
      const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
      const ip = req.ip || req.socket?.remoteAddress || "unknown";
      return `${ip}:${email}`;
    },
    message: "Too many login attempts. Please wait and try again."
  });
  app.post("/api/auth/signup", strictAuthLimiter, async (req, res) => {
    try {
      if (!isCaptchaSatisfied(req)) {
        return res.status(400).json({ message: "Captcha validation required." });
      }
      const input = signupSchema.parse(req.body);
      input.email = input.email.trim().toLowerCase();
      const existing = await authStorage.getUserByEmail(input.email);
      if (existing) {
        if (!existing.passwordHash) {
          const linked = await authStorage.linkLocalCredentials({
            userId: existing.id,
            passwordHash: hashPassword(input.password),
            role: input.role,
            firstName: input.firstName ?? existing.firstName ?? void 0,
            lastName: input.lastName ?? existing.lastName ?? void 0
          });
          if (!linked) {
            return res.status(500).json({ message: "Failed to update account." });
          }
          await authStorage.markEmailVerified(linked.id);
          return establishSession(req, res.status(200), { id: linked.id, email: linked.email, role: linked.role });
        }
        return res.status(409).json({ message: "Email already registered. Please sign in." });
      }
      const user = await authStorage.createLocalUser({
        email: input.email,
        passwordHash: hashPassword(input.password),
        role: input.role,
        firstName: input.firstName,
        lastName: input.lastName
      });
      const verificationToken = createVerificationToken(user.id);
      writeAuthAudit({
        action: "signup",
        userId: user.id,
        email: user.email ?? void 0,
        ip: getClientIp3(req),
        userAgent: String(req.headers["user-agent"] || "unknown"),
        success: true,
        detail: "Account created"
      });
      const payload = {
        message: "Account created. Verify your email before first login."
      };
      if (user.email) {
        await sendVerificationEmail({ to: user.email, token: verificationToken });
      }
      if (process.env.NODE_ENV !== "production") payload.verificationToken = verificationToken;
      return res.status(201).json(payload);
    } catch (error) {
      if (error instanceof z3.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Invalid input." });
      }
      console.error("Signup error:", error);
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });
  app.post("/api/auth/login", loginLimiter, async (req, res) => {
    try {
      if (!isCaptchaSatisfied(req)) {
        return res.status(400).json({ message: "Captcha validation required." });
      }
      const input = loginSchema.parse(req.body);
      input.email = input.email.trim().toLowerCase();
      const ip = getClientIp3(req);
      const userAgent = String(req.headers["user-agent"] || "unknown");
      const countryCode = parseCountryFromHeaders(req.headers);
      const geo = validateGeoPolicy(countryCode);
      if (!geo.ok) {
        writeAuthAudit({
          action: "login",
          email: input.email,
          ip,
          userAgent,
          success: false,
          detail: geo.reason
        });
        return res.status(403).json({ message: geo.reason });
      }
      if (isUserLocked(input.email)) {
        return res.status(429).json({ message: "Account temporarily locked. Please try again later." });
      }
      const user = await authStorage.getUserByEmail(input.email);
      if (!user || !user.passwordHash) {
        registerFailedLogin(input.email, ip);
        return res.status(401).json({ message: "Invalid email or password." });
      }
      if (!verifyPassword(input.password, user.passwordHash)) {
        const result = registerFailedLogin(input.email, ip);
        await authStorage.updateLoginSecurityState({
          userId: user.id,
          failedLoginCount: (user.failedLoginCount ?? 0) + 1,
          lockoutUntil: result.locked ? new Date(Date.now() + 15 * 60 * 1e3) : user.lockoutUntil
        });
        writeAuthAudit({
          action: "login",
          userId: user.id,
          email: user.email ?? void 0,
          ip,
          userAgent,
          success: false,
          detail: "Invalid password"
        });
        return res.status(401).json({ message: "Invalid email or password." });
      }
      if (user.role !== input.role) {
        return res.status(403).json({ message: `This account is registered as ${user.role}.` });
      }
      clearFailedLogins(input.email, ip);
      await authStorage.updateLoginSecurityState({
        userId: user.id,
        failedLoginCount: 0,
        lockoutUntil: null,
        lastLoginAt: /* @__PURE__ */ new Date()
      });
      const fingerprint = deviceFingerprint(ip, userAgent);
      rememberDevice(user.id, fingerprint);
      writeAuthAudit({
        action: "login",
        userId: user.id,
        email: user.email ?? void 0,
        ip,
        userAgent,
        success: true
      });
      return establishSession(req, res, { id: user.id, email: user.email, role: user.role });
    } catch (error) {
      if (error instanceof z3.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Invalid input." });
      }
      console.error("Login error:", error);
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });
  app.post("/api/auth/forgot-password", strictAuthLimiter, async (req, res) => {
    try {
      const input = forgotSchema.parse(req.body);
      input.email = input.email.trim().toLowerCase();
      const payload = {
        message: "If that email exists, a reset email has been sent."
      };
      const user = await authStorage.getUserByEmail(input.email);
      if (!user) {
        if (process.env.NODE_ENV !== "production") {
          payload.debug = "no_user";
        }
        return res.json(payload);
      }
      const token = generateResetToken();
      await authStorage.setResetToken(user.id, hashToken(token), new Date(Date.now() + 60 * 60 * 1e3));
      const recoveryToken = createRecoveryToken(user.id);
      if (user.email) {
        const delivery = await sendPasswordResetEmail({ to: user.email, token });
        console.log(
          `[auth] password reset email queued for ${user.email} via ${delivery.provider}${delivery.id ? ` (${delivery.id})` : ""}`
        );
        if (process.env.NODE_ENV !== "production") {
          payload.debug = "sent";
        }
      } else if (process.env.NODE_ENV !== "production") {
        payload.debug = "no_email";
      }
      if (process.env.NODE_ENV !== "production") {
        payload.resetToken = token;
        payload.recoveryToken = recoveryToken;
      }
      writeAuthAudit({
        action: "forgot_password",
        userId: user.id,
        email: user.email ?? void 0,
        ip: getClientIp3(req),
        userAgent: String(req.headers["user-agent"] || "unknown"),
        success: true
      });
      return res.json(payload);
    } catch (error) {
      if (error instanceof z3.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Invalid input." });
      }
      console.error("Forgot-password error:", error);
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });
  app.post("/api/auth/reset-password", strictAuthLimiter, async (req, res) => {
    try {
      const input = resetSchema.parse(req.body);
      const tokenHash = hashToken(input.token);
      const user = await authStorage.findUserByResetToken(tokenHash);
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset token." });
      }
      await authStorage.updatePassword(user.id, hashPassword(input.password));
      writeAuthAudit({
        action: "reset_password",
        userId: user.id,
        email: user.email ?? void 0,
        ip: getClientIp3(req),
        userAgent: String(req.headers["user-agent"] || "unknown"),
        success: true
      });
      return res.json({ message: "Password updated successfully." });
    } catch (error) {
      if (error instanceof z3.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Invalid input." });
      }
      console.error("Reset-password error:", error);
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });
  app.post("/api/auth/verify-email", strictAuthLimiter, async (req, res) => {
    try {
      const input = emailVerifySchema.parse(req.body);
      const userId = consumeVerificationToken(input.token);
      if (!userId) return res.status(400).json({ message: "Invalid or expired verification token." });
      await authStorage.markEmailVerified(userId);
      return res.json({ message: "Email verified successfully." });
    } catch (error) {
      if (error instanceof z3.ZodError) return res.status(400).json({ message: "Invalid request." });
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });
  app.post("/api/auth/verify-email/resend", strictAuthLimiter, async (req, res) => {
    try {
      const input = resendVerifySchema.parse(req.body);
      const normalizedEmail = input.email.trim().toLowerCase();
      const user = await authStorage.getUserByEmail(normalizedEmail);
      const payload = {
        message: "If the account exists and is not verified, a verification email has been sent."
      };
      if (!user || !user.email || user.emailVerifiedAt) {
        if (process.env.NODE_ENV !== "production") {
          payload.debug = !user ? "no_user" : user.emailVerifiedAt ? "already_verified" : "no_email";
        }
        return res.json(payload);
      }
      const token = createVerificationToken(user.id);
      await sendVerificationEmail({ to: user.email, token });
      console.log(`[auth] verification resend queued for ${user.email}`);
      if (process.env.NODE_ENV !== "production") {
        payload.debug = "sent";
      }
      if (process.env.NODE_ENV !== "production") payload.verificationToken = token;
      return res.json(payload);
    } catch (error) {
      if (error instanceof z3.ZodError) return res.status(400).json({ message: "Invalid email." });
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });
  app.get("/api/auth/verify-email", strictAuthLimiter, async (req, res) => {
    try {
      const token = String(req.query?.token ?? "");
      if (!token) return res.status(400).json({ message: "Missing token." });
      const userId = consumeVerificationToken(token);
      if (!userId) return res.status(400).json({ message: "Invalid or expired verification token." });
      await authStorage.markEmailVerified(userId);
      return res.redirect("/login?verified=true");
    } catch (error) {
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });
  app.post("/api/auth/magic-link/request", strictAuthLimiter, async (req, res) => {
    try {
      const input = magicLinkRequestSchema.parse(req.body);
      input.email = input.email.trim().toLowerCase();
      const user = await authStorage.getUserByEmail(input.email);
      const response = { message: "If the account exists, a magic link has been generated." };
      if (!user) return res.json(response);
      const token = createMagicLinkToken(user.id);
      if (user.email) {
        await sendMagicLinkEmail({ to: user.email, token, role: user.role });
      }
      if (process.env.NODE_ENV !== "production") response.magicLinkToken = token;
      return res.json(response);
    } catch (error) {
      if (error instanceof z3.ZodError) return res.status(400).json({ message: "Invalid request." });
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });
  app.post("/api/auth/magic-link/consume", strictAuthLimiter, async (req, res) => {
    try {
      const input = magicLinkConsumeSchema.parse(req.body);
      const userId = consumeMagicLinkToken(input.token);
      if (!userId) return res.status(400).json({ message: "Invalid or expired magic link." });
      const user = await authStorage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found." });
      if (input.role && user.role !== input.role) return res.status(403).json({ message: "Role mismatch for magic-link sign in." });
      return establishSession(req, res, { id: user.id, email: user.email, role: user.role });
    } catch (error) {
      if (error instanceof z3.ZodError) return res.status(400).json({ message: "Invalid request." });
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });
  app.get("/api/auth/magic-link/consume", strictAuthLimiter, async (req, res) => {
    try {
      const token = String(req.query?.token ?? "");
      const role = typeof req.query?.role === "string" ? req.query.role : void 0;
      const userId = consumeMagicLinkToken(token);
      if (!userId) return res.status(400).json({ message: "Invalid or expired magic link." });
      const user = await authStorage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found." });
      if (role && user.role !== role) return res.status(403).json({ message: "Role mismatch for magic-link sign in." });
      return req.login(buildLocalSessionUser(user), (err) => {
        if (err) return res.status(500).json({ message: "Failed to create session." });
        req.session.createdAt = Date.now();
        req.session.lastActivityAt = Date.now();
        req.session.securityBinding = deviceFingerprint(getClientIp3(req), String(req.headers["user-agent"] || "unknown"));
        return res.redirect("/");
      });
    } catch (error) {
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });
  app.post("/api/auth/login/step-up", strictAuthLimiter, async (req, res) => {
    try {
      const input = stepUpCompleteSchema.parse(req.body);
      const userId = consumeStepUpToken(input.token);
      if (!userId) return res.status(400).json({ message: "Invalid or expired step-up token." });
      const user = await authStorage.getUser(userId);
      if (!user || !user.passwordHash) return res.status(404).json({ message: "User not found." });
      if (!verifyPassword(input.password, user.passwordHash)) return res.status(401).json({ message: "Invalid credentials." });
      rememberDevice(user.id, deviceFingerprint(getClientIp3(req), String(req.headers["user-agent"] || "unknown")));
      return establishSession(req, res, { id: user.id, email: user.email, role: user.role });
    } catch (error) {
      if (error instanceof z3.ZodError) return res.status(400).json({ message: "Invalid request." });
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });
  app.post("/api/auth/mfa/setup", isAuthenticated, async (req, res) => {
    try {
      const input = mfaSetupSchema.parse(req.body);
      const userId = req.user?.claims?.sub;
      const user = await authStorage.getUser(userId);
      if (!user || !user.passwordHash) return res.status(404).json({ message: "User not found." });
      if (!verifyPassword(input.password, user.passwordHash)) return res.status(401).json({ message: "Invalid password." });
      const secret = generateMfaSecret();
      const backupCodes = generateBackupCodes();
      req.session.pendingMfaSecret = secret;
      req.session.pendingMfaBackupCodes = backupCodes.map(hashCode);
      return res.json({
        secret,
        otpauthUrl: `otpauth://totp/PropMan:${encodeURIComponent(user.email || user.id)}?secret=${secret}&issuer=PropMan`,
        backupCodes
      });
    } catch (error) {
      if (error instanceof z3.ZodError) return res.status(400).json({ message: "Invalid request." });
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });
  app.post("/api/auth/mfa/enable", isAuthenticated, async (req, res) => {
    try {
      const input = mfaEnableSchema.parse(req.body);
      const userId = req.user?.claims?.sub;
      const pendingSecret = req.session.pendingMfaSecret;
      const pendingBackupCodes = req.session.pendingMfaBackupCodes;
      if (!pendingSecret || !pendingBackupCodes) return res.status(400).json({ message: "No pending MFA setup found." });
      if (pendingSecret !== input.secret) return res.status(400).json({ message: "MFA secret mismatch." });
      if (!verifyTotp(input.secret, input.code)) return res.status(400).json({ message: "Invalid MFA code." });
      await authStorage.updateMfaConfig({ userId, enabled: true, secret: input.secret, backupCodes: pendingBackupCodes });
      req.session.pendingMfaSecret = void 0;
      req.session.pendingMfaBackupCodes = void 0;
      return res.json({ message: "MFA enabled." });
    } catch (error) {
      if (error instanceof z3.ZodError) return res.status(400).json({ message: "Invalid request." });
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });
  app.post("/api/auth/login/verify-mfa", strictAuthLimiter, async (req, res) => {
    try {
      const input = loginMfaVerifySchema.parse(req.body);
      const userId = consumeMfaLoginToken(input.loginToken);
      if (!userId) return res.status(400).json({ message: "Invalid or expired login token." });
      const user = await authStorage.getUser(userId);
      if (!user || !user.mfaEnabled || !user.mfaSecret) return res.status(400).json({ message: "MFA is not enabled." });
      let valid = false;
      if (input.code) valid = verifyTotp(user.mfaSecret, input.code);
      if (!valid && input.backupCode) {
        const codes = user.mfaBackupCodes ?? [];
        const idx = codes.findIndex((c) => verifyHashedCode(input.backupCode, c));
        if (idx >= 0) {
          codes.splice(idx, 1);
          await authStorage.updateMfaConfig({ userId: user.id, enabled: true, secret: user.mfaSecret, backupCodes: codes });
          valid = true;
        }
      }
      if (!valid) return res.status(401).json({ message: "Invalid MFA code." });
      return establishSession(req, res, { id: user.id, email: user.email, role: user.role });
    } catch (error) {
      if (error instanceof z3.ZodError) return res.status(400).json({ message: "Invalid request." });
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });
  app.post("/api/auth/mfa/disable", isAuthenticated, async (req, res) => {
    const userId = req.user?.claims?.sub;
    await authStorage.updateMfaConfig({ userId, enabled: false, secret: null, backupCodes: [] });
    res.json({ message: "MFA disabled." });
  });
  app.get("/api/auth/sessions", isAuthenticated, async (req, res) => {
    const userId = req.user?.claims?.sub;
    const currentSid = req.sessionID;
    const sessions2 = sessionsForUser(userId).map((s) => ({
      sid: s.sid,
      ip: s.ip,
      userAgent: s.userAgent,
      createdAt: new Date(s.createdAt).toISOString(),
      lastSeenAt: new Date(s.lastSeenAt).toISOString(),
      current: s.sid === currentSid
    }));
    res.json(sessions2);
  });
  app.post("/api/auth/sessions/revoke", isAuthenticated, async (req, res) => {
    const sid = String(req.body?.sid ?? "");
    if (!sid) return res.status(400).json({ message: "sid is required." });
    req.sessionStore.destroy(sid, () => {
      removeSession(sid);
      res.json({ message: "Session revoked." });
    });
  });
  app.post("/api/auth/sessions/revoke-others", isAuthenticated, async (req, res) => {
    const userId = req.user?.claims?.sub;
    const currentSid = req.sessionID;
    const all = sessionsForUser(userId);
    await Promise.all(
      all.filter((s) => s.sid !== currentSid).map(
        (s) => new Promise((resolve) => {
          req.sessionStore.destroy(s.sid, () => {
            removeSession(s.sid);
            resolve();
          });
        })
      )
    );
    res.json({ message: "Other sessions revoked." });
  });
  app.post("/api/auth/reauth", isAuthenticated, async (req, res) => {
    try {
      const input = reauthSchema.parse(req.body);
      const userId = req.user?.claims?.sub;
      const user = await authStorage.getUser(userId);
      if (!user || !user.passwordHash) return res.status(404).json({ message: "User not found." });
      if (!verifyPassword(input.password, user.passwordHash)) return res.status(401).json({ message: "Invalid password." });
      req.session.stepUpVerifiedAt = Date.now();
      return res.json({ message: "Re-authenticated." });
    } catch (error) {
      if (error instanceof z3.ZodError) return res.status(400).json({ message: "Invalid request." });
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });
  app.get("/api/auth/audit", isAuthenticated, async (req, res) => {
    const currentUserId = req.user?.claims?.sub;
    const currentUser = await authStorage.getUser(currentUserId);
    if (currentUser?.role !== "manager") return res.status(403).json({ message: "Forbidden" });
    res.json(readAuthAudit());
  });
  app.post("/api/auth/recovery/start", strictAuthLimiter, async (req, res) => {
    try {
      const input = recoveryStartSchema.parse(req.body);
      input.email = input.email.trim().toLowerCase();
      const user = await authStorage.getUserByEmail(input.email);
      const payload = { message: "If the account exists, recovery has started." };
      if (!user) return res.json(payload);
      const token = createRecoveryToken(user.id);
      if (user.email) {
        await sendRecoveryEmail({ to: user.email, token });
      }
      if (process.env.NODE_ENV !== "production") payload.recoveryToken = token;
      return res.json(payload);
    } catch {
      return res.status(400).json({ message: "Invalid request." });
    }
  });
  app.post("/api/auth/recovery/complete", strictAuthLimiter, async (req, res) => {
    try {
      const input = recoveryCompleteSchema.parse(req.body);
      const token = consumeRecoveryToken(input.token);
      if (!token) return res.status(400).json({ message: "Invalid recovery token." });
      if (!token.ready) return res.status(400).json({ message: "Recovery is cooling down. Try again later." });
      await authStorage.updatePassword(token.userId, hashPassword(input.password));
      return res.json({ message: "Account recovery complete." });
    } catch {
      return res.status(400).json({ message: "Invalid request." });
    }
  });
  app.post("/api/auth/passkeys/register/options", isAuthenticated, async (_req, res) => {
    if (!isPasskeyFeatureEnabled()) return res.status(400).json({ message: "Passkeys are disabled." });
    return res.json({ message: "Passkey registration options endpoint is enabled. Complete WebAuthn ceremony wiring next." });
  });
  app.post("/api/auth/passkeys/register/verify", isAuthenticated, async (_req, res) => {
    if (!isPasskeyFeatureEnabled()) return res.status(400).json({ message: "Passkeys are disabled." });
    return res.json({ message: "Passkey registration verify endpoint is enabled. Complete WebAuthn ceremony wiring next." });
  });
  app.post("/api/auth/passkeys/auth/options", strictAuthLimiter, async (_req, res) => {
    if (!isPasskeyFeatureEnabled()) return res.status(400).json({ message: "Passkeys are disabled." });
    return res.json({ message: "Passkey auth options endpoint is enabled. Complete WebAuthn ceremony wiring next." });
  });
  app.post("/api/auth/passkeys/auth/verify", strictAuthLimiter, async (_req, res) => {
    if (!isPasskeyFeatureEnabled()) return res.status(400).json({ message: "Passkeys are disabled." });
    return res.json({ message: "Passkey auth verify endpoint is enabled. Complete WebAuthn ceremony wiring next." });
  });
  app.get("/api/auth/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await authStorage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found." });
      const settings = await authStorage.getUserProfileSettings(userId);
      return res.json({
        email: user.email,
        phoneNumber: settings?.phoneNumber ?? null,
        mfaEnabled: Boolean(user.mfaEnabled),
        twoFactorMethod: settings?.twoFactorMethod === "email" || settings?.twoFactorMethod === "phone" ? settings.twoFactorMethod : null
      });
    } catch (error) {
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });
  app.patch("/api/auth/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const input = updateProfileSchema.parse(req.body);
      const normalizedEmail = input.email.trim().toLowerCase();
      const normalizedPhoneNumber = input.phoneNumber?.trim() || null;
      const currentUser = await authStorage.getUser(userId);
      if (!currentUser) return res.status(404).json({ message: "User not found." });
      const currentSettings = await authStorage.getUserProfileSettings(userId);
      const nextTwoFactorEnabled = input.twoFactorEnabled ?? Boolean(currentUser.mfaEnabled);
      const requestedTwoFactorMethod = input.twoFactorMethod ?? currentSettings?.twoFactorMethod ?? null;
      const normalizedTwoFactorMethod = requestedTwoFactorMethod === "email" || requestedTwoFactorMethod === "phone" ? requestedTwoFactorMethod : null;
      const nextTwoFactorMethod = nextTwoFactorEnabled ? normalizedTwoFactorMethod : null;
      if (nextTwoFactorEnabled && (nextTwoFactorMethod !== "email" && nextTwoFactorMethod !== "phone")) {
        return res.status(400).json({ message: "Please choose a 2FA method: email or phone." });
      }
      if (nextTwoFactorEnabled && nextTwoFactorMethod === "phone" && !normalizedPhoneNumber) {
        return res.status(400).json({ message: "Phone number is required for phone-based 2FA." });
      }
      if (currentUser.email !== normalizedEmail) {
        const existing = await authStorage.getUserByEmail(normalizedEmail);
        if (existing && existing.id !== userId) {
          return res.status(409).json({ message: "Email is already in use." });
        }
        await authStorage.updateUserEmail(userId, normalizedEmail);
      }
      await authStorage.upsertUserProfileSettings({
        userId,
        phoneNumber: normalizedPhoneNumber,
        twoFactorMethod: nextTwoFactorMethod
      });
      await authStorage.updateMfaConfig({
        userId,
        enabled: nextTwoFactorEnabled,
        secret: nextTwoFactorEnabled ? currentUser.mfaSecret ?? null : null,
        backupCodes: nextTwoFactorEnabled ? currentUser.mfaBackupCodes ?? [] : []
      });
      const updatedUser = await authStorage.getUser(userId);
      const updatedSettings = await authStorage.getUserProfileSettings(userId);
      const updatedTwoFactorMethod = updatedSettings?.twoFactorMethod === "email" || updatedSettings?.twoFactorMethod === "phone" ? updatedSettings.twoFactorMethod : null;
      return res.json({
        email: updatedUser?.email ?? normalizedEmail,
        phoneNumber: normalizedPhoneNumber,
        mfaEnabled: Boolean(updatedUser?.mfaEnabled),
        twoFactorMethod: updatedTwoFactorMethod
      });
    } catch (error) {
      if (error instanceof z3.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Invalid input." });
      }
      return res.status(500).json({ message: mapAuthDbError(error) });
    }
  });
  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  app.get("/api/auth/tenants", isAuthenticated, async (req, res) => {
    try {
      const currentUserId = req.user?.claims?.sub;
      const currentUser = currentUserId ? await authStorage.getUser(currentUserId) : void 0;
      if (currentUser?.role !== "manager") {
        return res.status(403).json({ message: "Forbidden" });
      }
      const tenants = await authStorage.getTenants();
      res.json(tenants);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tenants" });
    }
  });
}

// server/integrations/chat/routes.ts
import OpenAI from "openai";

// server/integrations/chat/storage.ts
import { eq as eq3, desc as desc2 } from "drizzle-orm";
var OWNER_PREFIX = "owner:";
function withOwnerPrefix(userId, title) {
  return `${OWNER_PREFIX}${userId}:${title}`;
}
function extractOwnerAndTitle(rawTitle) {
  if (!rawTitle.startsWith(OWNER_PREFIX)) {
    return { ownerId: null, title: rawTitle };
  }
  const rest = rawTitle.slice(OWNER_PREFIX.length);
  const idx = rest.indexOf(":");
  if (idx <= 0) return { ownerId: null, title: rawTitle };
  return {
    ownerId: rest.slice(0, idx),
    title: rest.slice(idx + 1) || "New Chat"
  };
}
var chatStorage = {
  async getConversation(id, userId) {
    const [conversation] = await db.select().from(conversations).where(eq3(conversations.id, id));
    if (!conversation) return void 0;
    const owner = extractOwnerAndTitle(conversation.title);
    if (owner.ownerId !== userId) return void 0;
    return {
      ...conversation,
      title: owner.title
    };
  },
  async getAllConversations(userId) {
    const all = await db.select().from(conversations).orderBy(desc2(conversations.createdAt));
    return all.map((conversation) => {
      const owner = extractOwnerAndTitle(conversation.title);
      if (owner.ownerId !== userId) return null;
      return {
        ...conversation,
        title: owner.title
      };
    }).filter((conversation) => Boolean(conversation));
  },
  async createConversation(userId, title) {
    const safeTitle = (title || "New Chat").trim() || "New Chat";
    const [conversation] = await db.insert(conversations).values({ title: withOwnerPrefix(userId, safeTitle) }).returning();
    return {
      ...conversation,
      title: safeTitle
    };
  },
  async deleteConversation(id, userId) {
    const conversation = await this.getConversation(id, userId);
    if (!conversation) return;
    await db.delete(messages).where(eq3(messages.conversationId, id));
    await db.delete(conversations).where(eq3(conversations.id, id));
  },
  async getMessagesByConversation(conversationId) {
    return db.select().from(messages).where(eq3(messages.conversationId, conversationId)).orderBy(messages.createdAt);
  },
  async createMessage(conversationId, role, content) {
    const [message] = await db.insert(messages).values({ conversationId, role, content }).returning();
    return message;
  }
};

// server/integrations/chat/routes.ts
var openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "sk-placeholder",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
});
function registerChatRoutes(app) {
  const parseConversationId = (raw) => {
    const id = Number(String(raw));
    return Number.isFinite(id) ? id : NaN;
  };
  app.get("/api/conversations", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const conversations2 = await chatStorage.getAllConversations(userId);
      res.json(conversations2);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });
  app.get("/api/conversations/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const id = parseConversationId(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid conversation id" });
      const conversation = await chatStorage.getConversation(id, userId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages2 = await chatStorage.getMessagesByConversation(id);
      res.json({ ...conversation, messages: messages2 });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });
  app.post("/api/conversations", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const { title } = req.body;
      const conversation = await chatStorage.createConversation(userId, title || "New Chat");
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });
  app.delete("/api/conversations/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const id = parseConversationId(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid conversation id" });
      await chatStorage.deleteConversation(id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });
  app.post("/api/conversations/:id/messages", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const conversationId = parseConversationId(req.params.id);
      if (!Number.isFinite(conversationId)) return res.status(400).json({ error: "Invalid conversation id" });
      const { content } = req.body;
      const conversation = await chatStorage.getConversation(conversationId, userId);
      if (!conversation) return res.status(404).json({ error: "Conversation not found" });
      if (typeof content !== "string" || content.trim().length === 0) {
        return res.status(400).json({ error: "Message content is required" });
      }
      await chatStorage.createMessage(conversationId, "user", content.trim());
      const messages2 = await chatStorage.getMessagesByConversation(conversationId);
      const chatMessages = messages2.map((m) => ({
        role: m.role,
        content: m.content
      }));
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      const stream = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: chatMessages,
        stream: true,
        max_completion_tokens: 8192
      });
      let fullResponse = "";
      for await (const chunk of stream) {
        const content2 = chunk.choices[0]?.delta?.content || "";
        if (content2) {
          fullResponse += content2;
          res.write(`data: ${JSON.stringify({ content: content2 })}

`);
        }
      }
      await chatStorage.createMessage(conversationId, "assistant", fullResponse);
      res.write(`data: ${JSON.stringify({ done: true })}

`);
      res.end();
    } catch (error) {
      console.error("Error sending message:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to send message" })}

`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to send message" });
      }
    }
  });
}

// server/integrations/image/client.ts
import OpenAI2, { toFile } from "openai";
var openai2 = new OpenAI2({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "sk-placeholder",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
});

// server/integrations/image/routes.ts
function registerImageRoutes(app) {
  app.post("/api/generate-image", isAuthenticated, async (req, res) => {
    try {
      const { prompt, size = "1024x1024" } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }
      const response = await openai2.images.generate({
        model: "gpt-image-1",
        prompt,
        n: 1,
        size
      });
      if (!response.data?.length) {
        return res.status(502).json({ error: "Image service returned no data" });
      }
      const imageData = response.data[0];
      res.json({
        url: imageData.url,
        b64_json: imageData.b64_json
      });
    } catch (error) {
      console.error("Error generating image:", error);
      res.status(500).json({ error: "Failed to generate image" });
    }
  });
}

// server/seed.ts
async function seedDatabase() {
  const existingProperties = await storage.getProperties();
  if (existingProperties.length > 0) return;
  console.log("Seeding database...");
  const manager = await authStorage.upsertUser({
    id: "user_manager_1",
    email: "manager@propman.ai",
    role: "manager",
    firstName: "John",
    lastName: "Manager",
    profileImageUrl: "https://placehold.co/100x100"
  });
  const tenant1 = await authStorage.upsertUser({
    id: "user_tenant_1",
    email: "tenant1@propman.ai",
    role: "tenant",
    firstName: "Alice",
    lastName: "Tenant",
    profileImageUrl: "https://placehold.co/100x100"
  });
  const prop1 = await storage.createProperty({
    managerId: manager.id,
    address: "123 Main St",
    city: "San Francisco",
    state: "CA",
    zipCode: "94105",
    price: "3500.00",
    bedrooms: 2,
    bathrooms: "2.0",
    sqft: 1200,
    description: "Modern downtown apartment with city views.",
    status: "rented",
    imageUrl: "https://placehold.co/600x400"
  });
  const prop2 = await storage.createProperty({
    managerId: manager.id,
    address: "456 Oak Ave",
    city: "Oakland",
    state: "CA",
    zipCode: "94612",
    price: "2800.00",
    bedrooms: 3,
    bathrooms: "2.5",
    sqft: 1500,
    description: "Spacious family home with backyard.",
    status: "available",
    imageUrl: "https://placehold.co/600x400"
  });
  const lease1 = await storage.createLease({
    propertyId: prop1.id,
    tenantId: tenant1.id,
    startDate: /* @__PURE__ */ new Date("2023-01-01"),
    endDate: /* @__PURE__ */ new Date("2024-01-01"),
    rentAmount: "3500.00",
    status: "active"
  });
  await storage.createMaintenanceRequest({
    propertyId: prop1.id,
    tenantId: tenant1.id,
    title: "Leaky Faucet",
    description: "The kitchen sink faucet is dripping constantly.",
    priority: "low",
    status: "open",
    aiAnalysis: "Priority: Low, Trade: Plumbing. Suggestion: Tighten packing nut or replace washer."
  });
  await storage.createMaintenanceRequest({
    propertyId: prop1.id,
    tenantId: tenant1.id,
    title: "AC Not Working",
    description: "The air conditioning unit is making a loud noise and not cooling.",
    priority: "high",
    status: "in_progress",
    aiAnalysis: "Priority: High, Trade: HVAC. Suggestion: Check capacitor and fan motor immediately."
  });
  await storage.createPayment({
    leaseId: lease1.id,
    amount: "3500.00",
    status: "paid",
    type: "rent"
  });
  await storage.createPayment({
    leaseId: lease1.id,
    amount: "3500.00",
    status: "paid",
    type: "rent"
  });
  await storage.createPayment({
    leaseId: lease1.id,
    amount: "3500.00",
    status: "pending",
    type: "rent"
  });
  console.log("Database seeded successfully.");
}

// server/routes.ts
import OpenAI3 from "openai";

// server/services/str-market.ts
import { gunzipSync } from "zlib";
var STR_SOURCE = "insideairbnb";
var INSIDE_AIRBNB_DATA_PAGE = "https://insideairbnb.com/get-the-data/";
var MAX_DATASETS = 80;
var MAX_ROWS_PER_DATASET = 60;
var SALE_PRICE_CAP_RATE = 0.08;
function titleizeSlug(value) {
  return value.split("-").filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}
function parseNumber(value) {
  if (!value) return null;
  const cleaned = value.replace(/[$,]/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}
function parseBoolean(value) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "t" || normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "f" || normalized === "false" || normalized === "0" || normalized === "no") return false;
  return null;
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}
function parseCsv(text3) {
  const rows = text3.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (rows.length < 2) return [];
  const headers = parseCsvLine(rows[0]).map((header) => header.trim());
  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const values = parseCsvLine(rows[i]);
    if (values.length === 0) continue;
    const record = {};
    headers.forEach((header, idx) => {
      record[header] = values[idx] ?? "";
    });
    records.push(record);
  }
  return records;
}
function extractDatasetsFromInsideAirbnbPage(html) {
  const linkMatches = html.match(/https?:\/\/[^"'\\\s>]+listings\.csv\.gz/gi) ?? [];
  const uniqueLinks = Array.from(new Set(linkMatches));
  const datasetCandidates = uniqueLinks.filter((link) => link.includes("/united-states/")).map((url) => {
    const normalized = url.toLowerCase();
    const prefix = "https://data.insideairbnb.com/";
    const path4 = normalized.startsWith(prefix) ? normalized.slice(prefix.length) : "";
    const parts = path4.split("/").filter(Boolean);
    const sourceCountry = parts[0] ?? "united-states";
    const sourceRegion = parts[1] ?? "";
    const sourceCity = parts[2] ?? "unknown-city";
    const sourceSnapshotDate = parts[3];
    return {
      url,
      sourceCountry,
      sourceRegion,
      sourceCity,
      sourceSnapshotDate
    };
  }).filter((dataset) => dataset.sourceCity !== "unknown-city");
  const latestByCity = /* @__PURE__ */ new Map();
  for (const dataset of datasetCandidates) {
    const key = `${dataset.sourceRegion}::${dataset.sourceCity}`;
    const existing = latestByCity.get(key);
    if (!existing) {
      latestByCity.set(key, dataset);
      continue;
    }
    const existingDate = existing.sourceSnapshotDate ?? "";
    const nextDate = dataset.sourceSnapshotDate ?? "";
    if (nextDate > existingDate) {
      latestByCity.set(key, dataset);
    }
  }
  const byRegion = /* @__PURE__ */ new Map();
  for (const dataset of Array.from(latestByCity.values())) {
    const key = dataset.sourceRegion || "unknown";
    byRegion.set(key, [...byRegion.get(key) ?? [], dataset]);
  }
  const selected = [];
  for (const [, regionDatasets] of Array.from(byRegion.entries())) {
    if (regionDatasets.length > 0) {
      selected.push(regionDatasets[0]);
    }
    if (selected.length >= MAX_DATASETS) break;
  }
  if (selected.length < MAX_DATASETS) {
    for (const [, regionDatasets] of Array.from(byRegion.entries())) {
      for (let i = 1; i < regionDatasets.length; i++) {
        selected.push(regionDatasets[i]);
        if (selected.length >= MAX_DATASETS) break;
      }
      if (selected.length >= MAX_DATASETS) break;
    }
  }
  return selected;
}
async function fetchDatasets() {
  const response = await fetch(INSIDE_AIRBNB_DATA_PAGE);
  if (!response.ok) {
    throw new Error(`Failed to fetch Inside Airbnb data page: ${response.status}`);
  }
  const html = await response.text();
  return extractDatasetsFromInsideAirbnbPage(html);
}
function toStrListing(dataset, row) {
  const externalId = row.id?.trim();
  const nightlyRate = parseNumber(row.price);
  const availability365 = parseNumber(row.availability_365);
  const latitude = parseNumber(row.latitude);
  const longitude = parseNumber(row.longitude);
  const accommodates = parseNumber(row.accommodates);
  const bedrooms = parseNumber(row.bedrooms);
  const bathrooms = parseNumber(row.bathrooms);
  const minimumNights = parseNumber(row.minimum_nights);
  const numberOfReviews = parseNumber(row.number_of_reviews);
  const reviewScoreRating = parseNumber(row.review_scores_rating);
  const hostIsSuperhost = parseBoolean(row.host_is_superhost);
  if (!externalId || nightlyRate === null || nightlyRate <= 0) return null;
  const occupancyRate = availability365 === null ? 0.62 : clamp((365 - availability365) / 365, 0.2, 0.95);
  const annualReturn = nightlyRate * 365 * occupancyRate * 0.72;
  const monthlyReturn = annualReturn / 12;
  const estimatedSalePrice = annualReturn / SALE_PRICE_CAP_RATE;
  const pictureUrl = row.picture_url?.trim() || row.xl_picture_url?.trim() || row.medium_url?.trim() || null;
  return {
    source: STR_SOURCE,
    sourceCountry: dataset.sourceCountry,
    sourceRegion: dataset.sourceRegion,
    sourceCity: titleizeSlug(dataset.sourceCity),
    sourceSnapshotDate: dataset.sourceSnapshotDate,
    sourceUrl: dataset.url,
    externalListingId: externalId,
    listingUrl: row.listing_url?.trim() || null,
    pictureUrl,
    title: row.name?.trim() || null,
    propertyType: row.property_type?.trim() || null,
    roomType: row.room_type?.trim() || null,
    neighbourhood: row.neighbourhood_cleansed?.trim() || row.neighbourhood?.trim() || null,
    latitude: latitude !== null ? latitude.toFixed(6) : null,
    longitude: longitude !== null ? longitude.toFixed(6) : null,
    accommodates: accommodates !== null ? Math.round(accommodates) : null,
    bedrooms: bedrooms !== null ? bedrooms.toFixed(1) : null,
    bathrooms: bathrooms !== null ? bathrooms.toFixed(1) : null,
    minimumNights: minimumNights !== null ? Math.round(minimumNights) : null,
    numberOfReviews: numberOfReviews !== null ? Math.round(numberOfReviews) : null,
    reviewScoreRating: reviewScoreRating !== null ? reviewScoreRating.toFixed(2) : null,
    hostIsSuperhost,
    nightlyRate: nightlyRate.toFixed(2),
    availability365: availability365 !== null ? Math.round(availability365) : null,
    expectedOccupancyRate: (occupancyRate * 100).toFixed(2),
    expectedMonthlyReturn: monthlyReturn.toFixed(2),
    expectedAnnualReturn: annualReturn.toFixed(2),
    estimatedSalePrice: estimatedSalePrice.toFixed(2),
    valuationMethod: "cap-rate-8pct",
    currency: "USD",
    lastScrapedAt: /* @__PURE__ */ new Date()
  };
}
async function scrapePublicStrListings() {
  const datasets = await fetchDatasets();
  const listings = [];
  for (const dataset of datasets) {
    const response = await fetch(dataset.url);
    if (!response.ok) continue;
    const compressedBuffer = Buffer.from(await response.arrayBuffer());
    const csvText = gunzipSync(compressedBuffer).toString("utf-8");
    const rows = parseCsv(csvText).slice(0, MAX_ROWS_PER_DATASET);
    for (const row of rows) {
      const listing = toStrListing(dataset, row);
      if (!listing) continue;
      listings.push(listing);
    }
  }
  return listings;
}

// server/services/multifamily-sale.ts
var RENTCAST_BASE_URL = process.env.RENTCAST_BASE_URL || "https://api.rentcast.io/v1";
var MULTIFAMILY_KEYWORDS = [
  "multi family",
  "multifamily",
  "duplex",
  "triplex",
  "fourplex",
  "quadplex",
  "apartment",
  "apartments"
];
function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}
function asString(value) {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}
function asNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.replace(/[$,]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}
function firstString(record, ...keys) {
  for (const key of keys) {
    const next = asString(record[key]);
    if (next) return next;
  }
  return null;
}
function firstNumber(record, ...keys) {
  for (const key of keys) {
    const next = asNumber(record[key]);
    if (next !== null) return next;
  }
  return null;
}
function isMultifamily(record) {
  const propertyType = firstString(record, "propertyType", "type", "subType") ?? "";
  const listingType = firstString(record, "listingType", "description", "title") ?? "";
  const haystack = `${propertyType} ${listingType}`.toLowerCase();
  if (MULTIFAMILY_KEYWORDS.some((keyword) => haystack.includes(keyword))) return true;
  const units = firstNumber(record, "units", "unitCount", "numberOfUnits");
  if (units !== null && units >= 2) return true;
  return false;
}
function toDbListing(raw) {
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
    squareFootage: firstNumber(raw, "squareFootage", "livingArea", "sqft") !== null ? Math.round(firstNumber(raw, "squareFootage", "livingArea", "sqft")) : null,
    lotSize: firstNumber(raw, "lotSize", "lotSizeSqft") !== null ? Math.round(firstNumber(raw, "lotSize", "lotSizeSqft")) : null,
    yearBuilt: firstNumber(raw, "yearBuilt") !== null ? Math.round(firstNumber(raw, "yearBuilt")) : null,
    status: firstString(raw, "status", "listingStatus"),
    price: price.toFixed(2),
    listingType: firstString(raw, "listingType"),
    listedDate: firstString(raw, "listedDate", "listingDate"),
    removedDate: firstString(raw, "removedDate"),
    createdDate: firstString(raw, "createdDate"),
    lastSeenDate: firstString(raw, "lastSeenDate", "lastSeen"),
    daysOnMarket: firstNumber(raw, "daysOnMarket") !== null ? Math.round(firstNumber(raw, "daysOnMarket")) : null,
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
    lastSyncedAt: /* @__PURE__ */ new Date()
  };
}
async function fetchMultifamilySaleListings(filters) {
  const apiKey = process.env.RENTCAST_API_KEY;
  if (!apiKey) {
    throw new Error("RENTCAST_API_KEY is not configured");
  }
  const params = new URLSearchParams();
  if (filters.city) params.set("city", filters.city);
  if (filters.region) params.set("state", filters.region);
  params.set("status", "Active");
  params.set("limit", String(Math.min(Math.max(filters.limit ?? 250, 1), 500)));
  const url = `${RENTCAST_BASE_URL.replace(/\/+$/, "")}/listings/sale?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Api-Key": apiKey
    }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const payload = asRecord(body);
    const message = asString(payload?.message) || asString(payload?.error) || `RentCast request failed (${response.status})`;
    throw new Error(message);
  }
  const rows = Array.isArray(body) ? body : [];
  const filtered = rows.map(asRecord).filter((item) => !!item).filter(isMultifamily).map(toDbListing).filter((item) => !!item);
  return filtered;
}

// server/routes.ts
import { randomBytes as randomBytes3 } from "node:crypto";
var openai3 = new OpenAI3({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "sk-placeholder",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
});
function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
function toCsvCell(value) {
  return `"${value.replaceAll('"', '""')}"`;
}
function toMoney(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return "0.00";
  return numeric.toFixed(2);
}
function asRecord2(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return void 0;
  return value;
}
function firstDefinedString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return void 0;
}
function normalizeZillowLeadPayload(payload) {
  const applicant = asRecord2(payload.applicant) ?? asRecord2(payload.renter) ?? asRecord2(payload.contact) ?? {};
  const listing = asRecord2(payload.listing) ?? {};
  const property = asRecord2(payload.property) ?? {};
  const manager = asRecord2(payload.manager) ?? asRecord2(payload.landlord) ?? {};
  const externalLeadId = firstDefinedString(
    payload.externalLeadId,
    payload.leadId,
    payload.lead_id,
    payload.id,
    applicant.externalLeadId,
    applicant.leadId
  );
  const applicantName = firstDefinedString(
    payload.fullName,
    payload.name,
    [payload.firstName, payload.lastName].filter(Boolean).join(" ").trim(),
    applicant.fullName,
    applicant.name,
    [applicant.firstName, applicant.lastName].filter(Boolean).join(" ").trim()
  );
  return {
    externalLeadId,
    listingExternalId: firstDefinedString(
      payload.listingExternalId,
      payload.listingId,
      payload.listing_id,
      listing.externalId,
      listing.id
    ),
    propertyExternalId: firstDefinedString(
      payload.propertyExternalId,
      payload.propertyId,
      payload.property_id,
      property.externalId,
      property.id
    ),
    managerId: firstDefinedString(payload.managerId, payload.manager_id, manager.id),
    managerEmail: firstDefinedString(payload.managerEmail, payload.manager_email, manager.email)?.toLowerCase(),
    applicantName,
    applicantEmail: firstDefinedString(payload.email, applicant.email),
    applicantPhone: firstDefinedString(payload.phone, applicant.phone, applicant.phoneNumber),
    message: firstDefinedString(payload.message, payload.notes, applicant.message),
    moveInDate: firstDefinedString(payload.moveInDate, payload.move_in_date, applicant.moveInDate),
    rawPayload: payload
  };
}
function getPublicAppBaseUrl() {
  const fromEnv = process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:5001");
  try {
    const parsed = new URL(fromEnv.includes("://") ? fromEnv : `https://${fromEnv}`);
    return parsed.origin;
  } catch {
    return "http://localhost:5001";
  }
}
var STEP_UP_TTL_MS = 10 * 60 * 1e3;
var DAILY_SCAN_INTERVAL_MS = 24 * 60 * 60 * 1e3;
var RENT_OVERDUE_SCAN_INTERVAL_MS = DAILY_SCAN_INTERVAL_MS;
var DEFAULT_RENT_OVERDUE_NOTIFICATION_DAYS = 5;
var LEASE_EXPIRY_SCAN_INTERVAL_MS = DAILY_SCAN_INTERVAL_MS;
var DEFAULT_LEASE_EXPIRY_NOTIFICATION_DAYS = 30;
var MAINTENANCE_ESCALATION_SCAN_INTERVAL_MS = DAILY_SCAN_INTERVAL_MS;
var DEFAULT_MAINTENANCE_AUTOMATION_SETTINGS = {
  autoTriageEnabled: true,
  autoEscalationEnabled: true,
  autoVendorAssignmentEnabled: true
};
function isMissingRelationError(error) {
  const code = error?.code;
  return code === "42P01";
}
var MAINTENANCE_TRIAGE_RULES = [
  {
    category: "security",
    priority: "emergency",
    keywords: ["fire", "smoke", "gas leak", "carbon monoxide", "break in", "intruder", "burst pipe", "flood"]
  },
  {
    category: "electrical",
    priority: "high",
    keywords: ["power outage", "no power", "sparking", "burning smell", "breaker", "outlet", "short circuit"]
  },
  {
    category: "hvac",
    priority: "high",
    keywords: ["no heat", "heater", "furnace", "ac not working", "air conditioning", "hvac", "thermostat"]
  },
  {
    category: "plumbing",
    priority: "high",
    keywords: ["leak", "water", "toilet", "drain", "sewer", "clog", "pipe", "sink", "shower"]
  },
  {
    category: "pest",
    priority: "medium",
    keywords: ["pest", "roach", "rodent", "mouse", "rat", "bed bug", "termite"]
  },
  {
    category: "appliance",
    priority: "medium",
    keywords: ["refrigerator", "fridge", "oven", "stove", "dishwasher", "washer", "dryer", "microwave"]
  }
];
var AUTO_ASSIGN_VENDOR_POOL = [
  { name: "RapidFix Plumbing", categories: ["plumbing"], states: ["GA", "CA", "TX"], onCall: true },
  { name: "GridLine Electric", categories: ["electrical"], states: ["GA", "CA", "TX"], onCall: true },
  { name: "Comfort HVAC Services", categories: ["hvac"], states: ["GA", "CA", "TX"], onCall: true },
  { name: "Home Appliance Response", categories: ["appliance"], states: ["GA", "CA", "TX"] },
  { name: "PestShield Control", categories: ["pest"], states: ["GA", "CA", "TX"] },
  { name: "SafeAccess Property Support", categories: ["security", "general"], onCall: true }
];
function getSlaHoursForPriority(priority) {
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
function triageMaintenanceRequest(title, description) {
  const text3 = `${title} ${description}`.toLowerCase();
  const matched = MAINTENANCE_TRIAGE_RULES.find(
    (rule) => rule.keywords.some((keyword) => text3.includes(keyword))
  );
  const category = matched?.category ?? "general";
  const priority = matched?.priority ?? "medium";
  const slaHours = getSlaHoursForPriority(priority);
  return {
    category,
    priority,
    slaHours,
    summary: `Auto-triaged as ${priority} priority (${category}). SLA target: ${slaHours}h.`
  };
}
function autoAssignVendor(params) {
  const propertyState = (params.propertyState || "").toUpperCase();
  const categoryMatches = AUTO_ASSIGN_VENDOR_POOL.filter(
    (vendor) => vendor.categories.includes(params.category)
  );
  const stateMatch = categoryMatches.find(
    (vendor) => vendor.states && propertyState && vendor.states.includes(propertyState)
  );
  const onCallMatch = categoryMatches.find((vendor) => vendor.onCall);
  const chosen = stateMatch ?? onCallMatch ?? categoryMatches[0] ?? AUTO_ASSIGN_VENDOR_POOL[0];
  const note = stateMatch ? "Auto-assigned by trade and property state." : onCallMatch ? "Auto-assigned to on-call vendor by trade." : "Auto-assigned to default vendor queue.";
  return { vendorName: chosen.name, note };
}
function getEscalatedPriority(priority) {
  if (priority === "low") return "medium";
  if (priority === "medium") return "high";
  return "emergency";
}
var leaseSigningCompleteSchema = z4.object({
  token: z4.string().min(20),
  fullName: z4.string().min(2).max(120)
});
var requireStepUpAuth = (req, res, next) => {
  const verifiedAt = Number(req.session?.stepUpVerifiedAt || 0);
  if (!verifiedAt || Date.now() - verifiedAt > STEP_UP_TTL_MS) {
    return res.status(403).json({ message: "Step-up authentication required. Call /api/auth/reauth first." });
  }
  return next();
};
function collectMissingListingFields(property) {
  const required = [
    { key: "address", valid: Boolean(property.address) },
    { key: "city", valid: Boolean(property.city) },
    { key: "state", valid: Boolean(property.state) },
    { key: "zipCode", valid: Boolean(property.zipCode) },
    { key: "price", valid: Number(property.price) > 0 },
    { key: "bedrooms", valid: Number(property.bedrooms) > 0 },
    { key: "bathrooms", valid: Number(property.bathrooms) > 0 },
    { key: "sqft", valid: Number(property.sqft) > 0 },
    { key: "description", valid: Boolean(property.description) }
  ];
  return required.filter((f) => !f.valid).map((f) => f.key);
}
function buildZillowListingXml(property, mapping) {
  const common = mapping?.common ?? {};
  const zillow = mapping?.zillow ?? {};
  const description = property.description || "Long-term rental listing";
  const title = common.title || `${property.bedrooms} BR Rental in ${property.city}`;
  const applicationUrlTag = zillow.applicationUrl ? `
    <ApplicationURL>${escapeXml(zillow.applicationUrl)}</ApplicationURL>` : "";
  const virtualTourTag = zillow.virtualTourUrl ? `
    <VirtualTourURL>${escapeXml(zillow.virtualTourUrl)}</VirtualTourURL>` : "";
  const availableDateTag = common.availableDate ? `
    <AvailableDate>${escapeXml(common.availableDate)}</AvailableDate>` : "";
  const leaseTermTag = common.leaseTermMonths ? `
    <LeaseTermMonths>${common.leaseTermMonths}</LeaseTermMonths>` : "";
  const contactNameTag = common.contactName ? `
    <ContactName>${escapeXml(common.contactName)}</ContactName>` : "";
  const contactEmailTag = common.contactEmail ? `
    <ContactEmail>${escapeXml(common.contactEmail)}</ContactEmail>` : "";
  const contactPhoneTag = common.contactPhone ? `
    <ContactPhone>${escapeXml(common.contactPhone)}</ContactPhone>` : "";
  const amenitiesTag = Array.isArray(common.amenities) && common.amenities.length > 0 ? `
    <Amenities>${escapeXml(common.amenities.join(", "))}</Amenities>` : "";
  const imageTag = property.imageUrl ? `
    <PhotoURL>${escapeXml(property.imageUrl)}</PhotoURL>` : "";
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
function buildApartmentsPayload(property, mapping) {
  const common = mapping?.common ?? {};
  const apartments = mapping?.apartments ?? {};
  const amenities = Array.isArray(common.amenities) ? common.amenities : [];
  const utilitiesIncluded = Array.isArray(apartments.utilitiesIncluded) ? apartments.utilitiesIncluded : [];
  const payload = {
    listingId: String(property.id),
    listingType: "LONG_TERM_RENTAL",
    title: common.title || `${property.bedrooms} BR Rental in ${property.city}`,
    availableDate: common.availableDate || void 0,
    leaseTermMonths: common.leaseTermMonths || void 0,
    address: {
      street: property.address,
      city: property.city,
      state: property.state,
      postalCode: property.zipCode,
      country: "US"
    },
    contact: {
      name: common.contactName || void 0,
      email: common.contactEmail || void 0,
      phone: common.contactPhone || void 0
    },
    communityName: apartments.communityName || void 0,
    unitNumber: apartments.unitNumber || void 0,
    amenities,
    pricing: {
      monthlyRent: Number(toMoney(property.price)),
      depositAmount: apartments.depositAmount ?? void 0,
      currency: "USD"
    },
    bedrooms: property.bedrooms,
    bathrooms: Number(property.bathrooms),
    squareFeet: property.sqft,
    description: property.description || "",
    petsAllowed: Boolean(common.petsAllowed),
    furnished: Boolean(common.furnished),
    parkingIncluded: Boolean(common.parkingIncluded),
    laundry: common.laundry || void 0,
    utilitiesIncluded,
    media: property.imageUrl ? [{ url: property.imageUrl, type: "PHOTO" }] : [],
    availabilityStatus: property.status === "available" ? "AVAILABLE" : "UNAVAILABLE"
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
    "availability_status"
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
    toCsvCell(apartments.depositAmount !== void 0 ? String(apartments.depositAmount) : ""),
    toCsvCell(utilitiesIncluded.join("|")),
    toCsvCell(common.contactName ?? ""),
    toCsvCell(common.contactEmail ?? ""),
    toCsvCell(common.contactPhone ?? ""),
    toCsvCell(property.imageUrl ?? ""),
    toCsvCell(property.status === "available" ? "AVAILABLE" : "UNAVAILABLE")
  ].join(",");
  return {
    json: JSON.stringify(payload, null, 2),
    csv: `${csvHeader}
${csvRow}`
  };
}
function getHostLabel(urlValue) {
  try {
    const url = new URL(urlValue);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return urlValue;
  }
}
async function publishPayload(params) {
  const headers = {
    "Content-Type": params.contentType
  };
  if (params.apiKey) {
    headers.Authorization = `Bearer ${params.apiKey}`;
  }
  const response = await fetch(params.url, {
    method: "POST",
    headers,
    body: params.payload
  });
  const responseText = await response.text().catch(() => "");
  return {
    success: response.ok,
    statusCode: response.status,
    responseBody: responseText.slice(0, 4e3),
    target: getHostLabel(params.url),
    publishedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function registerRoutes(httpServer, app) {
  const STR_MARKET_AUTO_REFRESH_MS = 60 * 60 * 1e3;
  const STR_MARKET_RETRY_BACKOFF_MS = 5 * 60 * 1e3;
  let strMarketAutoRefreshInFlight = null;
  let nextStrMarketAutoRefreshAllowedAt = 0;
  const latestScrapedAtMs = (listings) => {
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
  const normalizeOverdueDays = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_RENT_OVERDUE_NOTIFICATION_DAYS;
    return Math.min(60, Math.max(1, Math.floor(parsed)));
  };
  const normalizeLeaseExpiryDays = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_LEASE_EXPIRY_NOTIFICATION_DAYS;
    return Math.min(365, Math.max(1, Math.floor(parsed)));
  };
  const getManagerNotificationSettings = async (managerId) => {
    const existing = await storage.getManagerRentNotificationSettings(managerId);
    if (existing) {
      return {
        managerId: existing.managerId,
        enabled: existing.enabled,
        overdueDays: normalizeOverdueDays(existing.overdueDays),
        updatedAt: existing.updatedAt
      };
    }
    return {
      managerId,
      enabled: true,
      overdueDays: normalizeOverdueDays(process.env.RENT_OVERDUE_NOTIFICATION_DEFAULT_DAYS),
      updatedAt: null
    };
  };
  const getManagerLeaseExpirySettings = async (managerId) => {
    const existing = await storage.getManagerLeaseExpiryNotificationSettings(managerId);
    if (existing) {
      return {
        managerId: existing.managerId,
        enabled: existing.enabled,
        daysBeforeExpiry: normalizeLeaseExpiryDays(existing.daysBeforeExpiry),
        updatedAt: existing.updatedAt
      };
    }
    return {
      managerId,
      enabled: true,
      daysBeforeExpiry: normalizeLeaseExpiryDays(process.env.LEASE_EXPIRY_NOTIFICATION_DEFAULT_DAYS),
      updatedAt: null
    };
  };
  const getManagerMaintenanceAutomationSettings = async (managerId) => {
    const existing = await storage.getManagerMaintenanceAutomationSettings(managerId);
    if (existing) {
      return {
        managerId: existing.managerId,
        autoTriageEnabled: existing.autoTriageEnabled,
        autoEscalationEnabled: existing.autoEscalationEnabled,
        autoVendorAssignmentEnabled: existing.autoVendorAssignmentEnabled,
        updatedAt: existing.updatedAt
      };
    }
    return {
      managerId,
      autoTriageEnabled: DEFAULT_MAINTENANCE_AUTOMATION_SETTINGS.autoTriageEnabled,
      autoEscalationEnabled: DEFAULT_MAINTENANCE_AUTOMATION_SETTINGS.autoEscalationEnabled,
      autoVendorAssignmentEnabled: DEFAULT_MAINTENANCE_AUTOMATION_SETTINGS.autoVendorAssignmentEnabled,
      updatedAt: null
    };
  };
  const getOverdueRentCandidatesForManager = async (managerId, thresholdDays, now) => {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const daysSinceMonthStart = Math.floor((now.getTime() - startOfMonth.getTime()) / (1e3 * 60 * 60 * 24));
    if (daysSinceMonthStart < thresholdDays) return [];
    const managerLeases = (await storage.getLeasesByManager(managerId)).filter((lease) => lease.status === "active");
    if (managerLeases.length === 0) return [];
    const managerProperties = await storage.getPropertiesByManager(managerId);
    const propertyAddressById = /* @__PURE__ */ new Map();
    managerProperties.forEach((property) => {
      propertyAddressById.set(property.id, `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`.trim());
    });
    const tenantIds = Array.from(new Set(managerLeases.map((lease) => lease.tenantId)));
    const tenantNameById = /* @__PURE__ */ new Map();
    for (const tenantId of tenantIds) {
      const tenant = await storage.getUser(tenantId);
      const displayName = [tenant?.firstName, tenant?.lastName].filter(Boolean).join(" ").trim();
      tenantNameById.set(tenantId, displayName || tenant?.email || tenantId);
    }
    const allPayments = await storage.getPayments();
    const candidates = [];
    for (const lease of managerLeases) {
      const monthPaid = allPayments.filter((payment) => {
        if (payment.leaseId !== lease.id) return false;
        if (payment.status !== "paid" || payment.type !== "rent") return false;
        const paymentDate = new Date(payment.date ?? /* @__PURE__ */ new Date());
        return paymentDate.getMonth() === now.getMonth() && paymentDate.getFullYear() === now.getFullYear();
      }).reduce((sum, payment) => sum + Number(payment.amount), 0);
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
        monthKey
      });
    }
    return candidates;
  };
  const sendRentOverdueNotifications = async (forcedManagerId) => {
    const now = /* @__PURE__ */ new Date();
    const managerIds = forcedManagerId ? [forcedManagerId] : Array.from(new Set((await storage.getProperties()).map((property) => property.managerId)));
    for (const managerId of managerIds) {
      try {
        const manager = await storage.getUser(managerId);
        if (!manager?.email) continue;
        const settings = await getManagerNotificationSettings(managerId);
        if (!settings.enabled) continue;
        const overdueDays = normalizeOverdueDays(settings.overdueDays);
        const candidates = await getOverdueRentCandidatesForManager(managerId, overdueDays, now);
        if (candidates.length === 0) continue;
        const lines = candidates.map((item) => `Lease #${item.leaseId} (${item.propertyAddress}) - Tenant: ${item.tenantName} - Outstanding: $${item.balance.toFixed(2)}`).join("<br/>");
        const subject = `Overdue rent alert: ${candidates.length} lease${candidates.length === 1 ? "" : "s"} pending`;
        const delivery = await sendAuthEmail({
          to: manager.email,
          subject,
          html: `<p>Rent is still unpaid for at least ${overdueDays} day(s) this month.</p><p>${lines}</p><p>Open Accounting in PropMan to review and follow up.</p>`,
          text: `Rent is still unpaid for at least ${overdueDays} day(s) this month.
${candidates.map((item) => `Lease #${item.leaseId} - ${item.propertyAddress} - ${item.tenantName} - Outstanding $${item.balance.toFixed(2)}`).join("\n")}
Open Accounting in PropMan to review.`
        });
        for (const item of candidates) {
          await storage.markRentOverdueNotificationSent(managerId, item.leaseId, item.monthKey, overdueDays);
        }
        console.log(
          `[accounting] overdue rent alert queued for manager ${manager.email} (${candidates.length} lease(s)) via ${delivery.provider}${delivery.id ? ` (${delivery.id})` : ""}`
        );
      } catch (error) {
        console.error(`Failed to send overdue rent notification for manager ${managerId}:`, error);
      }
    }
  };
  const getLeaseExpiryCandidatesForManager = async (managerId, thresholdDays, now) => {
    const managerLeases = (await storage.getLeasesByManager(managerId)).filter((lease) => lease.status === "active");
    if (managerLeases.length === 0) return [];
    const managerProperties = await storage.getPropertiesByManager(managerId);
    const propertyAddressById = /* @__PURE__ */ new Map();
    managerProperties.forEach((property) => {
      propertyAddressById.set(property.id, `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`.trim());
    });
    const tenantIds = Array.from(new Set(managerLeases.map((lease) => lease.tenantId)));
    const tenantNameById = /* @__PURE__ */ new Map();
    for (const tenantId of tenantIds) {
      const tenant = await storage.getUser(tenantId);
      const displayName = [tenant?.firstName, tenant?.lastName].filter(Boolean).join(" ").trim();
      tenantNameById.set(tenantId, displayName || tenant?.email || tenantId);
    }
    const candidates = [];
    for (const lease of managerLeases) {
      const endDate = new Date(lease.endDate);
      const leaseEndDateKey = endDate.toISOString().slice(0, 10);
      const daysUntilEnd = Math.ceil((endDate.getTime() - now.getTime()) / (1e3 * 60 * 60 * 24));
      if (daysUntilEnd < 0 || daysUntilEnd > thresholdDays) continue;
      const alreadySent = await storage.hasSentLeaseExpiryNotification(managerId, lease.id, leaseEndDateKey, thresholdDays);
      if (alreadySent) continue;
      candidates.push({
        leaseId: lease.id,
        leaseEndDateKey,
        propertyAddress: propertyAddressById.get(lease.propertyId) || `Property #${lease.propertyId}`,
        tenantName: tenantNameById.get(lease.tenantId) || lease.tenantId,
        daysUntilEnd
      });
    }
    return candidates;
  };
  const sendLeaseExpiryNotifications = async (forcedManagerId) => {
    const now = /* @__PURE__ */ new Date();
    const managerIds = forcedManagerId ? [forcedManagerId] : Array.from(new Set((await storage.getProperties()).map((property) => property.managerId)));
    for (const managerId of managerIds) {
      try {
        const manager = await storage.getUser(managerId);
        if (!manager?.email) continue;
        const settings = await getManagerLeaseExpirySettings(managerId);
        if (!settings.enabled) continue;
        const thresholdDays = normalizeLeaseExpiryDays(settings.daysBeforeExpiry);
        const candidates = await getLeaseExpiryCandidatesForManager(managerId, thresholdDays, now);
        if (candidates.length === 0) continue;
        const lines = candidates.map((item) => `Lease #${item.leaseId} (${item.propertyAddress}) - Tenant: ${item.tenantName} - Ends in ${item.daysUntilEnd} day(s)`).join("<br/>");
        const subject = `Lease expiry reminder: ${candidates.length} lease${candidates.length === 1 ? "" : "s"} ending soon`;
        const delivery = await sendAuthEmail({
          to: manager.email,
          subject,
          html: `<p>These leases are within ${thresholdDays} day(s) of expiry.</p><p>${lines}</p><p>Open Lease Management in PropMan to take action.</p>`,
          text: `These leases are within ${thresholdDays} day(s) of expiry.
${candidates.map((item) => `Lease #${item.leaseId} - ${item.propertyAddress} - ${item.tenantName} - Ends in ${item.daysUntilEnd} day(s)`).join("\n")}
Open Lease Management in PropMan to take action.`
        });
        for (const item of candidates) {
          await storage.markLeaseExpiryNotificationSent(managerId, item.leaseId, item.leaseEndDateKey, thresholdDays);
        }
        console.log(
          `[leases] expiry reminder queued for manager ${manager.email} (${candidates.length} lease(s)) via ${delivery.provider}${delivery.id ? ` (${delivery.id})` : ""}`
        );
      } catch (error) {
        console.error(`Failed to send lease expiry notification for manager ${managerId}:`, error);
      }
    }
  };
  let rentOverdueScanInFlight = null;
  let rentOverdueSchemaReady = true;
  const triggerRentOverdueScan = (forcedManagerId) => {
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
  }, 1e4);
  let leaseExpiryScanInFlight = null;
  let leaseExpirySchemaReady = true;
  const triggerLeaseExpiryScan = (forcedManagerId) => {
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
  }, 15e3);
  const triggerMaintenanceEscalationScan = async (forcedManagerId) => {
    try {
      const now = /* @__PURE__ */ new Date();
      const requests = await storage.getMaintenanceRequests();
      const openRequests = requests.filter(
        (request) => (request.status === "open" || request.status === "in_progress") && request.slaDueAt && new Date(request.slaDueAt).getTime() <= now.getTime() && !request.escalatedAt
      );
      const escalatedByManager = /* @__PURE__ */ new Map();
      for (const request of openRequests) {
        const property = await storage.getProperty(request.propertyId);
        if (!property) continue;
        if (forcedManagerId && property.managerId !== forcedManagerId) continue;
        const managerSettings = await getManagerMaintenanceAutomationSettings(property.managerId);
        if (!managerSettings.autoEscalationEnabled) continue;
        const nextPriority = getEscalatedPriority(request.priority);
        const slaDueAt = request.slaDueAt ?? now;
        const escalationSummary = `SLA breached on ${new Date(slaDueAt).toLocaleString()}. Priority escalated to ${nextPriority}.`;
        const mergedAnalysis = request.aiAnalysis ? `${request.aiAnalysis}
Automation: ${escalationSummary}` : `Automation: ${escalationSummary}`;
        await storage.updateMaintenanceRequest(request.id, {
          priority: nextPriority,
          escalatedAt: now,
          aiAnalysis: mergedAnalysis
        });
        const managerItems = escalatedByManager.get(property.managerId) ?? [];
        managerItems.push({
          id: request.id,
          propertyAddress: property.address,
          priority: nextPriority
        });
        escalatedByManager.set(property.managerId, managerItems);
      }
      for (const [managerId, items] of Array.from(escalatedByManager.entries())) {
        try {
          const manager = await storage.getUser(managerId);
          if (!manager?.email) continue;
          const subject = `Maintenance SLA Escalations: ${items.length} request${items.length === 1 ? "" : "s"}`;
          const htmlLines = items.map((item) => `Request #${item.id} (${item.propertyAddress}) escalated to ${item.priority}.`).join("<br/>");
          await sendAuthEmail({
            to: manager.email,
            subject,
            html: `<p>The following maintenance requests breached SLA and were escalated automatically:</p><p>${htmlLines}</p>`,
            text: `The following maintenance requests breached SLA and were escalated automatically:
${items.map((item) => `Request #${item.id} (${item.propertyAddress}) escalated to ${item.priority}.`).join("\n")}`
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
      console.error("Maintenance escalation scan failed:", error);
    }
  };
  const maintenanceEscalationInterval = setInterval(() => {
    void triggerMaintenanceEscalationScan();
  }, MAINTENANCE_ESCALATION_SCAN_INTERVAL_MS);
  httpServer.on("close", () => clearInterval(maintenanceEscalationInterval));
  setTimeout(() => {
    void triggerMaintenanceEscalationScan();
  }, 2e4);
  const getManagerScopedData = async (managerId) => {
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
  const canUserAccessProperty = async (userId, propertyId) => {
    const user = await storage.getUser(userId);
    if (!user) return false;
    const property = await storage.getProperty(propertyId);
    if (!property) return false;
    if (user.role === "manager") return property.managerId === userId;
    if (user.role === "tenant") {
      const leases3 = await storage.getLeasesByTenant(userId);
      return leases3.some((lease) => lease.propertyId === propertyId);
    }
    return false;
  };
  seedDatabase().catch(console.error);
  await setupAuth(app);
  registerAuthRoutes(app);
  registerChatRoutes(app);
  registerImageRoutes(app);
  app.get(api.properties.list.path, isAuthenticated, async (req, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const dbUser = await storage.getUser(userId);
    const input = api.properties.list.input.parse(req.query ?? {});
    let allProperties = [];
    if (dbUser?.role === "manager") {
      allProperties = await storage.getPropertiesByManager(userId);
    } else if (dbUser?.role === "tenant") {
      const tenantLeases = await storage.getLeasesByTenant(userId);
      const propertyIds = new Set(tenantLeases.map((lease) => lease.propertyId));
      const all = await storage.getProperties();
      allProperties = all.filter((property) => propertyIds.has(property.id));
    }
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
        property.description ?? ""
      ].join(" ").toLowerCase();
      return haystack.includes(search);
    });
    res.json(filtered);
  });
  app.get(api.properties.get.path, isAuthenticated, async (req, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const propertyId = Number(req.params.id);
    const allowed = await canUserAccessProperty(userId, propertyId);
    if (!allowed) return res.status(403).json({ message: "Forbidden" });
    const property = await storage.getProperty(propertyId);
    if (!property) return res.status(404).json({ message: "Property not found" });
    res.json(property);
  });
  app.post(api.properties.create.path, isAuthenticated, async (req, res) => {
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
        managerId: userId
      });
      res.status(201).json(property);
    } catch (err) {
      if (err instanceof z4.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });
  app.put(api.properties.update.path, isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const propertyId = Number(req.params.id);
      const property = await storage.getProperty(propertyId);
      if (!property) return res.status(404).json({ message: "Property not found" });
      if (property.managerId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const input = api.properties.update.input.parse(req.body);
      const updated = await storage.updateProperty(propertyId, input);
      if (!updated) return res.status(404).json({ message: "Property not found" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z4.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });
  app.delete(api.properties.delete.path, isAuthenticated, async (req, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const propertyId = Number(req.params.id);
    const property = await storage.getProperty(propertyId);
    if (!property) return res.status(404).json({ message: "Property not found" });
    if (property.managerId !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.deleteProperty(propertyId);
    res.status(204).send();
  });
  app.get(api.listingExports.templatesList.path, isAuthenticated, async (req, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const dbUser = await storage.getUser(userId);
    if (dbUser?.role !== "manager") {
      return res.status(403).json({ message: "Only managers can manage listing templates" });
    }
    const templates = await storage.getListingMappingTemplatesByManager(userId);
    res.json(templates);
  });
  app.post(api.listingExports.templatesCreate.path, isAuthenticated, requireStepUpAuth, async (req, res) => {
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
      mapping: input.mapping
    });
    res.status(201).json(template);
  });
  app.delete(api.listingExports.templatesDelete.path, isAuthenticated, requireStepUpAuth, async (req, res) => {
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
  app.get(api.listingExports.availableProperties.path, isAuthenticated, async (req, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const dbUser = await storage.getUser(userId);
    if (dbUser?.role !== "manager") {
      return res.status(403).json({ message: "Only managers can export listings" });
    }
    const input = api.listingExports.availableProperties.input.parse(req.query ?? {});
    const managerProperties = await storage.getPropertiesByManager(userId);
    let availableProperties = managerProperties.filter((property) => property.status === "available");
    if (availableProperties.length === 0) {
      const allProperties = await storage.getProperties();
      availableProperties = allProperties.filter((property) => property.status === "available");
    }
    if (!input?.search?.trim()) {
      return res.json(availableProperties);
    }
    const search = input.search.trim().toLowerCase();
    const filtered = availableProperties.filter(
      (property) => `${property.address} ${property.city} ${property.state} ${property.zipCode} ${property.description ?? ""}`.toLowerCase().includes(search)
    );
    res.json(filtered);
  });
  app.post(api.listingExports.zillow.path, isAuthenticated, async (req, res) => {
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
      missingFields
    });
  });
  app.post(api.listingExports.apartments.path, isAuthenticated, async (req, res) => {
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
      missingFields
    });
  });
  app.post(api.listingExports.publishZillow.path, isAuthenticated, requireStepUpAuth, async (req, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const dbUser = await storage.getUser(userId);
    if (dbUser?.role !== "manager") {
      return res.status(403).json({ message: "Only managers can publish listings" });
    }
    const publishUrl = process.env.LISTING_PUBLISH_ZILLOW_URL;
    if (!publishUrl) {
      return res.status(400).json({
        message: "LISTING_PUBLISH_ZILLOW_URL is not configured"
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
      apiKey: process.env.LISTING_PUBLISH_ZILLOW_API_KEY
    });
    res.json({
      platform: "zillow",
      propertyId: property.id,
      ...result
    });
  });
  app.post(api.listingExports.publishApartments.path, isAuthenticated, requireStepUpAuth, async (req, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const dbUser = await storage.getUser(userId);
    if (dbUser?.role !== "manager") {
      return res.status(403).json({ message: "Only managers can publish listings" });
    }
    const publishUrl = process.env.LISTING_PUBLISH_APARTMENTS_URL;
    if (!publishUrl) {
      return res.status(400).json({
        message: "LISTING_PUBLISH_APARTMENTS_URL is not configured"
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
      apiKey: process.env.LISTING_PUBLISH_APARTMENTS_API_KEY
    });
    res.json({
      platform: "apartments.com",
      propertyId: property.id,
      format,
      ...result
    });
  });
  app.get(api.strMarket.get.path, isAuthenticated, async (req, res) => {
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
  app.get(api.strMarket.list.path, isAuthenticated, async (req, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const dbUser = await storage.getUser(userId);
    if (dbUser?.role !== "investor" && dbUser?.role !== "manager") {
      return res.status(403).json({ message: "Only investors and managers can view STR market data" });
    }
    const input = api.strMarket.list.input?.parse(req.query ?? {});
    let listings = await ensureStrMarketListingsAreFresh();
    const US_STATE_CODES_TO_NAMES = {
      al: "alabama",
      ak: "alaska",
      az: "arizona",
      ar: "arkansas",
      ca: "california",
      co: "colorado",
      ct: "connecticut",
      de: "delaware",
      fl: "florida",
      ga: "georgia",
      hi: "hawaii",
      id: "idaho",
      il: "illinois",
      in: "indiana",
      ia: "iowa",
      ks: "kansas",
      ky: "kentucky",
      la: "louisiana",
      me: "maine",
      md: "maryland",
      ma: "massachusetts",
      mi: "michigan",
      mn: "minnesota",
      ms: "mississippi",
      mo: "missouri",
      mt: "montana",
      ne: "nebraska",
      nv: "nevada",
      nh: "new hampshire",
      nj: "new jersey",
      nm: "new mexico",
      ny: "new york",
      nc: "north carolina",
      nd: "north dakota",
      oh: "ohio",
      ok: "oklahoma",
      or: "oregon",
      pa: "pennsylvania",
      ri: "rhode island",
      sc: "south carolina",
      sd: "south dakota",
      tn: "tennessee",
      tx: "texas",
      ut: "utah",
      vt: "vermont",
      va: "virginia",
      wa: "washington",
      wv: "west virginia",
      wi: "wisconsin",
      wy: "wyoming",
      dc: "district of columbia"
    };
    const US_STATE_NAMES_TO_CODES = Object.fromEntries(
      Object.entries(US_STATE_CODES_TO_NAMES).map(([code, name]) => [name, code])
    );
    const normalizeRegion = (value) => {
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
      if (input?.minAnnualReturn !== void 0 && Number(listing.expectedAnnualReturn) < input.minAnnualReturn) {
        return false;
      }
      if (input?.maxNightlyRate !== void 0 && Number(listing.nightlyRate) > input.maxNightlyRate) {
        return false;
      }
      if (input?.minOccupancyRate !== void 0 && Number(listing.expectedOccupancyRate) < input.minOccupancyRate) {
        return false;
      }
      if (!normalizedSearch) return true;
      const haystack = [
        listing.title ?? "",
        listing.sourceCity ?? "",
        listing.sourceRegion ?? "",
        normalizeRegion(listing.sourceRegion),
        listing.neighbourhood ?? "",
        listing.roomType ?? ""
      ].join(" ").toLowerCase();
      return haystack.includes(normalizedSearch);
    });
    const limit = input?.limit ?? 100;
    res.json(filtered.slice(0, limit));
  });
  app.post(api.strMarket.sync.path, isAuthenticated, async (req, res) => {
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
      syncedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app.get(api.multifamilySale.list.path, isAuthenticated, async (req, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const dbUser = await storage.getUser(userId);
    if (dbUser?.role !== "investor" && dbUser?.role !== "manager") {
      return res.status(403).json({ message: "Only investors and managers can view multifamily sale data" });
    }
    const input = api.multifamilySale.list.input?.parse(req.query ?? {});
    const normalizedSearch = input?.search?.trim().toLowerCase();
    const cityFilter = input?.city?.trim().toLowerCase();
    const regionFilter = input?.region?.trim().toLowerCase();
    const listings = await storage.getMultifamilySaleListings();
    const filtered = listings.filter((listing) => {
      if (cityFilter && (listing.city ?? "").toLowerCase() !== cityFilter) return false;
      if (regionFilter && (listing.state ?? "").toLowerCase() !== regionFilter) return false;
      if (input?.minPrice !== void 0 && Number(listing.price) < input.minPrice) return false;
      if (input?.maxPrice !== void 0 && Number(listing.price) > input.maxPrice) return false;
      if (!normalizedSearch) return true;
      const haystack = [
        listing.formattedAddress ?? "",
        listing.addressLine1 ?? "",
        listing.city ?? "",
        listing.state ?? "",
        listing.zipCode ?? "",
        listing.propertyType ?? ""
      ].join(" ").toLowerCase();
      return haystack.includes(normalizedSearch);
    });
    const limit = input?.limit ?? 150;
    res.json(filtered.slice(0, limit));
  });
  app.post(api.multifamilySale.sync.path, isAuthenticated, async (req, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const dbUser = await storage.getUser(userId);
    if (dbUser?.role !== "investor" && dbUser?.role !== "manager") {
      return res.status(403).json({ message: "Only investors and managers can sync multifamily sale data" });
    }
    const input = api.multifamilySale.list.input?.parse(req.query ?? {});
    try {
      const fetched = await fetchMultifamilySaleListings({
        search: input?.search,
        city: input?.city,
        region: input?.region,
        minPrice: input?.minPrice,
        maxPrice: input?.maxPrice,
        limit: input?.limit ?? 250
      });
      const stored = await storage.replaceMultifamilySaleListings(fetched);
      res.json({
        fetchedCount: fetched.length,
        storedCount: stored.length,
        source: "rentcast",
        syncedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      res.status(502).json({
        message: error?.message || "Failed to sync multifamily sale listings."
      });
    }
  });
  app.get(api.leases.list.path, isAuthenticated, async (req, res) => {
    const user = req.user;
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
  app.post(api.leases.create.path, isAuthenticated, async (req, res) => {
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
      if (err instanceof z4.ZodError) return res.status(400).json({ message: err.message });
      throw err;
    }
  });
  app.patch("/api/leases/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const id = Number(req.params.id);
      const leaseBefore = await storage.getLease(id);
      if (!leaseBefore) return res.status(404).json({ message: "Lease not found" });
      const property = await storage.getProperty(leaseBefore.propertyId);
      if (!property || property.managerId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const lease = await storage.updateLease(id, req.body);
      res.json(lease);
    } catch (err) {
      res.status(400).json({ message: "Failed to update lease" });
    }
  });
  app.post(api.leases.generateDoc.path, isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const leaseId = Number(req.params.id);
      const lease = await storage.getLease(leaseId);
      if (!lease) return res.status(404).json({ message: "Lease not found" });
      const property = await storage.getProperty(lease.propertyId);
      if (!property || property.managerId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const prompt = `Generate a residential lease agreement for the property at ${property?.address}, ${property?.city}, ${property?.state}. 
      Rent: $${lease.rentAmount}. 
      Start Date: ${lease.startDate}. 
      End Date: ${lease.endDate}. 
      Tenant ID: ${lease.tenantId}.
      Include standard clauses for maintenance, security deposit, and utilities. Output as clear professional text.`;
      const response = await openai3.chat.completions.create({
        model: "gpt-5.1",
        messages: [{ role: "user", content: prompt }]
      });
      const draftText = response.choices[0]?.message?.content || "Failed to generate.";
      await storage.updateLease(leaseId, { draftText });
      res.json({ documentText: draftText });
    } catch (error) {
      console.error("AI Generation Error:", error);
      const err = error;
      const isQuotaError = err?.status === 429 || err?.code === "insufficient_quota" || err?.error?.code === "insufficient_quota";
      if (isQuotaError) {
        try {
          const leaseId = Number(req.params.id);
          const lease = await storage.getLease(leaseId);
          if (!lease) return res.status(404).json({ message: "Lease not found" });
          const property = await storage.getProperty(lease.propertyId);
          const fallbackDraft = `RESIDENTIAL LEASE AGREEMENT (Template)

Property Address: ${property?.address ?? "N/A"}, ${property?.city ?? ""}, ${property?.state ?? ""}
Tenant ID: ${lease.tenantId}
Lease Term: ${lease.startDate} to ${lease.endDate}
Monthly Rent: $${lease.rentAmount}

1. Term and Possession
Tenant agrees to rent the premises for the term stated above.

2. Rent and Fees
Rent is due monthly in advance on the first day of each month.
Late fees and returned payment fees may apply as permitted by law.

3. Security Deposit
A security deposit may be required and handled according to applicable state/local law.

4. Utilities and Services
Tenant is responsible for utilities unless otherwise agreed in writing.

5. Maintenance and Repairs
Tenant must keep premises clean and promptly report maintenance issues.
Landlord will maintain major systems and structural elements as required by law.

6. Use and Occupancy
Premises shall be used for residential purposes only.
Subletting/assignment requires written consent unless prohibited by law.

7. Rules, Access, and Compliance
Tenant agrees to comply with property rules and applicable laws.
Landlord may enter with proper notice as permitted by law.

8. Default and Termination
Failure to pay rent or material lease violations may result in remedies allowed by law.

9. Governing Law
This lease is governed by applicable state and local landlord-tenant law.

Note: This is a fallback template generated because AI quota is unavailable. Review and customize before use.`;
          await storage.updateLease(leaseId, { draftText: fallbackDraft });
          return res.status(200).json({
            documentText: fallbackDraft,
            message: "AI quota exceeded. Generated fallback template instead.",
            generatedBy: "template"
          });
        } catch (fallbackError) {
          console.error("Fallback Draft Error:", fallbackError);
        }
      }
      res.status(500).json({ message: "AI generation failed" });
    }
  });
  app.post(api.leases.sendForSigning.path, isAuthenticated, async (req, res) => {
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
      const rawToken = randomBytes3(32).toString("hex");
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3);
      const signingRequest = await storage.createLeaseSigningRequest({
        leaseId: lease.id,
        managerId: userId,
        tenantId: lease.tenantId,
        tenantEmail: tenant.email,
        tokenHash,
        status: "pending",
        expiresAt
      });
      const signingLink = `${getPublicAppBaseUrl()}/lease-sign/${encodeURIComponent(rawToken)}`;
      await sendAuthEmail({
        to: tenant.email,
        subject: "Lease ready for your signature",
        html: `<p>Your lease is ready to sign for <strong>${property.address}</strong>.</p><p><a href="${signingLink}">Review & Sign Lease</a></p><p>This secure link expires on ${expiresAt.toLocaleString()}.</p>`,
        text: `Your lease is ready for signature.
Property: ${property.address}
Sign here: ${signingLink}
This link expires on ${expiresAt.toISOString()}.`
      });
      return res.json({
        leaseId: lease.id,
        status: signingRequest.status,
        expiresAt: expiresAt.toISOString(),
        sentTo: tenant.email,
        signingLink: process.env.NODE_ENV !== "production" ? signingLink : void 0
      });
    } catch (error) {
      if (isMissingRelationError(error)) {
        return res.status(503).json({ message: "Lease signing tables are missing. Run database migrations first." });
      }
      console.error("Lease signing request error:", error);
      return res.status(500).json({ message: "Failed to send lease for signing." });
    }
  });
  app.get(api.leases.signingStatus.path, isAuthenticated, async (req, res) => {
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
        tenantEmail: signing?.tenantEmail ?? null
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
          expiresAt: new Date(signing.expiresAt).toISOString()
        });
      }
      const lease = await storage.getLease(signing.leaseId);
      const property = lease ? await storage.getProperty(lease.propertyId) : void 0;
      return res.json({
        valid: true,
        leaseId: signing.leaseId,
        status: signing.status,
        expiresAt: new Date(signing.expiresAt).toISOString(),
        propertyAddress: property ? `${property.address}, ${property.city}, ${property.state}` : void 0,
        rentAmount: lease ? Number(lease.rentAmount) : void 0,
        tenantEmail: signing.tenantEmail
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
        signedFromIp: req.ip || req.socket?.remoteAddress || void 0
      });
      const lease = await storage.getLease(signing.leaseId);
      if (lease?.draftText) {
        const signatureFooter = `

---
Digitally signed by ${signed.signedFullName} on ${new Date(signed.signedAt).toLocaleString()}
`;
        await storage.updateLease(lease.id, { draftText: `${lease.draftText}${signatureFooter}` });
      }
      return res.json({
        message: "Lease signed successfully.",
        leaseId: signing.leaseId,
        signedAt: new Date(signed.signedAt).toISOString(),
        signedFullName: signed.signedFullName
      });
    } catch (error) {
      if (error instanceof z4.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Invalid signature payload." });
      }
      if (isMissingRelationError(error)) {
        return res.status(503).json({ message: "Lease signing tables are missing. Run database migrations first." });
      }
      return res.status(500).json({ message: "Failed to complete lease signing." });
    }
  });
  app.get(api.leases.expiryNotificationSettings.path, isAuthenticated, async (req, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const dbUser = await storage.getUser(userId);
    if (dbUser?.role !== "manager") return res.status(403).json({ message: "Forbidden" });
    try {
      const settings = await getManagerLeaseExpirySettings(userId);
      return res.json({
        ...settings,
        daysBeforeExpiry: normalizeLeaseExpiryDays(settings.daysBeforeExpiry),
        updatedAt: settings.updatedAt ? settings.updatedAt.toISOString() : null
      });
    } catch (error) {
      if (isMissingRelationError(error)) {
        return res.status(503).json({ message: "Lease expiry settings tables are missing. Run database migrations first." });
      }
      return res.status(500).json({ message: "Failed to fetch settings." });
    }
  });
  app.put(api.leases.updateExpiryNotificationSettings.path, isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const dbUser = await storage.getUser(userId);
      if (dbUser?.role !== "manager") return res.status(403).json({ message: "Forbidden" });
      const input = api.leases.updateExpiryNotificationSettings.input.parse(req.body);
      const settings = await storage.upsertManagerLeaseExpiryNotificationSettings({
        managerId: userId,
        enabled: input.enabled,
        daysBeforeExpiry: normalizeLeaseExpiryDays(input.daysBeforeExpiry)
      });
      if (settings.enabled) {
        void triggerLeaseExpiryScan(userId);
      }
      return res.json({
        ...settings,
        daysBeforeExpiry: normalizeLeaseExpiryDays(settings.daysBeforeExpiry),
        updatedAt: settings.updatedAt ? settings.updatedAt.toISOString() : null
      });
    } catch (error) {
      if (isMissingRelationError(error)) {
        return res.status(503).json({ message: "Lease expiry settings tables are missing. Run database migrations first." });
      }
      if (error instanceof z4.ZodError) {
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
  app.get(api.maintenance.automationSettings.path, isAuthenticated, async (req, res) => {
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
        updatedAt: settings.updatedAt ? settings.updatedAt.toISOString() : null
      });
    } catch (error) {
      if (isMissingRelationError(error)) {
        return res.status(503).json({ message: "Maintenance settings table is missing. Run database migrations first." });
      }
      return res.status(500).json({ message: "Failed to load maintenance settings." });
    }
  });
  app.put(api.maintenance.updateAutomationSettings.path, isAuthenticated, async (req, res) => {
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
        autoVendorAssignmentEnabled: input.autoVendorAssignmentEnabled
      });
      return res.json({
        managerId: settings.managerId,
        autoTriageEnabled: settings.autoTriageEnabled,
        autoEscalationEnabled: settings.autoEscalationEnabled,
        autoVendorAssignmentEnabled: settings.autoVendorAssignmentEnabled,
        updatedAt: settings.updatedAt ? settings.updatedAt.toISOString() : null
      });
    } catch (error) {
      if (isMissingRelationError(error)) {
        return res.status(503).json({ message: "Maintenance settings table is missing. Run database migrations first." });
      }
      if (error instanceof z4.ZodError) {
        return res.status(400).json({ message: error.errors[0]?.message ?? "Invalid settings payload." });
      }
      return res.status(500).json({ message: "Failed to update maintenance settings." });
    }
  });
  app.get(api.maintenance.list.path, isAuthenticated, async (req, res) => {
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
  app.post(api.maintenance.create.path, isAuthenticated, async (req, res) => {
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
      const resolvedPriority = managerSettings.autoTriageEnabled ? triage.priority : input.priority || "medium";
      const slaDueAt = new Date(Date.now() + getSlaHoursForPriority(resolvedPriority) * 60 * 60 * 1e3);
      const assignment = managerSettings.autoVendorAssignmentEnabled ? autoAssignVendor({
        category: resolvedCategory,
        propertyState: property.state
      }) : null;
      const automationSummary = managerSettings.autoTriageEnabled ? triage.summary : "Automation: Auto-triage disabled by manager settings.";
      const request = await storage.createMaintenanceRequest({
        ...input,
        category: resolvedCategory,
        priority: resolvedPriority,
        slaDueAt,
        assignedVendor: assignment?.vendorName ?? null,
        assignmentNote: assignment?.note ?? "Auto-assignment disabled by manager settings.",
        aiAnalysis: automationSummary
      });
      res.status(201).json(request);
    } catch (err) {
      if (err instanceof z4.ZodError) return res.status(400).json({ message: err.message });
      throw err;
    }
  });
  app.patch(api.maintenance.update.path, isAuthenticated, async (req, res) => {
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
      if (err instanceof z4.ZodError) return res.status(400).json({ message: err.message });
      throw err;
    }
  });
  app.post(api.maintenance.analyze.path, isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const reqId = Number(req.params.id);
      const maintenanceRequest = await storage.getMaintenanceRequest(reqId);
      if (!maintenanceRequest) return res.status(404).json({ message: "Request not found" });
      const dbUser = await storage.getUser(userId);
      if (dbUser?.role === "manager") {
        const property = await storage.getProperty(maintenanceRequest.propertyId);
        if (!property || property.managerId !== userId) {
          return res.status(403).json({ message: "Forbidden" });
        }
      } else if (maintenanceRequest.tenantId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const prompt = `Analyze this maintenance request: "${maintenanceRequest.title} - ${maintenanceRequest.description}".
      Categorize the priority (Low, Medium, High, Emergency) and suggest a trade (Plumbing, Electrical, HVAC, General).
      Format: "Priority: [Priority], Trade: [Trade]. Suggestion: [Brief suggestion]"`;
      const response = await openai3.chat.completions.create({
        model: "gpt-5.1",
        messages: [{ role: "user", content: prompt }]
      });
      const analysis = response.choices[0]?.message?.content || "Analysis failed.";
      await storage.updateMaintenanceRequest(reqId, { aiAnalysis: analysis });
      res.json({ analysis });
    } catch (error) {
      console.error("AI Analysis Error:", error);
      res.status(500).json({ message: "AI analysis failed" });
    }
  });
  app.get(api.payments.list.path, isAuthenticated, async (req, res) => {
    const user = req.user;
    if (!user?.claims?.sub) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const dbUser = await storage.getUser(user.claims.sub);
    let paymentList;
    if (dbUser?.role === "manager") {
      const managerLeases = await storage.getLeasesByManager(user.claims.sub);
      const leaseIds = new Set(managerLeases.map((lease) => lease.id));
      const allPayments = await storage.getPayments();
      paymentList = allPayments.filter((payment) => leaseIds.has(payment.leaseId));
    } else {
      const tenantLeases = await storage.getLeasesByTenant(user.claims.sub);
      const leaseIds = tenantLeases.map((l) => l.id);
      const allPayments = await storage.getPayments();
      paymentList = allPayments.filter((p) => leaseIds.includes(p.leaseId));
    }
    res.json(paymentList);
  });
  app.get("/api/accounting/summary", isAuthenticated, async (req, res) => {
    const user = req.user;
    if (!user?.claims?.sub) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = user.claims.sub;
    const dbUser = await storage.getUser(userId);
    let scopedPayments = await storage.getPayments();
    if (dbUser?.role === "manager") {
      const managerLeases = await storage.getLeasesByManager(userId);
      const leaseIds = new Set(managerLeases.map((lease) => lease.id));
      scopedPayments = scopedPayments.filter((payment) => leaseIds.has(payment.leaseId));
    } else {
      const tenantLeases = await storage.getLeasesByTenant(userId);
      const leaseIds = tenantLeases.map((l) => l.id);
      scopedPayments = scopedPayments.filter((p) => leaseIds.includes(p.leaseId));
    }
    const totalCollected = scopedPayments.filter((p) => p.status === "paid").reduce((sum, p) => sum + Number(p.amount), 0);
    const pending = scopedPayments.filter((p) => p.status === "pending").reduce((sum, p) => sum + Number(p.amount), 0);
    const overdue = scopedPayments.filter((p) => p.status === "overdue").reduce((sum, p) => sum + Number(p.amount), 0);
    const now = /* @__PURE__ */ new Date();
    const sixMonthBuckets = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const label = d.toLocaleDateString("en-US", { month: "short" });
      const monthPayments = scopedPayments.filter((p) => {
        const pd = new Date(p.date ?? /* @__PURE__ */ new Date());
        return pd.getFullYear() === year && pd.getMonth() === month;
      });
      sixMonthBuckets.push({
        label,
        collected: monthPayments.filter((p) => p.status === "paid").reduce((sum, p) => sum + Number(p.amount), 0),
        outstanding: monthPayments.filter((p) => p.status === "pending" || p.status === "overdue").reduce((sum, p) => sum + Number(p.amount), 0)
      });
    }
    res.json({
      totalCollected,
      pending,
      overdue,
      outstanding: pending + overdue,
      paymentCount: scopedPayments.length,
      chart: sixMonthBuckets
    });
  });
  app.get(api.accounting.rentOverdueNotificationSettings.path, isAuthenticated, async (req, res) => {
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
      updatedAt: settings.updatedAt ? settings.updatedAt.toISOString() : null
    });
  });
  app.put(api.accounting.updateRentOverdueNotificationSettings.path, isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const dbUser = await storage.getUser(userId);
      if (dbUser?.role !== "manager") return res.status(403).json({ message: "Forbidden" });
      const input = api.accounting.updateRentOverdueNotificationSettings.input.parse(req.body);
      const settings = await storage.upsertManagerRentNotificationSettings({
        managerId: userId,
        enabled: input.enabled,
        overdueDays: normalizeOverdueDays(input.overdueDays)
      });
      if (settings.enabled) {
        void triggerRentOverdueScan(userId);
      }
      return res.json({
        ...settings,
        overdueDays: normalizeOverdueDays(settings.overdueDays),
        updatedAt: settings.updatedAt ? settings.updatedAt.toISOString() : null
      });
    } catch (error) {
      if (isMissingRelationError(error)) {
        return res.status(503).json({ message: "Notification settings tables are missing. Run database migrations first." });
      }
      if (error instanceof z4.ZodError) {
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
  app.get("/api/insights/alerts", isAuthenticated, async (req, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const dbUser = await storage.getUser(userId);
    if (!dbUser) return res.status(401).json({ message: "Unauthorized" });
    const now = /* @__PURE__ */ new Date();
    const alerts = [];
    if (dbUser.role === "manager") {
      const { managerProperties, managerLeases, managerMaintenance, managerPayments } = await getManagerScopedData(userId);
      const activeLeases = managerLeases.filter((l) => l.status === "active");
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      for (const lease of activeLeases) {
        const monthRentPaid = managerPayments.filter((p) => {
          const pd = new Date(p.date ?? /* @__PURE__ */ new Date());
          return p.leaseId === lease.id && p.type === "rent" && p.status === "paid" && pd >= startOfMonth && pd <= now;
        }).reduce((sum, p) => sum + Number(p.amount), 0);
        if (monthRentPaid + 0.01 < Number(lease.rentAmount)) {
          alerts.push({
            id: `overdue-${lease.id}-${startOfMonth.toISOString()}`,
            type: "overdue_rent",
            severity: "high",
            title: "Overdue Rent Detected",
            detail: `Lease #${lease.id} has ${Math.max(Number(lease.rentAmount) - monthRentPaid, 0).toFixed(0)} outstanding for this month.`,
            leaseId: lease.id,
            propertyId: lease.propertyId,
            createdAt: now.toISOString()
          });
        }
        const daysUntilEnd = Math.ceil((new Date(lease.endDate).getTime() - now.getTime()) / (1e3 * 60 * 60 * 24));
        if ([7, 30, 60].includes(daysUntilEnd)) {
          alerts.push({
            id: `expiry-${lease.id}-${daysUntilEnd}`,
            type: "lease_expiry",
            severity: daysUntilEnd <= 7 ? "high" : "medium",
            title: `Lease Expires in ${daysUntilEnd} Days`,
            detail: `Lease #${lease.id} for property #${lease.propertyId} reaches term end on ${new Date(lease.endDate).toLocaleDateString()}.`,
            leaseId: lease.id,
            propertyId: lease.propertyId,
            createdAt: now.toISOString()
          });
        }
      }
      for (const request of managerMaintenance) {
        if (request.status === "completed" || request.status === "rejected") continue;
        const ageDays = Math.floor((now.getTime() - new Date(request.createdAt ?? now).getTime()) / (1e3 * 60 * 60 * 24));
        if (ageDays >= 7) {
          alerts.push({
            id: `maint-${request.id}`,
            type: "maintenance_stalled",
            severity: ageDays >= 14 ? "high" : "medium",
            title: "Stalled Maintenance Request",
            detail: `Request #${request.id} has been ${request.status} for ${ageDays} days.`,
            propertyId: request.propertyId,
            createdAt: now.toISOString()
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
          createdAt: now.toISOString()
        });
      }
    }
    const strListings = await storage.getStrMarketListings();
    if (strListings.length > 0) {
      const newestScrapeMs = Math.max(...strListings.map((l) => new Date(l.lastScrapedAt).getTime()));
      const ageHours = (now.getTime() - newestScrapeMs) / (1e3 * 60 * 60);
      if (ageHours >= 2) {
        alerts.push({
          id: `str-stale-${new Date(newestScrapeMs).toISOString()}`,
          type: "data_sync",
          severity: ageHours >= 6 ? "high" : "low",
          title: "STR Market Data Is Stale",
          detail: `Last STR sync was ${ageHours.toFixed(1)} hours ago.`,
          createdAt: now.toISOString()
        });
      }
    }
    const severityRank = { high: 3, medium: 2, low: 1 };
    alerts.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);
    res.json(alerts.slice(0, 25));
  });
  app.get("/api/insights/portfolio-health", isAuthenticated, async (req, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const dbUser = await storage.getUser(userId);
    if (!dbUser) return res.status(401).json({ message: "Unauthorized" });
    const now = /* @__PURE__ */ new Date();
    let allProperties = [];
    let allLeases = [];
    if (dbUser.role === "manager") {
      allProperties = await storage.getPropertiesByManager(userId);
      allLeases = await storage.getLeasesByManager(userId);
    } else if (dbUser.role === "tenant") {
      allLeases = await storage.getLeasesByTenant(userId);
      const propertyIds = new Set(allLeases.map((lease) => lease.propertyId));
      const all = await storage.getProperties();
      allProperties = all.filter((property) => propertyIds.has(property.id));
    }
    const allPayments = await storage.getPayments();
    const allMaintenance = await storage.getMaintenanceRequests();
    const health = allProperties.map((property) => {
      const propertyLeases = allLeases.filter((l) => l.propertyId === property.id);
      const activeLease = propertyLeases.find((l) => l.status === "active");
      const propertyMaintenance = allMaintenance.filter((m) => m.propertyId === property.id);
      const openMaintenance = propertyMaintenance.filter((m) => m.status !== "completed" && m.status !== "rejected");
      const maintenanceAgeDays = openMaintenance.length ? openMaintenance.reduce((sum, m) => sum + (now.getTime() - new Date(m.createdAt ?? now).getTime()) / (1e3 * 60 * 60 * 24), 0) / openMaintenance.length : 0;
      const occupancyScore = activeLease || property.status === "rented" ? 100 : 45;
      const leasePayments = activeLease ? allPayments.filter((p) => p.leaseId === activeLease.id && p.type === "rent") : [];
      const paidLeasePayments = leasePayments.filter((p) => p.status === "paid").length;
      const onTimeRentScore = leasePayments.length > 0 ? paidLeasePayments / leasePayments.length * 100 : 70;
      const maintenanceScore = Math.max(10, 100 - openMaintenance.length * 15 - Math.min(maintenanceAgeDays, 30));
      const noiTrendScore = Math.max(35, Math.min(100, onTimeRentScore * 0.65 + occupancyScore * 0.35));
      const healthScore = Math.round(
        occupancyScore * 0.35 + onTimeRentScore * 0.25 + maintenanceScore * 0.2 + noiTrendScore * 0.2
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
        openMaintenanceCount: openMaintenance.length
      };
    });
    health.sort((a, b) => b.score - a.score);
    res.json(health);
  });
  app.get("/api/leases/renewal-pipeline", isAuthenticated, async (req, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const dbUser = await storage.getUser(userId);
    if (!dbUser) return res.status(401).json({ message: "Unauthorized" });
    const leases3 = dbUser.role === "manager" ? await storage.getLeasesByManager(userId) : await storage.getLeasesByTenant(userId);
    const now = /* @__PURE__ */ new Date();
    const pipeline = leases3.map((lease) => {
      const daysUntilEnd = Math.ceil((new Date(lease.endDate).getTime() - now.getTime()) / (1e3 * 60 * 60 * 24));
      const stage = lease.status === "terminated" || lease.status === "expired" ? "move-out" : daysUntilEnd <= 30 ? "negotiating" : daysUntilEnd <= 60 ? "outreach" : "renewed";
      const nextAction = stage === "negotiating" ? "Finalize terms and send renewal addendum." : stage === "outreach" ? "Contact tenant and propose renewal options." : stage === "renewed" ? "Confirm term extension and update lease dates." : "Prepare move-out inspection and turnover checklist.";
      return {
        leaseId: lease.id,
        propertyId: lease.propertyId,
        tenantId: lease.tenantId,
        endDate: lease.endDate,
        daysUntilEnd,
        stage,
        nextAction
      };
    });
    pipeline.sort((a, b) => a.daysUntilEnd - b.daysUntilEnd);
    res.json(pipeline);
  });
  app.get("/api/reports/monthly-owner", isAuthenticated, async (req, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const dbUser = await storage.getUser(userId);
    if (dbUser?.role !== "manager") return res.status(403).json({ message: "Only managers can export owner reports" });
    const monthParam = String(req.query.month ?? "").trim();
    const [yearRaw, monthRaw] = monthParam ? monthParam.split("-") : [];
    const now = /* @__PURE__ */ new Date();
    const year = Number(yearRaw) || now.getFullYear();
    const monthIndex = Number(monthRaw) > 0 ? Number(monthRaw) - 1 : now.getMonth();
    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 1);
    const { managerProperties, managerLeases, managerMaintenance, managerPayments } = await getManagerScopedData(userId);
    const activeLeases = managerLeases.filter((l) => l.status === "active");
    const monthPayments = managerPayments.filter((p) => {
      const d = new Date(p.date ?? /* @__PURE__ */ new Date());
      return d >= monthStart && d < monthEnd;
    });
    const collected = monthPayments.filter((p) => p.status === "paid").reduce((sum, p) => sum + Number(p.amount), 0);
    const outstanding = monthPayments.filter((p) => p.status === "pending" || p.status === "overdue").reduce((sum, p) => sum + Number(p.amount), 0);
    const openMaintenance = managerMaintenance.filter((m) => m.status !== "completed" && m.status !== "rejected").length;
    const occupancyRate = managerProperties.length ? managerProperties.filter((p) => p.status === "rented").length / managerProperties.length * 100 : 0;
    const expectedMonthlyRent = activeLeases.reduce((sum, lease) => sum + Number(lease.rentAmount), 0);
    const rows = [
      ["month", monthStart.toISOString().slice(0, 7)],
      ["properties_total", String(managerProperties.length)],
      ["active_leases", String(activeLeases.length)],
      ["occupancy_rate_pct", occupancyRate.toFixed(1)],
      ["expected_monthly_rent", expectedMonthlyRent.toFixed(2)],
      ["collected", collected.toFixed(2)],
      ["outstanding", outstanding.toFixed(2)],
      ["open_maintenance", String(openMaintenance)]
    ];
    const propertyRows = managerProperties.map((p) => {
      const lease = activeLeases.find((l) => l.propertyId === p.id);
      return [
        `property_${p.id}`,
        p.address,
        p.status,
        lease ? Number(lease.rentAmount).toFixed(2) : "0.00"
      ];
    });
    const csvLines = [
      "metric,value,extra_1,extra_2",
      ...rows.map((row) => `${row[0]},${row[1]},,`),
      ...propertyRows.map((row) => `${row[0]},"${row[1].replace(/"/g, '""')}",${row[2]},${row[3]}`)
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
        openMaintenance
      },
      csv: csvLines.join("\n")
    });
  });
  app.get("/api/rent-guidance/:propertyId", isAuthenticated, async (req, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const propertyId = Number(req.params.propertyId);
    const allowed = await canUserAccessProperty(userId, propertyId);
    if (!allowed) return res.status(403).json({ message: "Forbidden" });
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
    const cityOccupancy = cityProperties.length ? cityProperties.filter((p) => p.status === "rented").length / cityProperties.length : 0.8;
    const occupancyFactor = cityOccupancy >= 0.9 ? 1.05 : cityOccupancy <= 0.7 ? 0.96 : 1;
    const month = (/* @__PURE__ */ new Date()).getMonth();
    const seasonalFactor = [4, 5, 6, 7].includes(month) ? 1.03 : [11, 0, 1].includes(month) ? 0.98 : 1;
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
        seasonalFactor
      },
      rationale: `Based on ${comps.length} comparable listings in ${property.city}, local occupancy, and seasonal demand.`
    });
  });
  app.post(api.payments.create.path, isAuthenticated, requireStepUpAuth, async (req, res) => {
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
      if (err instanceof z4.ZodError) return res.status(400).json({ message: err.message });
      throw err;
    }
  });
  app.get("/api/security/readiness", isAuthenticated, async (req, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const dbUser = await storage.getUser(userId);
    if (dbUser?.role !== "manager") return res.status(403).json({ message: "Forbidden" });
    const checks = [
      {
        name: "production_mode",
        ok: process.env.NODE_ENV === "production",
        value: process.env.NODE_ENV ?? "undefined"
      },
      {
        name: "session_secret_strength",
        ok: Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32),
        value: process.env.SESSION_SECRET ? `len:${process.env.SESSION_SECRET.length}` : "missing"
      },
      {
        name: "database_url_configured",
        ok: Boolean(process.env.DATABASE_URL),
        value: process.env.DATABASE_URL ? "set" : "missing"
      },
      {
        name: "dev_auth_bypass_disabled",
        ok: process.env.DEV_AUTH_BYPASS !== "true",
        value: process.env.DEV_AUTH_BYPASS ?? "unset"
      },
      {
        name: "oidc_or_local_auth_configured",
        ok: Boolean(process.env.CLIENT_ID || process.env.DEV_AUTH_BYPASS === "true"),
        value: process.env.CLIENT_ID ? "oidc" : "local-only"
      }
    ];
    const passed = checks.filter((c) => c.ok).length;
    res.json({
      ready: passed === checks.length,
      passed,
      total: checks.length,
      checks,
      checkedAt: (/* @__PURE__ */ new Date()).toISOString()
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
      const payload = api.integrations.zillow.leadDelivery.input.parse(req.body);
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
        rawPayload: normalized.rawPayload
      });
      return res.status(202).json({
        success: true,
        leadId: lead.id,
        externalLeadId: lead.externalLeadId
      });
    } catch (err) {
      if (err instanceof z4.ZodError) return res.status(400).json({ message: err.message });
      throw err;
    }
  });
  app.post(api.integrations.zillow.createLead.path, isAuthenticated, async (req, res) => {
    try {
      const payload = api.integrations.zillow.createLead.input.parse(req.body);
      const lead = await storage.upsertZillowLeadByExternalId(payload);
      res.status(201).json(lead);
    } catch (err) {
      if (err instanceof z4.ZodError) return res.status(400).json({ message: err.message });
      throw err;
    }
  });
  app.get(api.screenings.list.path, isAuthenticated, async (req, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const manager = await storage.getUser(userId);
    if (!manager || manager.role !== "manager") {
      return res.status(403).json({ message: "Only managers can view screening data." });
    }
    const [leads, screenings3, tenants, properties3] = await Promise.all([
      storage.getZillowLeadsForManager(userId, manager.email || void 0),
      storage.getScreeningsByManager(userId),
      storage.getTenants(),
      storage.getPropertiesByManager(userId)
    ]);
    const tenantItems = tenants.map((tenant) => ({
      id: tenant.id,
      name: [tenant.firstName, tenant.lastName].filter(Boolean).join(" ").trim() || tenant.email || tenant.id,
      email: tenant.email || ""
    }));
    const summary = {
      totalLeads: leads.length,
      pendingLeads: leads.filter((lead) => lead.status === "received").length,
      activeScreenings: screenings3.filter((screening) => screening.status === "pending").length,
      approvedScreenings: screenings3.filter((screening) => screening.status === "approved").length
    };
    res.json({
      leads,
      screenings: screenings3,
      tenants: tenantItems,
      properties: properties3.map((property) => ({
        id: property.id,
        address: property.address,
        city: property.city,
        state: property.state
      })),
      summary
    });
  });
  app.post(api.screenings.create.path, isAuthenticated, async (req, res) => {
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
      if (err instanceof z4.ZodError) return res.status(400).json({ message: err.message });
      throw err;
    }
  });
  return httpServer;
}

// server/static.ts
import express from "express";
import fs from "fs";
import path from "path";
function serveStatic(app) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

// server/app.ts
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function createApp(runtime = "server") {
  const app = express2();
  const httpServer = createServer(app);
  app.disable("x-powered-by");
  app.set("trust proxy", process.env.NODE_ENV === "production" ? 1 : 0);
  app.use(
    express2.json({
      limit: "1mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app.use(express2.urlencoded({ extended: false, limit: "256kb" }));
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }
    next();
  });
  app.use("/api", createRateLimiter({
    keyPrefix: "api-global",
    windowMs: 60 * 1e3,
    max: 240,
    message: "API rate limit exceeded. Please slow down."
  }));
  app.use((req, res, next) => {
    const start = Date.now();
    const path4 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path4.startsWith("/api")) {
        let logLine = `${req.method} ${path4} ${res.statusCode} in ${duration}ms`;
        const isAuthPath = path4.startsWith("/api/auth");
        if (capturedJsonResponse && process.env.NODE_ENV !== "production" && !isAuthPath) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }
        log(logLine);
      }
    });
    next();
  });
  await registerRoutes(httpServer, app);
  app.use((err, _req, res, next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
  if (runtime === "server") {
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite: setupVite2 } = await Promise.resolve().then(() => (init_vite(), vite_exports));
      await setupVite2(httpServer, app);
    }
  }
  return { app, httpServer };
}

// server/vercel-handler.ts
var appPromise = createApp("serverless").then(({ app }) => app);
async function handler(req, res) {
  const app = await appPromise;
  return app(req, res);
}
export {
  handler as default
};
