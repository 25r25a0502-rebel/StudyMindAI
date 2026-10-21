-- Row Level Security: users can only access their own rows
alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.question_results enable row level security;
alter table public.flashcard_sets enable row level security;
alter table public.flashcards enable row level security;
alter table public.summaries enable row level security;
alter table public.exam_questions enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

-- helper: owner check via auth.uid()
-- profiles
create policy "profiles_owner" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
-- documents
create policy "documents_owner" on public.documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- chunks
create policy "chunks_owner" on public.document_chunks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- quizzes
create policy "quizzes_owner" on public.quizzes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- attempts
create policy "attempts_owner" on public.quiz_attempts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- question_results: via parent attempt ownership
create policy "qresults_owner" on public.question_results for all using (
  exists (select 1 from public.quiz_attempts a where a.id = attempt_id and a.user_id = auth.uid())
) with check (
  exists (select 1 from public.quiz_attempts a where a.id = attempt_id and a.user_id = auth.uid())
);
-- flashcard sets
create policy "fsets_owner" on public.flashcard_sets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- flashcards via set ownership
create policy "fcards_owner" on public.flashcards for all using (
  exists (select 1 from public.flashcard_sets s where s.id = set_id and s.user_id = auth.uid())
) with check (
  exists (select 1 from public.flashcard_sets s where s.id = set_id and s.user_id = auth.uid())
);
-- summaries
create policy "summaries_owner" on public.summaries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- exam questions
create policy "examq_owner" on public.exam_questions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- chat sessions
create policy "chatsess_owner" on public.chat_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- chat messages via session ownership
create policy "chatmsg_owner" on public.chat_messages for all using (
  exists (select 1 from public.chat_sessions s where s.id = session_id and s.user_id = auth.uid())
) with check (
  exists (select 1 from public.chat_sessions s where s.id = session_id and s.user_id = auth.uid())
);

-- Storage bucket (create via dashboard or API; policy example):
-- insert into storage.buckets (id, name, public) values ('study-docs','study-docs', false)
-- on conflict do nothing;
-- create policy "storage_owner" on storage.objects for all using (bucket_id='study-docs' and auth.uid()::text = (storage.foldername(name))[1])
--   with check (bucket_id='study-docs' and auth.uid()::text = (storage.foldername(name))[1]);
