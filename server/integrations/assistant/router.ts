export type AssistantIntent =
  | "highest_rent_property"
  | "overdue_rent"
  | "rent_payment_details"
  | "maintenance_summary"
  | "create_maintenance_request"
  | "general";

export type AssistantMode = "tool" | "rag" | "hybrid" | "general";

export type AssistantRoute = {
  intent: AssistantIntent;
  mode: AssistantMode;
};

export function routeAssistantIntent(message: string): AssistantRoute {
  const normalized = message.toLowerCase();
  const asksHowToReportMaintenance =
    (normalized.includes("how should i") || normalized.includes("how do i") || normalized.includes("how can i")) &&
    (normalized.includes("report a maintenance issue") ||
      normalized.includes("report maintenance") ||
      normalized.includes("submit a maintenance request") ||
      normalized.includes("open a maintenance request") ||
      normalized.includes("create a maintenance request"));
  const asksAboutLeaseDocument =
    normalized.includes("lease clause") ||
    normalized.includes("what does the lease say") ||
    normalized.includes("current lease") ||
    normalized.includes("my lease") ||
    normalized.includes("lease summary") ||
    normalized.includes("lease terms") ||
    normalized.includes("important lease terms") ||
    ((normalized.includes("lease") || normalized.includes("agreement")) &&
      (normalized.includes("summarize") ||
        normalized.includes("summary") ||
        normalized.includes("review") ||
        normalized.includes("explain") ||
        normalized.includes("bullet")));
  const wantsRag =
    normalized.includes("policy") ||
    normalized.includes("document") ||
    normalized.includes("guide") ||
    normalized.includes("how do i") ||
    asksAboutLeaseDocument;

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
    normalized.includes("rent due") ||
    normalized.includes("when is my rent due") ||
    normalized.includes("rent amount") ||
    normalized.includes("monthly rent") ||
    normalized.includes("current rent") ||
    normalized.includes("payment status") ||
    normalized.includes("current balance") ||
    normalized.includes("next rent payment") ||
    normalized.includes("pay my rent")
  ) {
    return {
      intent: "rent_payment_details",
      mode: wantsRag ? "hybrid" : "tool",
    };
  }

  if (
    !asksHowToReportMaintenance &&
    (normalized.includes("create") ||
      normalized.includes("submit") ||
      normalized.includes("open") ||
      normalized.includes("report")) &&
    (normalized.includes("maintenance") ||
      normalized.includes("repair request") ||
      normalized.includes("work order") ||
      normalized.includes("fix") ||
      normalized.includes("broken"))
  ) {
    return {
      intent: "create_maintenance_request",
      mode: "tool",
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
