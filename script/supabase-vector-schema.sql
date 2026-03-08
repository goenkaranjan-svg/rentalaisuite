-- Run this in your Supabase SQL editor.
-- If you use a different embedding model dimension, update vector(768) accordingly.

create extension if not exists vector;

create table if not exists public.knowledge_documents (
  id text primary key,
  source_path text not null unique,
  title text not null,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_chunks (
  id bigserial primary key,
  document_id text not null references public.knowledge_documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(768) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(document_id, chunk_index)
);

create index if not exists knowledge_chunks_document_id_idx on public.knowledge_chunks (document_id);
create index if not exists knowledge_chunks_embedding_hnsw_idx
  on public.knowledge_chunks using hnsw (embedding vector_cosine_ops);

create or replace function public.match_knowledge_chunks(
  query_embedding vector(768),
  match_count int default 4,
  match_threshold float default 0.65,
  query_text text default null
)
returns table (
  id bigint,
  content text,
  title text,
  source text,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    c.id,
    c.content,
    d.title,
    d.source_path as source,
    c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks c
  join public.knowledge_documents d on d.id = c.document_id
  where 1 - (c.embedding <=> query_embedding) >= match_threshold
  order by c.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;
