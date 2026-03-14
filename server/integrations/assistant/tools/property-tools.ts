import type { Property, User } from "@shared/schema";
import { storage } from "../../../storage";
import type { AssistantIntent } from "../router";
import type { AssistantChatMessage } from "../llm/ollama";

export type AssistantToolResult = {
  toolName: string;
  summary: string;
  data: Record<string, unknown>;
  action?: Record<string, unknown>;
};

function toMoney(value: string | number | null | undefined): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatAddress(input: { address: string; city: string; state: string; zipCode: string }): string {
  return `${input.address}, ${input.city}, ${input.state} ${input.zipCode}`;
}

function userExplicitlyAskedForIds(message?: string): boolean {
  const normalized = (message || "").toLowerCase();
  return (
    normalized.includes(" id") ||
    normalized.startsWith("id") ||
    normalized.includes("property id") ||
    normalized.includes("lease id") ||
    normalized.includes("payment id") ||
    normalized.includes("request id")
  );
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

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function sanitizeMaintenanceText(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/\bi want to\b/gi, "")
      .replace(/\bi need to\b/gi, "")
      .replace(/\b(create|submit|open|report)\b/gi, "")
      .replace(/\b(a|an)?\s*(maintenance request|repair request|work order)\b/gi, "")
      .replace(/\bfor property\s*#?\d+\b/gi, "")
      .replace(/\bproperty\s*#?\d+\b/gi, "")
      .replace(/\bwith (priority|title|description)\b/gi, "")
      .replace(/\bpriority\s*:\s*(emergency|high|medium|low)\b/gi, "")
      .replace(/\b(title|description)\s*:\s*/gi, "")
      .replace(/^[\s:,-]+|[\s:,-]+$/g, ""),
  );
}

function isMeaningfulMaintenanceDescription(value?: string): boolean {
  const normalized = normalizeWhitespace((value || "").toLowerCase());
  if (!normalized) return false;
  if (normalized.length < 12) return false;

  const genericPhrases = [
    "maintenance request",
    "repair request",
    "work order",
    "my property",
    "a request",
    "need help",
    "need maintenance",
    "need a maintenance request",
    "want maintenance",
    "want to create",
    "want to submit",
  ];

  if (genericPhrases.some((phrase) => normalized === phrase || normalized.includes(phrase))) {
    const issueKeywords = ["leak", "broken", "not working", "issue", "problem", "damage", "clog", "heat", "ac", "lock", "water", "toilet", "sink", "faucet"];
    if (!issueKeywords.some((keyword) => normalized.includes(keyword))) {
      return false;
    }
  }

  return true;
}

function inferMaintenanceTitle(description: string): string {
  const cleaned = sanitizeMaintenanceText(description);
  if (!cleaned) return "Maintenance issue";
  const shortened = cleaned.split(/[.!?]/)[0]?.trim() || cleaned;
  return toTitleCase(shortened.split(" ").slice(0, 8).join(" "));
}

function extractMaintenanceDraft(text: string) {
  const propertyMatch = text.match(/\bproperty\s*#?\s*(\d+)\b/i);
  const priorityMatch = text.match(/\b(emergency|high|medium|low)\b/i);
  const titleMatch = text.match(/\btitle\s*:\s*(.+?)(?=\bdescription\s*:|$)/i);
  const descriptionMatch = text.match(/\bdescription\s*:\s*(.+)$/i);
  const sanitized = sanitizeMaintenanceText(text);

  return {
    propertyId: propertyMatch ? Number(propertyMatch[1]) : undefined,
    priority: priorityMatch?.[1]?.toLowerCase(),
    title: normalizeWhitespace(titleMatch?.[1] || "") || undefined,
    description: isMeaningfulMaintenanceDescription(descriptionMatch?.[1])
      ? normalizeWhitespace(descriptionMatch?.[1] || "")
      : isMeaningfulMaintenanceDescription(sanitized)
        ? sanitized
        : undefined,
  };
}

function mergeMaintenanceDrafts(history: AssistantChatMessage[], message: string) {
  const merged = { propertyId: undefined as number | undefined, priority: undefined as string | undefined, title: undefined as string | undefined, description: undefined as string | undefined };
  for (const item of [...history, { role: "user" as const, content: message }]) {
    if (item.role !== "user") continue;
    const draft = extractMaintenanceDraft(item.content);
    merged.propertyId = draft.propertyId ?? merged.propertyId;
    merged.priority = draft.priority ?? merged.priority;
    merged.title = draft.title ?? merged.title;
    merged.description = draft.description ?? merged.description;
  }
  if (!merged.title && merged.description) {
    merged.title = inferMaintenanceTitle(merged.description);
  }
  return merged;
}

async function getAccessibleProperties(user: User): Promise<Property[]> {
  if (user.role === "manager") {
    return storage.getPropertiesByManager(user.id);
  }
  if (user.role === "tenant") {
    const leases = await storage.getLeasesByTenant(user.id);
    const propertyIds = new Set(
      leases
        .filter((lease) => lease.status === "active")
        .map((lease) => lease.propertyId),
    );
    const allProperties = await storage.getProperties();
    return allProperties.filter((property) => propertyIds.has(property.id));
  }
  return [];
}

async function createMaintenanceRequestFromChat(
  user: User,
  history: AssistantChatMessage[],
  message: string,
): Promise<AssistantToolResult> {
  if (user.role !== "tenant") {
    return {
      toolName: "createMaintenanceRequest",
      summary: "Maintenance request creation through chat is currently available for tenant accounts only.",
      data: {
        status: "unsupported_role",
        role: user.role,
      },
      action: {
        type: "maintenance_request",
        status: "unsupported_role",
      },
    };
  }

  const properties = await getAccessibleProperties(user);
  const draft = mergeMaintenanceDrafts(history, message);
  const resolvedPropertyId = draft.propertyId ?? (properties.length === 1 ? properties[0]?.id : undefined);

  if (!resolvedPropertyId) {
    return {
      toolName: "createMaintenanceRequest",
      summary:
        properties.length > 0
          ? `Which property is this for?\n- ${properties.map((property) => formatAddress(property)).join("\n- ")}`
          : "Which property is this for?",
      data: {
        status: "needs_input",
        missingFields: ["propertyId"],
        availableProperties: properties.map((property) => ({
          id: property.id,
          address: formatAddress(property),
        })),
      },
      action: {
        type: "maintenance_request",
        status: "needs_input",
        missingFields: ["propertyId"],
      },
    };
  }

  const property = properties.find((item) => item.id === resolvedPropertyId);
  if (!property) {
    return {
      toolName: "createMaintenanceRequest",
      summary: `Property ${resolvedPropertyId} is not available for this user.`,
      data: {
        status: "error",
        propertyId: resolvedPropertyId,
      },
      action: {
        type: "maintenance_request",
        status: "error",
      },
    };
  }

  if (!draft.description) {
    return {
      toolName: "createMaintenanceRequest",
      summary: `What issue should I include in the request for ${formatAddress(property)}?`,
      data: {
        status: "needs_input",
        missingFields: ["description"],
        propertyId: property.id,
        propertyAddress: formatAddress(property),
      },
      action: {
        type: "maintenance_request",
        status: "needs_input",
        missingFields: ["description"],
      },
    };
  }

  const title = draft.title || inferMaintenanceTitle(draft.description);
  const priority = (draft.priority || "medium") as "low" | "medium" | "high" | "emergency";

  const request = await storage.createMaintenanceRequest({
    propertyId: property.id,
    tenantId: user.id,
    title,
    description: draft.description,
    priority,
    status: "open",
  });

  return {
    toolName: "createMaintenanceRequest",
    summary: `Your maintenance request is submitted.\n- Property: ${formatAddress(property)}\n- Issue: ${request.title}\n- Priority: ${request.priority}`,
    data: {
      status: "created",
      requestId: request.id,
      propertyId: property.id,
      propertyAddress: formatAddress(property),
      title: request.title,
      priority: request.priority,
    },
    action: {
      type: "maintenance_request",
      status: "created",
      requestId: request.id,
    },
  };
}

async function getHighestRentProperty(user: User, message?: string): Promise<AssistantToolResult> {
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
  const includeIds = userExplicitlyAskedForIds(message);
  return {
    toolName: "getHighestRentProperty",
    summary: `Highest rent is $${rent.toFixed(2)} at ${formatAddress(property)}.`,
    data: {
      found: true,
      rentAmount: rent,
      status: highest.status,
      address: formatAddress(property),
      ...(includeIds ? { propertyId: property.id, leaseId: highest.id } : {}),
    },
  };
}

async function getOverdueRentSummary(user: User, message?: string): Promise<AssistantToolResult> {
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
  const includeIds = userExplicitlyAskedForIds(message);
  const items = overdue.slice(0, 10).map((payment) => {
    const lease = leases.find((l) => l.id === payment.leaseId);
    const property = lease ? propertyById.get(lease.propertyId) : undefined;
    return {
      amount: toMoney(payment.amount),
      date: payment.date,
      propertyAddress: property ? formatAddress(property) : "Unknown property",
      ...(includeIds ? { paymentId: payment.id, leaseId: payment.leaseId } : {}),
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

async function getMaintenanceSummary(user: User, message?: string): Promise<AssistantToolResult> {
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
  const includeIds = userExplicitlyAskedForIds(message);

  return {
    toolName: "getMaintenanceSummary",
    summary: `${scoped.length} total maintenance request(s): ${open} open, ${inProgress} in progress, ${emergency} emergency.`,
    data: {
      total: scoped.length,
      open,
      inProgress,
      emergency,
      recent: scoped.slice(0, 10).map((request) => ({
        title: request.title,
        status: request.status,
        priority: request.priority,
        createdAt: request.createdAt,
        ...(includeIds ? { id: request.id } : {}),
      })),
    },
  };
}

export async function runAssistantTool(
  intent: AssistantIntent,
  user: User,
  options?: { history?: AssistantChatMessage[]; message?: string },
): Promise<AssistantToolResult | null> {
  if (intent === "highest_rent_property") return getHighestRentProperty(user, options?.message);
  if (intent === "overdue_rent") return getOverdueRentSummary(user, options?.message);
  if (intent === "maintenance_summary") return getMaintenanceSummary(user, options?.message);
  if (intent === "create_maintenance_request") {
    return createMaintenanceRequestFromChat(user, options?.history ?? [], options?.message ?? "");
  }
  return null;
}
