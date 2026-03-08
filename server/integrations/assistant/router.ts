export type AssistantIntent =
  | "highest_rent_property"
  | "overdue_rent"
  | "maintenance_summary"
  | "general";

export type AssistantMode = "tool" | "rag" | "hybrid" | "general";

export type AssistantRoute = {
  intent: AssistantIntent;
  mode: AssistantMode;
};

export function routeAssistantIntent(message: string): AssistantRoute {
  const normalized = message.toLowerCase();
  const wantsRag =
    normalized.includes("policy") ||
    normalized.includes("lease clause") ||
    normalized.includes("document") ||
    normalized.includes("guide") ||
    normalized.includes("how do i") ||
    normalized.includes("what does the lease say");

  const wantsStructured =
    normalized.includes("highest rent") ||
    normalized.includes("most expensive rent") ||
    normalized.includes("top rent") ||
    normalized.includes("overdue") ||
    normalized.includes("late payment") ||
    normalized.includes("unpaid rent") ||
    normalized.includes("maintenance") ||
    normalized.includes("repair request") ||
    normalized.includes("work order");

  if (
    normalized.includes("highest rent") ||
    normalized.includes("most expensive rent") ||
    normalized.includes("top rent")
  ) {
    return {
      intent: "highest_rent_property",
      mode: wantsRag ? "hybrid" : "tool",
    };
  }

  if (normalized.includes("overdue") || normalized.includes("late payment") || normalized.includes("unpaid rent")) {
    return {
      intent: "overdue_rent",
      mode: wantsRag ? "hybrid" : "tool",
    };
  }

  if (
    normalized.includes("maintenance") ||
    normalized.includes("repair request") ||
    normalized.includes("work order")
  ) {
    return {
      intent: "maintenance_summary",
      mode: wantsRag ? "hybrid" : "tool",
    };
  }

  if (wantsRag && wantsStructured) {
    return { intent: "general", mode: "hybrid" };
  }
  if (wantsRag) {
    return { intent: "general", mode: "rag" };
  }
  if (wantsStructured) {
    return { intent: "general", mode: "tool" };
  }
  return { intent: "general", mode: "general" };
}
