import dotenv from 'dotenv';
import path from 'node:path';
// ONE env file: monorepo root .env. Legacy server/.env still fills gaps if present.
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });
export const config = {
  port: Number(process.env.PORT || 4000),
  clientOrigin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(','),
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  bucket: process.env.SUPABASE_STORAGE_BUCKET || 'study-docs',
  llmProvider: process.env.LLM_PROVIDER || 'openai',
  llmModel: process.env.LLM_MODEL || 'gpt-4o-mini',
  embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
  embeddingDim: Number(process.env.EMBEDDING_DIM || 1536),
  maxFileMb: Number(process.env.MAX_FILE_MB || 20),
  topK: Number(process.env.TOP_K || 6),
  dailyLimit: Number(process.env.DAILY_LLM_LIMIT || 50)
};
