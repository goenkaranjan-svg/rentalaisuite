import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { storage } from "../server/storage";
import { authStorage } from "../server/integrations/auth/storage";
import { maintenanceRequests, vendors } from "../shared/schema";

const MANAGER_EMAIL = "ranjan_goenka@yahoo.com";

const vendorSeeds = [
  {
    name: "Peachtree Plumbing Co.",
    tradeCategories: ["plumbing"],
    phone: "(404) 555-1101",
    email: "dispatch@peachtreeplumbing.co",
    website: "https://peachtreeplumbing.example.com",
    rating: "4.80",
    reviewCount: 54,
    isOnCall: true,
  },
  {
    name: "Northside Electric Pros",
    tradeCategories: ["electrical"],
    phone: "(404) 555-1102",
    email: "service@northsideelectric.example.com",
    website: "https://northsideelectric.example.com",
    rating: "4.70",
    reviewCount: 41,
    isOnCall: true,
  },
  {
    name: "Duluth Comfort HVAC",
    tradeCategories: ["hvac"],
    phone: "(404) 555-1103",
    email: "help@duluthcomforthvac.example.com",
    website: "https://duluthcomforthvac.example.com",
    rating: "4.90",
    reviewCount: 63,
    isOnCall: true,
  },
  {
    name: "Appliance Rescue Team",
    tradeCategories: ["appliance"],
    phone: "(404) 555-1104",
    email: "repairs@appliancerescue.example.com",
    website: "https://appliancerescue.example.com",
    rating: "4.60",
    reviewCount: 27,
    isOnCall: false,
  },
  {
    name: "Georgia Pest Shield",
    tradeCategories: ["pest"],
    phone: "(404) 555-1105",
    email: "support@gapestshield.example.com",
    website: "https://gapestshield.example.com",
    rating: "4.50",
    reviewCount: 35,
    isOnCall: false,
  },
  {
    name: "Secure Entry Locksmith",
    tradeCategories: ["security"],
    phone: "(404) 555-1106",
    email: "dispatch@secureentry.example.com",
    website: "https://secureentry.example.com",
    rating: "4.70",
    reviewCount: 22,
    isOnCall: true,
  },
  {
    name: "Turnberry General Services",
    tradeCategories: ["general"],
    phone: "(404) 555-1107",
    email: "ops@turnberrygeneral.example.com",
    website: "https://turnberrygeneral.example.com",
    rating: "4.40",
    reviewCount: 18,
    isOnCall: false,
  },
] as const;

const maintenanceSeeds = [
  {
    title: "Kitchen sink draining slowly",
    description: "Water is pooling in the kitchen sink and takes several minutes to drain after normal use.",
    category: "plumbing",
    priority: "medium",
    status: "open",
    vendorName: "Peachtree Plumbing Co.",
  },
  {
    title: "Primary bedroom AC not cooling evenly",
    description: "The HVAC system is running, but the primary bedroom stays noticeably warmer than the rest of the home.",
    category: "hvac",
    priority: "high",
    status: "in_progress",
    vendorName: "Duluth Comfort HVAC",
  },
  {
    title: "Living room outlet intermittently sparking",
    description: "An outlet near the entertainment center sparked twice when plugging in devices and should be inspected.",
    category: "electrical",
    priority: "high",
    status: "open",
    vendorName: "Northside Electric Pros",
  },
  {
    title: "Refrigerator not holding temperature",
    description: "The refrigerator is cooling inconsistently and food on the top shelf is getting warm overnight.",
    category: "appliance",
    priority: "medium",
    status: "open",
    vendorName: "Appliance Rescue Team",
  },
  {
    title: "Pantry pest control follow-up",
    description: "Tenant reported renewed signs of pantry pests and wants a follow-up treatment scheduled this week.",
    category: "pest",
    priority: "low",
    status: "open",
    vendorName: "Georgia Pest Shield",
  },
  {
    title: "Front door smart lock battery alert",
    description: "The front door smart lock is reporting a low battery warning and should be serviced before lockout risk.",
    category: "security",
    priority: "medium",
    status: "open",
    vendorName: "Secure Entry Locksmith",
  },
  {
    title: "Drywall touch-up after prior repair",
    description: "There is visible patchwork in the hallway from a previous repair that still needs sanding and paint touch-up.",
    category: "general",
    priority: "low",
    status: "completed",
    vendorName: "Turnberry General Services",
  },
] as const;

async function seedVendors(managerId: string, property: { city: string; state: string; zipCode: string }) {
  const vendorNamesByCategory = new Map<string, string>();

  for (const seed of vendorSeeds) {
    const existing = await db.query.vendors.findFirst({
      where: and(eq(vendors.managerId, managerId), eq(vendors.name, seed.name)),
    });

    if (!existing) {
      await storage.createVendor({
        managerId,
        name: seed.name,
        tradeCategories: [...seed.tradeCategories],
        serviceStates: [property.state],
        serviceCities: [property.city],
        serviceZipCodes: [property.zipCode],
        phone: seed.phone,
        email: seed.email,
        website: seed.website,
        rating: seed.rating,
        reviewCount: seed.reviewCount,
        licenseNumber: null,
        insuranceExpiry: null,
        isOnCall: seed.isOnCall,
        isActive: true,
        source: "manual",
        sourceExternalId: null,
        confidenceScore: "0.950",
        rawIntakeData: { seededFor: MANAGER_EMAIL },
      });
      console.log(`[seed] created vendor: ${seed.name}`);
    } else {
      console.log(`[seed] vendor already exists: ${seed.name}`);
    }

    vendorNamesByCategory.set(seed.tradeCategories[0], seed.name);
  }

  return vendorNamesByCategory;
}

async function seedMaintenance(propertyId: number, tenantId: string, vendorNamesByCategory: Map<string, string>) {
  for (const seed of maintenanceSeeds) {
    const existing = await db.query.maintenanceRequests.findFirst({
      where: and(eq(maintenanceRequests.propertyId, propertyId), eq(maintenanceRequests.title, seed.title)),
    });

    if (existing) {
      console.log(`[seed] maintenance already exists: ${seed.title}`);
      continue;
    }

    await storage.createMaintenanceRequest({
      propertyId,
      tenantId,
      title: seed.title,
      description: seed.description,
      category: seed.category,
      priority: seed.priority,
      status: seed.status,
      assignedVendor: vendorNamesByCategory.get(seed.category) ?? seed.vendorName,
      assignmentNote: "Seeded for manager demo workflow.",
      aiAnalysis: `Priority: ${seed.priority}. Trade: ${seed.category}. Seeded demo maintenance workflow.`,
    });
    console.log(`[seed] created maintenance request: ${seed.title}`);
  }
}

async function main() {
  const manager = await authStorage.getUserByEmail(MANAGER_EMAIL);
  if (!manager) {
    throw new Error(`Manager not found: ${MANAGER_EMAIL}`);
  }
  if (manager.role !== "manager") {
    throw new Error(`${MANAGER_EMAIL} exists but is not a manager.`);
  }

  const properties = await storage.getPropertiesByManager(manager.id);
  if (properties.length === 0) {
    throw new Error(`${MANAGER_EMAIL} has no properties to attach maintenance requests to.`);
  }

  const property = properties[0];
  const leases = await storage.getLeasesByManager(manager.id);
  const lease = leases.find((item) => item.propertyId === property.id && item.status === "active")
    ?? leases.find((item) => item.propertyId === property.id)
    ?? null;

  if (!lease) {
    throw new Error(`${MANAGER_EMAIL} has no lease on property ${property.id}; cannot seed maintenance requests.`);
  }

  const vendorNamesByCategory = await seedVendors(manager.id, property);
  await seedMaintenance(property.id, lease.tenantId, vendorNamesByCategory);

  console.log(`[seed] completed for ${MANAGER_EMAIL} on property ${property.id}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
