-- OPTIONAL migration: switch embeddings to native Gemini 768-dim (100% free).
-- Only run this if you set EMBEDDING_DIM=768 and use Gemini embeddings.
-- WARNING: truncates existing vectors — re-upload documents afterwards.
alter table public.document_chunks alter column embedding type vector(768);

drop index if exists public.idx_chunks_embedding;
create index if not exists idx_chunks_embedding on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

create or replace function public.match_chunks(
  query_embedding vector(768),
  match_count int,
  doc_id uuid
)
returns table (id uuid, content text, page_number int, chunk_index int, similarity float)
language sql stable as $$
  select dc.id, dc.content, dc.page_number, dc.chunk_index,
         1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  where dc.document_id = doc_id
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;
