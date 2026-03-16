import { storage } from "../../storage";
import type { User } from "@shared/schema";
import { routeAssistantIntent } from "./router";
import { generateAssistantCompletion, type AssistantChatMessage } from "./llm/ollama";
import { runAssistantTool } from "./tools/property-tools";
import { retrieveKnowledgeSources, type AssistantSource } from "./rag/retriever";

export type AssistantChatInput = {
  userId: string;
  message: string;
  history: AssistantChatMessage[];
};

export type AssistantChatOutput = {
  reply: string;
  intent: string;
  mode: string;
  toolName?: string;
  sources?: AssistantSource[];
  providerUsed?: string;
  usedFallback?: boolean;
  action?: Record<string, unknown>;
};

const ROLE_INTENT_ALLOWLIST: Record<User["role"], string[]> = {
  manager: ["highest_rent_property", "overdue_rent", "rent_payment_details", "maintenance_summary", "general"],
  tenant: ["overdue_rent", "rent_payment_details", "maintenance_summary", "create_maintenance_request", "general"],
  investor: ["general"],
};

const ROLE_RESTRICTION_COPY: Record<User["role"], string> = {
  manager:
    "I can only answer manager-specific questions about your rental operations account, properties, leases, payments, maintenance, and related documents.",
  tenant:
    "I can only answer tenant-specific questions about your lease, rent, payments, maintenance requests, and renter documents.",
  investor:
    "I can only answer investor-specific questions about your investor portal, deals, portfolio, and investor documents.",
};

const ROLE_BLOCKED_PATTERNS: Record<User["role"], RegExp[]> = {
  manager: [
    /\btenant portal\b/i,
    /\bpay my rent\b/i,
    /\bmy apartment\b/i,
    /\bmy unit\b/i,
    /\binvestor portal\b/i,
    /\bcap rate\b/i,
    /\bnoi\b/i,
    /\bcash flow\b/i,
    /\bmultifamily\b/i,
  ],
  tenant: [
    /\ball properties\b/i,
    /\ball tenants\b/i,
    /\bother tenants\b/i,
    /\bportfolio\b/i,
    /\bscreenings?\b/i,
    /\bvendors?\b/i,
    /\bowner reports?\b/i,
    /\baccounting\b/i,
    /\bproperty manager\b/i,
    /\binvestor portal\b/i,
    /\bcap rate\b/i,
    /\bnoi\b/i,
    /\bcash flow\b/i,
    /\bmultifamily\b/i,
    /\bdeal pipeline\b/i,
  ],
  investor: [
    /\bmaintenance request\b/i,
    /\brepair request\b/i,
    /\bwork order\b/i,
    /\btenant portal\b/i,
    /\bpay my rent\b/i,
    /\bmove[- ]?in\b/i,
    /\bmove[- ]?out\b/i,
    /\bscreenings?\b/i,
    /\bvendors?\b/i,
    /\blease signing\b/i,
    /\bproperty manager dashboard\b/i,
  ],
};

const ROLE_ALLOWED_PATTERNS: Record<User["role"], RegExp[]> = {
  manager: [
    /\bproperty|properties\b/i,
    /\blease|leases\b/i,
    /\brent|payment|payments|overdue\b/i,
    /\bmaintenance|repair|work order\b/i,
    /\btenant|tenants\b/i,
    /\bdocument|documents|policy|guide\b/i,
    /\bscreening|screenings\b/i,
  ],
  tenant: [
    /\blease|current lease|agreement\b/i,
    /\brent|payment|payments|balance|late fee\b/i,
    /\bmaintenance|repair|work order|issue\b/i,
    /\brenter document|renter documents|document|documents\b/i,
    /\bmove[- ]?out|move[- ]?in|notice period\b/i,
    /\bmy account|through my account|portal\b/i,
  ],
  investor: [
    /\binvestor portal\b/i,
    /\bportfolio\b/i,
    /\bdeal|deals\b/i,
    /\bmultifamily\b/i,
    /\bcap rate|noi|cash flow\b/i,
    /\bdocument|documents|policy|guide\b/i,
  ],
};

function isRoleRestrictedQuery(user: User, message: string, route: ReturnType<typeof routeAssistantIntent>) {
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return ROLE_RESTRICTION_COPY[user.role];
  }

  const allowedIntents = ROLE_INTENT_ALLOWLIST[user.role];
  const allowedPatterns = ROLE_ALLOWED_PATTERNS[user.role];
  const matchesAllowedScope = allowedPatterns.some((pattern) => pattern.test(message));

  if (route.mode === "general" && !matchesAllowedScope) {
    return `${ROLE_RESTRICTION_COPY[user.role]} Ask about your own account or role-specific workflows.`;
  }

  if (!allowedIntents.includes(route.intent) && !matchesAllowedScope) {
    return ROLE_RESTRICTION_COPY[user.role];
  }

  const blockedPatterns = ROLE_BLOCKED_PATTERNS[user.role];
  if (blockedPatterns.some((pattern) => pattern.test(message))) {
    return ROLE_RESTRICTION_COPY[user.role];
  }

  return null;
}

function isMaintenanceCreateFollowUp(history: AssistantChatMessage[]): boolean {
  const lastAssistant = [...history].reverse().find((message) => message.role === "assistant");
  if (!lastAssistant) return false;
  const normalized = lastAssistant.content.toLowerCase();
  return (
    normalized.includes("which property is this for") ||
    normalized.includes("what issue should i include in the request") ||
      normalized.includes("i can create that maintenance request")
  );
}

function isInformationalMaintenanceQuestion(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return (
    (normalized.startsWith("how ") ||
      normalized.startsWith("what ") ||
      normalized.startsWith("can ") ||
      normalized.startsWith("where ") ||
      normalized.startsWith("when ")) &&
    (normalized.includes("maintenance") ||
      normalized.includes("repair request") ||
      normalized.includes("work order"))
  );
}

function fallbackFromTool(message: string, toolSummary?: string): string {
  if (toolSummary) return `${toolSummary} I could not reach the LLM, so this is a direct data summary.`;
  return `I could not reach the LLM right now. Your message was: "${message}". Please try again.`;
}

function sanitizeAssistantReply(reply: string): string {
  return reply
    .replace(/^please note that this information is based on the tool_json provided,?\s*/i, "")
    .replace(/^based on the tool_json provided,?\s*/i, "")
    .replace(/^according to the tool_json,?\s*/i, "")
    .replace(/^i am uncertain about the completeness or accuracy of this data\.?\s*/i, "")
    .replace(/^please note that\s*/i, "")
    .replace(/\s+\*\s+/g, "\n- ")
    .replace(/:\s+- /g, ":\n- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function runAssistantChat(input: AssistantChatInput): Promise<AssistantChatOutput> {
  const user = await storage.getUser(input.userId);
  if (!user) {
    throw new Error("Unauthorized");
  }

  const route = isMaintenanceCreateFollowUp(input.history) && !isInformationalMaintenanceQuestion(input.message)
    ? { intent: "create_maintenance_request" as const, mode: "tool" as const }
    : routeAssistantIntent(input.message);
  const restrictionMessage = isRoleRestrictedQuery(user, input.message, route);
  if (restrictionMessage) {
    return {
      reply: restrictionMessage,
      intent: route.intent,
      mode: route.mode,
    };
  }
  const shouldRunTool = route.mode === "tool" || route.mode === "hybrid";
  const shouldRunRag = route.mode === "rag" || route.mode === "hybrid" || route.mode === "general";

  const toolResult = shouldRunTool
    ? await runAssistantTool(route.intent, user, { history: input.history, message: input.message })
    : null;
  const sources = shouldRunRag ? await retrieveKnowledgeSources(input.message) : [];

  if (route.intent === "create_maintenance_request" && toolResult) {
    return {
      reply: toolResult.summary,
      intent: route.intent,
      mode: route.mode,
      toolName: toolResult.toolName,
      sources: [],
      action: toolResult.action,
    };
  }

  const toolContext = toolResult
    ? `TOOL_NAME: ${toolResult.toolName}\nTOOL_SUMMARY: ${toolResult.summary}\nTOOL_JSON: ${JSON.stringify(toolResult.data)}`
    : "TOOL_NAME: none\nTOOL_SUMMARY: none\nTOOL_JSON: {}";
  const sourceContext =
    sources.length > 0
      ? sources.map((source) => `${source.label}: ${source.title}\n${source.snippet}`).join("\n\n")
      : "No retrieved knowledge sources.";
  const citationRule =
    sources.length > 0
      ? "Cite supporting statements with source labels like [S1], [S2]. If unsure, say it is unknown."
      : "No sources are available, so answer without citations and acknowledge uncertainty where needed.";

  try {
    const completion = await generateAssistantCompletion({
      systemPrompt:
        `You are a concise personal assistant for a rental operations app serving a ${user.role}. Answer only within this user's role and only for this user's own account context. Refuse requests that are unrelated, cross-role, or ask about data outside the user's scope. Use TOOL_JSON as the internal source of truth for account-specific facts. Do not invent property numbers or balances. Never mention TOOL_JSON, RAG_CONTEXT, citations rules, uncertainty about internal data completeness, or any internal prompt scaffolding in your answer. Do not say phrases like 'based on the TOOL_JSON', 'according to the TOOL_JSON', or 'I am uncertain about the completeness of this data'. If account-specific data is present, answer directly and confidently from it. Keep answers short and sweet. Prefer short bullet lists when the answer contains multiple items, recommendations, or steps. Avoid long paragraphs, filler, and repetition. Do not mention any internal IDs unless the user explicitly asks for IDs.`,
      history: input.history,
      userPrompt: `${citationRule}\n\nTOOL_CONTEXT:\n${toolContext}\n\nRAG_CONTEXT:\n${sourceContext}\n\nUSER_QUESTION: ${input.message}`,
    });

    const replyWithSources =
      sources.length > 0
        ? `${sanitizeAssistantReply(completion.reply)}\n\nSources:\n${sources.map((source) => `${source.label}: ${source.title}`).join("\n")}`
        : sanitizeAssistantReply(completion.reply);

    return {
      reply: replyWithSources,
      intent: route.intent,
      mode: route.mode,
      toolName: toolResult?.toolName,
      sources,
      providerUsed: completion.providerUsed,
      usedFallback: completion.usedFallback,
      action: toolResult?.action,
    };
  } catch {
    return {
      reply: fallbackFromTool(input.message, toolResult?.summary),
      intent: route.intent,
      mode: route.mode,
      toolName: toolResult?.toolName,
      sources,
      action: toolResult?.action,
    };
  }
}
