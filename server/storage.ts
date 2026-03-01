
import { db } from "./db";
import { 
  users, properties, leases, maintenanceRequests, payments, screenings, listingMappingTemplates, strMarketListings,
  type User, type Property, type Lease, type MaintenanceRequest, 
  type Payment, type Screening, type ListingMappingTemplate, type InsertProperty, type InsertLease, 
  type InsertMaintenanceRequest, type InsertPayment, type InsertScreening, type InsertListingMappingTemplate,
  type StrMarketListing, type InsertStrMarketListing
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getTenants(): Promise<User[]>;

  // Properties
  getProperties(): Promise<Property[]>;
  getProperty(id: number): Promise<Property | undefined>;
  getPropertiesByManager(managerId: string): Promise<Property[]>;
  createProperty(property: InsertProperty): Promise<Property>;
  updateProperty(id: number, property: Partial<InsertProperty>): Promise<Property>;
  deleteProperty(id: number): Promise<void>;

  // Leases
  getLeases(): Promise<Lease[]>;
  getLeasesByManager(managerId: string): Promise<Lease[]>;
  getLeasesByTenant(tenantId: string): Promise<Lease[]>;
  createLease(lease: InsertLease): Promise<Lease>;
  updateLease(id: number, lease: Partial<Lease>): Promise<Lease>;
  getLease(id: number): Promise<Lease | undefined>;

  // Maintenance
  getMaintenanceRequests(): Promise<MaintenanceRequest[]>;
  getMaintenanceRequestsByTenant(tenantId: string): Promise<MaintenanceRequest[]>;
  getMaintenanceRequestsByProperty(propertyId: number): Promise<MaintenanceRequest[]>;
  createMaintenanceRequest(request: InsertMaintenanceRequest): Promise<MaintenanceRequest>;
  getMaintenanceRequest(id: number): Promise<MaintenanceRequest | undefined>;
  updateMaintenanceRequest(id: number, request: Partial<MaintenanceRequest>): Promise<MaintenanceRequest>;

  // Payments
  getPayments(): Promise<Payment[]>;
  getPaymentsByLease(leaseId: number): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;

  // Screenings
  createScreening(screening: InsertScreening): Promise<Screening>;
  getScreeningsByTenant(tenantId: string): Promise<Screening[]>;

  // Listing Mapping Templates
  getListingMappingTemplatesByManager(managerId: string): Promise<ListingMappingTemplate[]>;
  getListingMappingTemplate(id: number): Promise<ListingMappingTemplate | undefined>;
  createListingMappingTemplate(template: InsertListingMappingTemplate): Promise<ListingMappingTemplate>;
  deleteListingMappingTemplate(id: number): Promise<void>;

  // STR Market Listings
  getStrMarketListing(id: number): Promise<StrMarketListing | undefined>;
  getStrMarketListings(): Promise<StrMarketListing[]>;
  replaceStrMarketListings(listings: InsertStrMarketListing[]): Promise<StrMarketListing[]>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string) {
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
  async getProperty(id: number) {
    const [property] = await db.select().from(properties).where(eq(properties.id, id));
    return property;
  }
  async getPropertiesByManager(managerId: string) {
    return await db.select().from(properties).where(eq(properties.managerId, managerId)).orderBy(desc(properties.createdAt));
  }
  async createProperty(insertProperty: InsertProperty) {
    const [property] = await db.insert(properties).values(insertProperty).returning();
    return property;
  }
  async updateProperty(id: number, update: Partial<InsertProperty>) {
    const [property] = await db.update(properties).set(update).where(eq(properties.id, id)).returning();
    return property;
  }
  async deleteProperty(id: number) {
    await db.delete(properties).where(eq(properties.id, id));
  }

  // Leases
  async getLeases() {
    return await db.select().from(leases).orderBy(desc(leases.createdAt));
  }
  async getLeasesByManager(managerId: string): Promise<Lease[]> {
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
      createdAt: leases.createdAt,
    })
      .from(leases)
      .innerJoin(properties, eq(leases.propertyId, properties.id))
      .where(eq(properties.managerId, managerId))
      .orderBy(desc(leases.createdAt));
    return results;
  }
  async getLeasesByTenant(tenantId: string) {
    return await db.select().from(leases).where(eq(leases.tenantId, tenantId)).orderBy(desc(leases.createdAt));
  }
  async createLease(insertLease: InsertLease) {
    const [lease] = await db.insert(leases).values(insertLease).returning();
    return lease;
  }
  async updateLease(id: number, update: Partial<Lease>) {
    const [lease] = await db.update(leases).set(update).where(eq(leases.id, id)).returning();
    return lease;
  }
  async getLease(id: number) {
    const [lease] = await db.select().from(leases).where(eq(leases.id, id));
    return lease;
  }

  // Maintenance
  async getMaintenanceRequests() {
    return await db.select().from(maintenanceRequests).orderBy(desc(maintenanceRequests.createdAt));
  }
  async getMaintenanceRequestsByTenant(tenantId: string) {
    return await db.select().from(maintenanceRequests).where(eq(maintenanceRequests.tenantId, tenantId)).orderBy(desc(maintenanceRequests.createdAt));
  }
  async getMaintenanceRequestsByProperty(propertyId: number) {
    return await db.select().from(maintenanceRequests).where(eq(maintenanceRequests.propertyId, propertyId)).orderBy(desc(maintenanceRequests.createdAt));
  }
  async createMaintenanceRequest(insertRequest: InsertMaintenanceRequest) {
    const [request] = await db.insert(maintenanceRequests).values(insertRequest).returning();
    return request;
  }
  async getMaintenanceRequest(id: number) {
    const [request] = await db.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, id));
    return request;
  }
  async updateMaintenanceRequest(id: number, update: Partial<MaintenanceRequest>) {
    const [request] = await db.update(maintenanceRequests).set(update).where(eq(maintenanceRequests.id, id)).returning();
    return request;
  }

  // Payments
  async getPayments() {
    return await db.select().from(payments).orderBy(desc(payments.date));
  }
  async getPaymentsByLease(leaseId: number) {
    return await db.select().from(payments).where(eq(payments.leaseId, leaseId)).orderBy(desc(payments.date));
  }
  async createPayment(insertPayment: InsertPayment) {
    const [payment] = await db.insert(payments).values(insertPayment).returning();
    return payment;
  }

  // Screenings
  async createScreening(insertScreening: InsertScreening) {
    const [screening] = await db.insert(screenings).values(insertScreening).returning();
    return screening;
  }
  async getScreeningsByTenant(tenantId: string) {
    return await db.select().from(screenings).where(eq(screenings.tenantId, tenantId)).orderBy(desc(screenings.createdAt));
  }

  // Listing Mapping Templates
  async getListingMappingTemplatesByManager(managerId: string) {
    return await db
      .select()
      .from(listingMappingTemplates)
      .where(eq(listingMappingTemplates.managerId, managerId))
      .orderBy(desc(listingMappingTemplates.createdAt));
  }
  async getListingMappingTemplate(id: number) {
    const [template] = await db
      .select()
      .from(listingMappingTemplates)
      .where(eq(listingMappingTemplates.id, id));
    return template;
  }
  async createListingMappingTemplate(insertTemplate: InsertListingMappingTemplate) {
    const [template] = await db.insert(listingMappingTemplates).values(insertTemplate).returning();
    return template;
  }
  async deleteListingMappingTemplate(id: number) {
    await db.delete(listingMappingTemplates).where(eq(listingMappingTemplates.id, id));
  }

  // STR Market Listings
  async getStrMarketListing(id: number) {
    const [listing] = await db.select().from(strMarketListings).where(eq(strMarketListings.id, id));
    return listing;
  }
  async getStrMarketListings() {
    return await db.select().from(strMarketListings).orderBy(desc(strMarketListings.expectedAnnualReturn));
  }
  async replaceStrMarketListings(listings: InsertStrMarketListing[]) {
    if (listings.length === 0) return [];
    return await db.transaction(async (tx) => {
      await tx.delete(strMarketListings);
      return await tx.insert(strMarketListings).values(listings).returning();
    });
  }
}

export const storage = new DatabaseStorage();
