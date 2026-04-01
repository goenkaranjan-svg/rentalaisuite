import { eq, inArray, isNull } from "drizzle-orm";
import { db } from "../server/db";
import { authStorage } from "../server/integrations/auth/storage";
import {
  leaseExpiryNotificationHistory,
  leaseSigningRequests,
  leases,
  listingMappingTemplates,
  maintenanceRequests,
  managerLeaseExpiryNotificationSettings,
  managerMaintenanceAutomationSettings,
  managerRentNotificationSettings,
  payments,
  properties,
  rentOverdueNotificationHistory,
  screenings,
  users,
  vendors,
  zillowLeads,
} from "../shared/schema";

type IdToOrganization = Map<string, string>;

async function main() {
  const managers = await db.select().from(users).where(eq(users.role, "manager"));
  if (managers.length === 0) {
    console.log("[backfill-organizations] no manager users found");
    return;
  }

  const managerOrganizations: IdToOrganization = new Map();
  const tenantOrganizations: IdToOrganization = new Map();

  for (const manager of managers) {
    const organization = await authStorage.ensureOrganizationForManager(manager);
    managerOrganizations.set(manager.id, organization.id);
    console.log(`[backfill-organizations] manager ${manager.email ?? manager.id} -> org ${organization.id}`);
  }

  for (const manager of managers) {
    const organizationId = managerOrganizations.get(manager.id);
    if (!organizationId) continue;

    const managerProperties = await db.select().from(properties).where(eq(properties.managerId, manager.id));
    const propertyIds = managerProperties.map((property) => property.id);

    await db
      .update(properties)
      .set({ organizationId })
      .where(eq(properties.managerId, manager.id));

    await db
      .update(vendors)
      .set({ organizationId })
      .where(eq(vendors.managerId, manager.id));

    await db
      .update(listingMappingTemplates)
      .set({ organizationId })
      .where(eq(listingMappingTemplates.managerId, manager.id));

    await db
      .update(managerRentNotificationSettings)
      .set({ organizationId })
      .where(eq(managerRentNotificationSettings.managerId, manager.id));

    await db
      .update(managerLeaseExpiryNotificationSettings)
      .set({ organizationId })
      .where(eq(managerLeaseExpiryNotificationSettings.managerId, manager.id));

    await db
      .update(managerMaintenanceAutomationSettings)
      .set({ organizationId })
      .where(eq(managerMaintenanceAutomationSettings.managerId, manager.id));

    await db
      .update(zillowLeads)
      .set({ organizationId })
      .where(eq(zillowLeads.managerId, manager.id));

    if (propertyIds.length === 0) {
      continue;
    }

    const managerLeases = await db.select().from(leases).where(inArray(leases.propertyId, propertyIds));
    const leaseIds = managerLeases.map((lease) => lease.id);

    await db
      .update(leases)
      .set({ organizationId })
      .where(inArray(leases.propertyId, propertyIds));

    await db
      .update(maintenanceRequests)
      .set({ organizationId })
      .where(inArray(maintenanceRequests.propertyId, propertyIds));

    if (leaseIds.length > 0) {
      await db
        .update(leaseSigningRequests)
        .set({ organizationId })
        .where(inArray(leaseSigningRequests.leaseId, leaseIds));

      await db
        .update(payments)
        .set({ organizationId })
        .where(inArray(payments.leaseId, leaseIds));

      await db
        .update(rentOverdueNotificationHistory)
        .set({ organizationId })
        .where(inArray(rentOverdueNotificationHistory.leaseId, leaseIds));

      await db
        .update(leaseExpiryNotificationHistory)
        .set({ organizationId })
        .where(inArray(leaseExpiryNotificationHistory.leaseId, leaseIds));
    }

    for (const lease of managerLeases) {
      tenantOrganizations.set(lease.tenantId, organizationId);
    }
  }

  for (const [tenantId, organizationId] of tenantOrganizations.entries()) {
    await db
      .update(screenings)
      .set({ organizationId })
      .where(eq(screenings.tenantId, tenantId));
  }

  const remaining = {
    properties: await db.select({ id: properties.id }).from(properties).where(isNull(properties.organizationId)),
    leases: await db.select({ id: leases.id }).from(leases).where(isNull(leases.organizationId)),
    maintenanceRequests: await db
      .select({ id: maintenanceRequests.id })
      .from(maintenanceRequests)
      .where(isNull(maintenanceRequests.organizationId)),
    vendors: await db.select({ id: vendors.id }).from(vendors).where(isNull(vendors.organizationId)),
  };

  console.log(
    `[backfill-organizations] remaining null org ids -> properties=${remaining.properties.length}, leases=${remaining.leases.length}, maintenance=${remaining.maintenanceRequests.length}, vendors=${remaining.vendors.length}`,
  );
}

main()
  .then(() => {
    console.log("[backfill-organizations] done");
    process.exit(0);
  })
  .catch((error) => {
    console.error("[backfill-organizations] failed", error);
    process.exit(1);
  });
