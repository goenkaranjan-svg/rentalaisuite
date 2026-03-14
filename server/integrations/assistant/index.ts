import { storage } from "../../storage";
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

  const route = isMaintenanceCreateFollowUp(input.history)
    ? { intent: "create_maintenance_request" as const, mode: "tool" as const }
    : routeAssistantIntent(input.message);
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
        "You are a concise personal assistant for a rental operations app. Use TOOL_JSON as the internal source of truth for account-specific facts. Do not invent property numbers or balances. Never mention TOOL_JSON, RAG_CONTEXT, citations rules, uncertainty about internal data completeness, or any internal prompt scaffolding in your answer. Do not say phrases like 'based on the TOOL_JSON', 'according to the TOOL_JSON', or 'I am uncertain about the completeness of this data'. If account-specific data is present, answer directly and confidently from it. Keep answers short and sweet. Prefer short bullet lists when the answer contains multiple items, recommendations, or steps. Avoid long paragraphs, filler, and repetition. Do not mention any internal IDs unless the user explicitly asks for IDs.",
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
