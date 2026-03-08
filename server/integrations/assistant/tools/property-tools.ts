import type { User } from "@shared/schema";
import { storage } from "../../../storage";
import type { AssistantIntent } from "../router";

export type AssistantToolResult = {
  toolName: string;
  summary: string;
  data: Record<string, unknown>;
};

function toMoney(value: string | number | null | undefined): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatAddress(input: { address: string; city: string; state: string; zipCode: string }): string {
  return `${input.address}, ${input.city}, ${input.state} ${input.zipCode}`;
}

async function getScopedPropertiesAndLeases(user: User) {
  if (user.role === "manager") {
    const [properties, leases] = await Promise.all([
      storage.getPropertiesByManager(user.id),
      storage.getLeasesByManager(user.id),
    ]);
    return { properties, leases };
  }

  if (user.role === "tenant") {
    const leases = await storage.getLeasesByTenant(user.id);
    const propertyIds = new Set(leases.map((lease) => lease.propertyId));
    const allProperties = await storage.getProperties();
    const properties = allProperties.filter((property) => propertyIds.has(property.id));
    return { properties, leases };
  }

  return { properties: [], leases: [] };
}

async function getHighestRentProperty(user: User): Promise<AssistantToolResult> {
  const { properties, leases } = await getScopedPropertiesAndLeases(user);
  const propertyById = new Map(properties.map((property) => [property.id, property]));
  const leaseCandidates = leases.filter((lease) => propertyById.has(lease.propertyId));
  const activeCandidates = leaseCandidates.filter((lease) => lease.status === "active");
  const source = activeCandidates.length > 0 ? activeCandidates : leaseCandidates;

  let highest = source[0];
  for (const lease of source) {
    if (!highest || toMoney(lease.rentAmount) > toMoney(highest.rentAmount)) {
      highest = lease;
    }
  }

  if (!highest) {
    return {
      toolName: "getHighestRentProperty",
      summary: "No lease data available for this user.",
      data: { found: false },
    };
  }

  const property = propertyById.get(highest.propertyId);
  if (!property) {
    return {
      toolName: "getHighestRentProperty",
      summary: "No matching property record found for highest-rent lease.",
      data: { found: false },
    };
  }

  const rent = toMoney(highest.rentAmount);
  return {
    toolName: "getHighestRentProperty",
    summary: `Highest rent is $${rent.toFixed(2)} at ${formatAddress(property)}.`,
    data: {
      found: true,
      propertyId: property.id,
      leaseId: highest.id,
      rentAmount: rent,
      status: highest.status,
      address: formatAddress(property),
    },
  };
}

async function getOverdueRentSummary(user: User): Promise<AssistantToolResult> {
  const { properties, leases } = await getScopedPropertiesAndLeases(user);
  const leaseIds = new Set(leases.map((lease) => lease.id));
  const propertyById = new Map(properties.map((property) => [property.id, property]));
  const allPayments = await storage.getPayments();
  const overdue = allPayments.filter(
    (payment) =>
      leaseIds.has(payment.leaseId) &&
      payment.status === "overdue" &&
      (payment.type === "rent" || payment.type === "fee"),
  );

  const totalOverdue = overdue.reduce((sum, payment) => sum + toMoney(payment.amount), 0);
  const items = overdue.slice(0, 10).map((payment) => {
    const lease = leases.find((l) => l.id === payment.leaseId);
    const property = lease ? propertyById.get(lease.propertyId) : undefined;
    return {
      paymentId: payment.id,
      leaseId: payment.leaseId,
      amount: toMoney(payment.amount),
      date: payment.date,
      propertyAddress: property ? formatAddress(property) : "Unknown property",
    };
  });

  return {
    toolName: "getOverdueRentSummary",
    summary:
      overdue.length === 0
        ? "No overdue rent payments found."
        : `${overdue.length} overdue payment(s), total $${totalOverdue.toFixed(2)}.`,
    data: {
      count: overdue.length,
      totalOverdue,
      items,
    },
  };
}

async function getMaintenanceSummary(user: User): Promise<AssistantToolResult> {
  const allRequests = await storage.getMaintenanceRequests();
  let scoped = allRequests;

  if (user.role === "manager") {
    const properties = await storage.getPropertiesByManager(user.id);
    const propertyIds = new Set(properties.map((property) => property.id));
    scoped = allRequests.filter((request) => propertyIds.has(request.propertyId));
  } else if (user.role === "tenant") {
    scoped = allRequests.filter((request) => request.tenantId === user.id);
  } else {
    scoped = [];
  }

  const open = scoped.filter((request) => request.status === "open").length;
  const inProgress = scoped.filter((request) => request.status === "in_progress").length;
  const emergency = scoped.filter((request) => request.priority === "emergency").length;

  return {
    toolName: "getMaintenanceSummary",
    summary: `${scoped.length} total maintenance request(s): ${open} open, ${inProgress} in progress, ${emergency} emergency.`,
    data: {
      total: scoped.length,
      open,
      inProgress,
      emergency,
      recent: scoped.slice(0, 10).map((request) => ({
        id: request.id,
        title: request.title,
        status: request.status,
        priority: request.priority,
        createdAt: request.createdAt,
      })),
    },
  };
}

export async function runAssistantTool(intent: AssistantIntent, user: User): Promise<AssistantToolResult | null> {
  if (intent === "highest_rent_property") return getHighestRentProperty(user);
  if (intent === "overdue_rent") return getOverdueRentSummary(user);
  if (intent === "maintenance_summary") return getMaintenanceSummary(user);
  return null;
}
