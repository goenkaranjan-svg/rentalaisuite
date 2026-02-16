
import { storage } from "./storage";
import { authStorage } from "./replit_integrations/auth/storage";

export async function seedDatabase() {
  const existingProperties = await storage.getProperties();
  if (existingProperties.length > 0) return;

  console.log("Seeding database...");

  // Create a default manager user (optional, but good for linking)
  const manager = await authStorage.upsertUser({
    id: "user_manager_1",
    email: "manager@propman.ai",
    firstName: "John",
    lastName: "Manager",
    profileImageUrl: "https://placehold.co/100x100",
  });

  const tenant1 = await authStorage.upsertUser({
    id: "user_tenant_1",
    email: "tenant1@propman.ai",
    firstName: "Alice",
    lastName: "Tenant",
    profileImageUrl: "https://placehold.co/100x100",
  });

  // Create Properties
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
    imageUrl: "https://placehold.co/600x400",
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
    imageUrl: "https://placehold.co/600x400",
  });

  // Create Lease
  const lease1 = await storage.createLease({
    propertyId: prop1.id,
    tenantId: tenant1.id,
    startDate: new Date("2023-01-01"),
    endDate: new Date("2024-01-01"),
    rentAmount: "3500.00",
    status: "active",
  });

  // Create Maintenance Requests
  await storage.createMaintenanceRequest({
    propertyId: prop1.id,
    tenantId: tenant1.id,
    title: "Leaky Faucet",
    description: "The kitchen sink faucet is dripping constantly.",
    priority: "low",
    status: "open",
    aiAnalysis: "Priority: Low, Trade: Plumbing. Suggestion: Tighten packing nut or replace washer.",
  });

  await storage.createMaintenanceRequest({
    propertyId: prop1.id,
    tenantId: tenant1.id,
    title: "AC Not Working",
    description: "The air conditioning unit is making a loud noise and not cooling.",
    priority: "high",
    status: "in_progress",
    aiAnalysis: "Priority: High, Trade: HVAC. Suggestion: Check capacitor and fan motor immediately.",
  });

  // Create Payments
  await storage.createPayment({
    leaseId: lease1.id,
    amount: "3500.00",
    date: new Date("2023-10-01"),
    status: "paid",
    type: "rent",
  });

  await storage.createPayment({
    leaseId: lease1.id,
    amount: "3500.00",
    date: new Date("2023-11-01"),
    status: "paid",
    type: "rent",
  });

   await storage.createPayment({
    leaseId: lease1.id,
    amount: "3500.00",
    date: new Date("2023-12-01"),
    status: "pending",
    type: "rent",
  });

  console.log("Database seeded successfully.");
}
