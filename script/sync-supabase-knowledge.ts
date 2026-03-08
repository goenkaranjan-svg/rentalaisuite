import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createAssistantEmbedding } from "../server/integrations/assistant/rag/embeddings";

type KnowledgeDocument = {
  sourcePath: string;
  title: string;
  content: string;
};

type ChunkRow = {
  document_id: string;
  chunk_index: number;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
};

const KNOWLEDGE_DOCUMENTS_TABLE = process.env.SUPABASE_KNOWLEDGE_DOCUMENTS_TABLE || "knowledge_documents";
const KNOWLEDGE_CHUNKS_TABLE = process.env.SUPABASE_KNOWLEDGE_CHUNKS_TABLE || "knowledge_chunks";
const CHUNK_SIZE = Number(process.env.ASSISTANT_KNOWLEDGE_CHUNK_SIZE || 1200);
const CHUNK_OVERLAP = Number(process.env.ASSISTANT_KNOWLEDGE_CHUNK_OVERLAP || 200);
const EMBED_BATCH_SIZE = Number(process.env.ASSISTANT_KNOWLEDGE_EMBED_BATCH || 8);

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !secretKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
  }
  return { supabaseUrl: supabaseUrl.replace(/\/+$/, ""), secretKey };
}

async function walkFiles(targetPath: string): Promise<string[]> {
  const stat = await fs.stat(targetPath);
  if (stat.isFile()) return [targetPath];

  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith("."))
      .map((entry) => walkFiles(path.join(targetPath, entry.name))),
  );
  return nested.flat();
}

function defaultKnowledgePaths(cwd: string): string[] {
  return [
    "SETUP.md",
    "LAUNCH_SECURITY_CHECKLIST.md",
    "OIDC_SETUP.md",
    "QUICK_OIDC_SETUP.md",
    "AUTH0_SETUP_ALTERNATIVE.md",
  ].map((relativePath) => path.join(cwd, relativePath));
}

async function resolveKnowledgePaths(cwd: string): Promise<string[]> {
  const configured = (process.env.ASSISTANT_KNOWLEDGE_PATHS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const inputPaths = configured.length > 0 ? configured.map((item) => path.resolve(cwd, item)) : defaultKnowledgePaths(cwd);

  const all = (
    await Promise.all(
      inputPaths.map(async (inputPath) => {
        try {
          return await walkFiles(inputPath);
        } catch {
          return [];
        }
      }),
    )
  ).flat();

  return Array.from(
    new Set(
      all.filter((filePath) => /\.(md|txt)$/i.test(filePath)).sort((a, b) => a.localeCompare(b)),
    ),
  );
}

function extractTitle(content: string, fallbackPath: string): string {
  const heading = content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /^#\s+/.test(line));
  if (heading) return heading.replace(/^#\s+/, "").trim();
  return path.basename(fallbackPath);
}

function makeDocumentId(sourcePath: string): string {
  return createHash("sha256").update(sourcePath).digest("hex").slice(0, 32);
}

function chunkText(content: string): string[] {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  let index = 0;

  while (index < normalized.length) {
    const end = Math.min(index + CHUNK_SIZE, normalized.length);
    const chunk = normalized.slice(index, end).trim();
    if (chunk.length > 0) chunks.push(chunk);
    if (end >= normalized.length) break;
    index = Math.max(end - CHUNK_OVERLAP, index + 1);
  }

  return chunks;
}

async function readDocuments(filePaths: string[], cwd: string): Promise<KnowledgeDocument[]> {
  const docs: KnowledgeDocument[] = [];
  for (const filePath of filePaths) {
    const content = await fs.readFile(filePath, "utf8");
    if (!content.trim()) continue;
    const sourcePath = path.relative(cwd, filePath);
    docs.push({
      sourcePath,
      title: extractTitle(content, filePath),
      content,
    });
  }
  return docs;
}

async function supabaseRequest(
  url: string,
  init: RequestInit,
  serviceRoleKey: string,
): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(init.headers || {}),
    },
  });
}

async function upsertDocument(
  supabaseUrl: string,
  serviceRoleKey: string,
  document: KnowledgeDocument,
): Promise<string> {
  const docId = makeDocumentId(document.sourcePath);
  const endpoint = `${supabaseUrl}/rest/v1/${KNOWLEDGE_DOCUMENTS_TABLE}?on_conflict=id&select=id`;
  const payload = [
    {
      id: docId,
      source_path: document.sourcePath,
      title: document.title,
      metadata: {
        sourcePath: document.sourcePath,
      },
      updated_at: new Date().toISOString(),
    },
  ];

  const response = await supabaseRequest(
    endpoint,
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(payload),
    },
    serviceRoleKey,
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Document upsert failed for ${document.sourcePath} (${response.status}): ${body.slice(0, 220)}`);
  }

  const rows = (await response.json().catch(() => [])) as Array<{ id?: string }>;
  const returnedId = rows?.[0]?.id;
  return returnedId || docId;
}

async function replaceDocumentChunks(
  supabaseUrl: string,
  serviceRoleKey: string,
  document: KnowledgeDocument,
  documentId: string,
): Promise<number> {
  const chunks = chunkText(document.content);
  if (chunks.length === 0) return 0;

  const deleteUrl = `${supabaseUrl}/rest/v1/${KNOWLEDGE_CHUNKS_TABLE}?document_id=eq.${encodeURIComponent(documentId)}`;
  const deleteResponse = await supabaseRequest(
    deleteUrl,
    {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    },
    serviceRoleKey,
  );
  if (!deleteResponse.ok) {
    const body = await deleteResponse.text().catch(() => "");
    throw new Error(`Failed deleting old chunks for ${document.sourcePath} (${deleteResponse.status}): ${body.slice(0, 220)}`);
  }

  const rows: ChunkRow[] = [];
  for (let start = 0; start < chunks.length; start += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(start, start + EMBED_BATCH_SIZE);
    const embeddings = await Promise.all(batch.map((chunk) => createAssistantEmbedding(chunk)));
    batch.forEach((chunk, offset) => {
      rows.push({
        document_id: documentId,
        chunk_index: start + offset,
        content: chunk,
        embedding: embeddings[offset],
        metadata: {
          sourcePath: document.sourcePath,
          title: document.title,
          chunkIndex: start + offset,
        },
      });
    });
  }

  const insertUrl = `${supabaseUrl}/rest/v1/${KNOWLEDGE_CHUNKS_TABLE}`;
  const insertResponse = await supabaseRequest(
    insertUrl,
    {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(rows),
    },
    serviceRoleKey,
  );
  if (!insertResponse.ok) {
    const body = await insertResponse.text().catch(() => "");
    throw new Error(`Chunk insert failed for ${document.sourcePath} (${insertResponse.status}): ${body.slice(0, 220)}`);
  }

  return rows.length;
}

async function run() {
  const cwd = process.cwd();
  const { supabaseUrl, secretKey } = getSupabaseConfig();
  const filePaths = await resolveKnowledgePaths(cwd);

  if (filePaths.length === 0) {
    console.log("[assistant-sync] No source files found. Set ASSISTANT_KNOWLEDGE_PATHS.");
    return;
  }

  const documents = await readDocuments(filePaths, cwd);
  let totalChunks = 0;

  console.log(`[assistant-sync] Syncing ${documents.length} document(s) to Supabase Vector...`);

  for (const document of documents) {
    const documentId = await upsertDocument(supabaseUrl, secretKey, document);
    const chunkCount = await replaceDocumentChunks(supabaseUrl, secretKey, document, documentId);
    totalChunks += chunkCount;
    console.log(`[assistant-sync] ${document.sourcePath} -> ${chunkCount} chunk(s)`);
  }

  console.log(`[assistant-sync] Done. ${documents.length} document(s), ${totalChunks} chunk(s).`);
}

run().catch((error) => {
  console.error("[assistant-sync] Failed:", error);
  process.exit(1);
});
