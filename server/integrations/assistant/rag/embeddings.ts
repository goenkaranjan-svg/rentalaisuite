import OpenAI from "openai";

export type EmbeddingProvider = "ollama" | "openai";

export function getEmbeddingProvider(): EmbeddingProvider {
  const provider = (process.env.ASSISTANT_EMBEDDING_PROVIDER || process.env.ASSISTANT_LLM_PROVIDER || "ollama").toLowerCase();
  return provider === "openai" ? "openai" : "ollama";
}

async function embedWithOllama(text: string): Promise<number[]> {
  const baseUrl = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
  const model = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";

  const response = await fetch(`${baseUrl}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: text }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Ollama embeddings failed (${response.status}): ${body.slice(0, 220)}`);
  }

  const body = await response.json().catch(() => ({} as any));
  const embedding = body?.embedding;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("Ollama embeddings returned invalid vector.");
  }
  return embedding;
}

async function embedWithOpenAI(text: string): Promise<number[]> {
  const client = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "sk-placeholder",
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
  const model = process.env.AI_ASSISTANT_EMBEDDING_MODEL || "text-embedding-3-small";
  const response = await client.embeddings.create({
    model,
    input: text,
  });
  const embedding = response.data?.[0]?.embedding;
  if (!embedding?.length) {
    throw new Error("OpenAI embeddings returned invalid vector.");
  }
  return embedding;
}

export async function createAssistantEmbedding(text: string): Promise<number[]> {
  const provider = getEmbeddingProvider();
  if (provider === "openai") {
    return embedWithOpenAI(text);
  }
  return embedWithOllama(text);
}
