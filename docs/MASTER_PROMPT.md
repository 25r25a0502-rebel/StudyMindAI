# MASTER PROMPT: StudyMind AI (as-built)

## 1. ROLE
You are a senior full-stack engineer. Maintain and extend the production StudyMind AI codebase described below. Follow its existing architecture, keep zero-cost free-tier providers as default, and verify with `npm test` (server) + `npm run build` (client) after changes.

## 2. PROJECT OVERVIEW
**StudyMind AI** — AI-powered platform for intelligent document understanding and personalised learning. Students upload study material (PDF, PPT, DOC, TXT, scanned images, pasted text) and get: grounded document chat, quizzes with review mode, structured summaries, 3D flashcards, interactive code practice with AI review, and progress analytics. Chat NEVER refuses: doc-grounded + cited when content exists, 🌐-labeled general knowledge otherwise.

## 3. ACTUAL STACK
| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite 5, Tailwind 3, React Router 6, TanStack Query 5, Zustand 4, Recharts, react-markdown |
| Backend | Node 20+, Express 4 (routes → services → Supabase) |
| DB/Auth/Storage | Supabase: Postgres + pgvector (HNSW), Auth JWT, Storage bucket `study-docs` |
| LLM chat | **Groq** (`openai/gpt-oss-20b` primary, auto-fallback chain on 404) |
| Embeddings | **Gemini** `gemini-embedding-001` free tier, `outputDimensionality` = EMBEDDING_DIM (1536) |
| Docs | pdf-parse, mammoth, officeparser, tesseract.js OCR fallback |
| Validation | Zod strict-JSON schemas + retry; assertEmbeddingDim guard |
| UI system | Onyx Black default theme (pure #000 + ash) + 6-theme picker, glass/tilt/3D, sidebar shell, toasts, skeletons |

## 4. KEY BEHAVIOURS
- Single root `.env` (server reads root, Vite `envDir: '../'`, only `VITE_*` exposed).
- Ingestion: upload → extract → OCR fallback → chunk (~600 tok/12% overlap) → embed (batches of 32) → `uploading/extracting/embedding/ready/failed` + `error_message`; 90s timeouts on all external calls; stage logging `[ingest …]`.
- Chat: smalltalk bypass → vector top-6 → grounded-first prompt (cite `[pX]`) → opening-chunk fallback → general-knowledge mode. SSE streaming supported.
- Quiz: 5–50 Qs (mcq/true_false/multi_answer/coding), submit → per-question ✓/✗, green correct/red pick, explanations, retake.
- Summary: 3 styles (concise/keypoints/revision), enforced Markdown (##, bold, bullets), rendered + copy + .md download.
- Code: AI poses tasks → user solves in-editor → 🔍 Check: rating/10, verdict, issues, test-case table, suggestion; model answer reveal; solved tracking.
- Library: search, status pills, error text, 🗑 delete (DB cascade wipes all generated data).
- Progress: accuracy trend, topic bars, weak <60%, streak, rings, counters.
- Workspace header shows live wiring: `provider/model · N chunks · key status`.

## 5. DB (supabase/migrations/)
001_init (11 tables, HNSW index, `match_chunks`), 002_rls (owner-only policies), 004_gemini_768 (optional native-768 switch).

## 6. API (envelope `{ok, data|error}`, JWT required)
Documents: upload/text/list/get/delete + quiz/exam-questions/summary/flashcards/code-examples/code-review/chat(SSE)/chat/history/stats. Quizzes: attempts. Progress: overview/topics.

## 7. COMMANDS
- `npm run dev:server` (:4000), `npm run dev` / `dev:client` (:5173), server `npm test` (4 tests), client `npm run build`.
- One server + one client process only; `taskkill /F /IM node.exe` if EADDRINUSE. Restart server on every `.env`/server-code change.

## 8. DEPLOY
Backend Railway (`railway up`), frontend Vercel (`vercel --prod`), env per hosting docs, `CLIENT_ORIGIN` + Supabase redirect URL set to Vercel domain.
