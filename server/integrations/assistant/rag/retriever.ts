import { createAssistantEmbedding } from "./embeddings";

export type AssistantSource = {
  id: string;
  label: string;
  title: string;
  snippet: string;
  similarity?: number;
  metadata?: Record<string, unknown>;
};

type SupabaseMatchRow = {
  id?: string | number;
  content?: string;
  chunk_text?: string;
  text?: string;
  title?: string;
  source?: string;
  similarity?: number;
  metadata?: Record<string, unknown>;
};

function normalizeSnippet(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 500);
}

async function fetchSupabaseMatches(embedding: number[], query: string): Promise<SupabaseMatchRow[]> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !secretKey) return [];

  const rpcName = process.env.SUPABASE_VECTOR_RPC || "match_knowledge_chunks";
  const limit = Number(process.env.ASSISTANT_RAG_MATCH_COUNT || 4);
  const minSimilarity = Number(process.env.ASSISTANT_RAG_MIN_SIMILARITY || 0.65);
  const url = `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/rpc/${rpcName}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
    },
    body: JSON.stringify({
      query_embedding: embedding,
      match_count: Number.isFinite(limit) ? limit : 4,
      match_threshold: Number.isFinite(minSimilarity) ? minSimilarity : 0.65,
      query_text: query,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Supabase vector RPC failed (${response.status}): ${body.slice(0, 220)}`);
  }

  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

export async function retrieveKnowledgeSources(query: string): Promise<AssistantSource[]> {
  try {
    const embedding = await createAssistantEmbedding(query);
    const rows = await fetchSupabaseMatches(embedding, query);
    if (rows.length === 0) return [];

    return rows
      .map((row, index) => {
        const rawSnippet = row.content || row.chunk_text || row.text || "";
        const snippet = normalizeSnippet(rawSnippet);
        const label = `S${index + 1}`;
        const sourceTitle =
          String(row.title || row.source || (row.metadata as any)?.title || `Knowledge Source ${index + 1}`);
        return {
          id: String(row.id ?? `${index + 1}`),
          label,
          title: sourceTitle,
          snippet,
          similarity: typeof row.similarity === "number" ? row.similarity : undefined,
          metadata: row.metadata,
        };
      })
      .filter((source) => source.snippet.length > 0);
  } catch (error) {
    console.error("RAG retrieval failed:", error);
    return [];
  }
}
