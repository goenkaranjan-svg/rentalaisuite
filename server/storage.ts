
import { db } from "./db";
import { 
  properties, leases, maintenanceRequests, payments, screenings,
  type InsertProperty, type InsertLease, type InsertMaintenanceRequest, 
  type InsertPayment, type InsertScreening
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Properties
  getProperties(): Promise<typeof properties.$inferSelect[]>;
  getProperty(id: number): Promise<typeof properties.$inferSelect | undefined>;
  createProperty(property: InsertProperty): Promise<typeof properties.$inferSelect>;
  updateProperty(id: number, property: Partial<InsertProperty>): Promise<typeof properties.$inferSelect>;
  deleteProperty(id: number): Promise<void>;

  // Leases
  getLeases(): Promise<typeof leases.$inferSelect[]>;
  createLease(lease: InsertLease): Promise<typeof leases.$inferSelect>;
  getLease(id: number): Promise<typeof leases.$inferSelect | undefined>;

  // Maintenance
  getMaintenanceRequests(): Promise<typeof maintenanceRequests.$inferSelect[]>;
  createMaintenanceRequest(request: InsertMaintenanceRequest): Promise<typeof maintenanceRequests.$inferSelect>;
  getMaintenanceRequest(id: number): Promise<typeof maintenanceRequests.$inferSelect | undefined>;
  updateMaintenanceRequest(id: number, request: Partial<InsertMaintenanceRequest>): Promise<typeof maintenanceRequests.$inferSelect>;

  // Payments
  getPayments(): Promise<typeof payments.$inferSelect[]>;
  createPayment(payment: InsertPayment): Promise<typeof payments.$inferSelect>;

  // Screenings
  createScreening(screening: InsertScreening): Promise<typeof screenings.$inferSelect>;
}

export class DatabaseStorage implements IStorage {
  // Properties
  async getProperties() {
    return await db.select().from(properties).orderBy(desc(properties.createdAt));
  }
  async getProperty(id: number) {
    const [property] = await db.select().from(properties).where(eq(properties.id, id));
    return property;
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
  async createLease(insertLease: InsertLease) {
    const [lease] = await db.insert(leases).values(insertLease).returning();
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
  async createMaintenanceRequest(insertRequest: InsertMaintenanceRequest) {
    const [request] = await db.insert(maintenanceRequests).values(insertRequest).returning();
    return request;
  }
  async getMaintenanceRequest(id: number) {
    const [request] = await db.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, id));
    return request;
  }
  async updateMaintenanceRequest(id: number, update: Partial<InsertMaintenanceRequest>) {
    const [request] = await db.update(maintenanceRequests).set(update).where(eq(maintenanceRequests.id, id)).returning();
    return request;
  }

  // Payments
  async getPayments() {
    return await db.select().from(payments).orderBy(desc(payments.date));
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
}

export const storage = new DatabaseStorage();
