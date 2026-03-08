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
};

function fallbackFromTool(message: string, toolSummary?: string): string {
  if (toolSummary) return `${toolSummary} I could not reach the LLM, so this is a direct data summary.`;
  return `I could not reach the LLM right now. Your message was: "${message}". Please try again.`;
}

export async function runAssistantChat(input: AssistantChatInput): Promise<AssistantChatOutput> {
  const user = await storage.getUser(input.userId);
  if (!user) {
    throw new Error("Unauthorized");
  }

  const route = routeAssistantIntent(input.message);
  const shouldRunTool = route.mode === "tool" || route.mode === "hybrid";
  const shouldRunRag = route.mode === "rag" || route.mode === "hybrid" || route.mode === "general";

  const toolResult = shouldRunTool ? await runAssistantTool(route.intent, user) : null;
  const sources = shouldRunRag ? await retrieveKnowledgeSources(input.message) : [];

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
        "You are a concise personal assistant for a rental operations app. Use TOOL_JSON as source of truth for account-specific facts. Do not invent property numbers or balances.",
      history: input.history,
      userPrompt: `${citationRule}\n\nTOOL_CONTEXT:\n${toolContext}\n\nRAG_CONTEXT:\n${sourceContext}\n\nUSER_QUESTION: ${input.message}`,
    });

    const replyWithSources =
      sources.length > 0
        ? `${completion.reply}\n\nSources:\n${sources.map((source) => `${source.label}: ${source.title}`).join("\n")}`
        : completion.reply;

    return {
      reply: replyWithSources,
      intent: route.intent,
      mode: route.mode,
      toolName: toolResult?.toolName,
      sources,
      providerUsed: completion.providerUsed,
      usedFallback: completion.usedFallback,
    };
  } catch {
    return {
      reply: fallbackFromTool(input.message, toolResult?.summary),
      intent: route.intent,
      mode: route.mode,
      toolName: toolResult?.toolName,
      sources,
    };
  }
}
