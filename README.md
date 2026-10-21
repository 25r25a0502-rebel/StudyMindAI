# StudyMind AI

An AI-powered platform for intelligent document understanding and personalised learning.

## Architecture overview

```
Client (React Vite + Tailwind + React Query + Zustand)
  → Express API (auth middleware, Zod validation, rate limiting)
  → Services (ingestion / embedding / retrieval / generation, LLM provider abstraction)
  → Supabase (Postgres + pgvector + Storage + Auth) + external LLM/Embedding APIs
```

**Assumptions**
- Supabase project with `pgvector` available; storage bucket `study-docs` (private, per-user folders `{user_id}/...`).
- `LLM_PROVIDER` = `openai` | `anthropic` | `gemini`; embeddings via OpenAI (dim 1536, configurable).
- Scanned PDFs/images fall back to `tesseract.js` OCR; very large PDFs raster-OCR is best-effort (recommend cloud OCR for production scale).
- Long ingestion runs async via `setImmediate` background job (swap for BullMQ/pg-boss in production).

## Prerequisites
- Node 20+, Supabase project (cloud or local), LLM API key.

## Setup (single flow, local)
1. **Database**: run `supabase/migrations/001_init.sql` then `002_rls.sql` in Supabase SQL editor. Create private storage bucket `study-docs`.
2. **Backend**:
   ```
   cd server && cp .env.example .env   # fill SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY, OPENAI_API_KEY
   npm install && npm run dev          # :4000
   ```
3. **Frontend**:
   ```
   cd client && cp .env.example .env   # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL=http://localhost:4000
   npm install && npm run dev          # :5173
   ```
4. Sign up → upload PDF → poll status until `ready` → chat/quiz/flashcards.

## Tests
`cd server && npm test` (chunking, JSON validation, scoring).

## Deployment
- Frontend: Vercel/Netlify (`VITE_*` envs, build `npm run build`, output `dist`).
- Backend: Render/Railway (`npm start`, set all `server/.env` vars, allow-list CORS `CLIENT_ORIGIN`).
- Data: Supabase (migrations + storage bucket + Auth redirect URLs).

## Known limitations & future work
- Multilingual embeddings/summaries, collaborative study groups, voice mode, mobile app, cloud OCR at scale, re-ranker model, queue-backed ingestion.
