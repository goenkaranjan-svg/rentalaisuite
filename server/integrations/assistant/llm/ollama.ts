import OpenAI from "openai";

export type AssistantChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantLlmInput = {
  systemPrompt: string;
  history: AssistantChatMessage[];
  userPrompt: string;
};

type LlmProvider = "ollama" | "openai";

function resolveProviderClient(provider: LlmProvider) {
  if (provider === "ollama") {
    const baseUrl = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
    return {
      client: new OpenAI({
        apiKey: process.env.OLLAMA_API_KEY || "ollama",
        baseURL: `${baseUrl}/v1`,
      }),
      model: process.env.OLLAMA_MODEL || "llama3.1:8b-instruct",
      provider,
    };
  }

  return {
    client: new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "sk-placeholder",
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    }),
    model: process.env.AI_ASSISTANT_MODEL || "gpt-4.1-mini",
    provider,
  };
}

async function requestCompletion(input: AssistantLlmInput, provider: LlmProvider): Promise<string> {
  const { client, model } = resolveProviderClient(provider);
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: input.systemPrompt },
      ...input.history,
      { role: "user", content: input.userPrompt },
    ],
    max_tokens: 500,
    temperature: 0.2,
  });

  const reply = completion.choices[0]?.message?.content?.trim();
  if (!reply) {
    throw new Error("LLM returned empty content.");
  }
  return reply;
}

function getPrimaryProvider(): LlmProvider {
  const provider = (process.env.ASSISTANT_LLM_PROVIDER || "ollama").toLowerCase();
  return provider === "openai" ? "openai" : "ollama";
}

function getFallbackProvider(primary: LlmProvider): LlmProvider | null {
  const configured = (process.env.ASSISTANT_FALLBACK_PROVIDER || "").toLowerCase();
  if (configured === "openai" && primary !== "openai") return "openai";
  if (configured === "ollama" && primary !== "ollama") return "ollama";
  if (!configured) {
    return primary === "ollama" ? "openai" : "ollama";
  }
  return null;
}

export async function generateAssistantCompletion(input: AssistantLlmInput): Promise<{
  reply: string;
  providerUsed: LlmProvider;
  usedFallback: boolean;
}> {
  const primary = getPrimaryProvider();
  try {
    const reply = await requestCompletion(input, primary);
    return { reply, providerUsed: primary, usedFallback: false };
  } catch (primaryError) {
    const fallback = getFallbackProvider(primary);
    if (!fallback) throw primaryError;
    const reply = await requestCompletion(input, fallback);
    return { reply, providerUsed: fallback, usedFallback: true };
  }
}
