-- StudyMind AI initial schema
-- Run in Supabase SQL editor or via supabase db push
create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz default now()
);

-- documents
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  file_path text,
  file_type text not null,
  status text not null default 'uploading' check (status in ('uploading','extracting','embedding','ready','failed')),
  page_count int default 0,
  char_count int default 0,
  error_message text,
  created_at timestamptz default now()
);
create index if not exists idx_documents_user on public.documents(user_id);

-- document chunks (embedding dim configurable, default 1536)
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  embedding vector(1536),
  page_number int default 1,
  chunk_index int default 0,
  token_count int default 0,
  created_at timestamptz default now()
);
create index if not exists idx_chunks_doc on public.document_chunks(document_id);
-- HNSW cosine index (pgvector >= 0.5)
create index if not exists idx_chunks_embedding on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

-- similarity search function
create or replace function public.match_chunks(
  query_embedding vector(1536),
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

-- quizzes
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  config jsonb not null default '{}',
  questions jsonb not null default '[]',
  created_at timestamptz default now()
);

-- quiz attempts
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score int not null default 0,
  total int not null default 0,
  duration_sec int default 0,
  answers jsonb default '[]',
  created_at timestamptz default now()
);
create index if not exists idx_attempts_user on public.quiz_attempts(user_id);

-- per-question results
create table if not exists public.question_results (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_ref text not null,
  topic text,
  is_correct boolean not null
);

-- flashcards
create table if not exists public.flashcard_sets (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text default 'Flashcards',
  created_at timestamptz default now()
);
create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.flashcard_sets(id) on delete cascade,
  front text not null,
  back text not null,
  status text default 'new' check (status in ('new','known','review')),
  next_review timestamptz default now(),
  created_at timestamptz default now()
);

-- summaries
create table if not exists public.summaries (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('concise','keypoints','revision')),
  content text not null,
  created_at timestamptz default now()
);

-- exam questions
create table if not exists public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  marks int not null,
  question text not null,
  answer_outline text not null,
  topic text,
  created_at timestamptz default now()
);

-- chat
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text default 'Chat',
  created_at timestamptz default now()
);
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  sources jsonb default '[]',
  created_at timestamptz default now()
);
create index if not exists idx_messages_session on public.chat_messages(session_id);
