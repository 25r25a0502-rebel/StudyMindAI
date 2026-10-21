// LLM provider abstraction: generateText / generateJSON / embed / stream
// Configurable via LLM_PROVIDER env: openai | anthropic | gemini | groq
import { config } from '../../config/index.js';

// All external calls get a hard timeout — a hanging API must fail loudly,
// never freeze an ingestion job forever.
const http = (url, init = {}) => fetch(url, { signal: AbortSignal.timeout(90000), ...init });

async function openaiChat(messages, { json = false, stream = false } = {}) {
  const res = await http('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.llmModel, messages, stream,
      ...(json ? { response_format: { type: 'json_object' } } : {})
    })
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
  if (stream) return res.body;
  const data = await res.json();
  return data.choices[0].message.content;
}

// Groq: OpenAI-compatible API, ultra-fast inference, generous free tier.
// Get key: https://console.groq.com/keys
// Groq retires models aggressively, so groqChat auto-falls back through
// FALLBACKS on model_not_found — a 404 never kills a request anymore.
const GROQ_FALLBACKS = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'moonshotai/kimi-k2-instruct-0905', 'qwen/qwen3-32b'];
async function groqChat(messages, { json = false, stream = false } = {}) {
  if (!process.env.GROQ_API_KEY) throw new Error('Missing GROQ_API_KEY');
  const models = [config.llmModel, ...GROQ_FALLBACKS.filter(m => m !== config.llmModel)];
  let lastErr;
  for (const model of models) {
    const res = await http('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, messages, stream,
        ...(json ? { response_format: { type: 'json_object' } } : {})
      })
    });
    if (res.ok) {
      if (stream) return res.body;
      const data = await res.json();
      return data.choices[0].message.content;
    }
    const detail = await res.text().catch(() => '');
    lastErr = new Error(`Groq error ${res.status} (model ${model}): ${detail.slice(0, 200)}`);
    if (res.status !== 404 && !detail.includes('model_not_found')) throw lastErr;
    console.warn(`[groq] model retired: ${model} → trying next fallback`);
  }
  throw lastErr;
}

async function openaiEmbed(texts) {
  const body = { model: config.embeddingModel, input: texts };
  // text-embedding-3-* supports Matryoshka truncation to any dim (e.g. 768)
  if (config.embeddingModel.startsWith('text-embedding-3')) body.dimensions = config.embeddingDim;
  const res = await http('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Embedding error ${res.status}`);
  const data = await res.json();
  return data.data.map(d => assertEmbeddingDim(d.embedding, config.embeddingDim, 'OpenAI'));
}

// Guard: pgvector column is fixed-width — a wrong-size vector fails the insert.
// Fail fast here with a clear message instead of a cryptic DB error.
export function assertEmbeddingDim(vec, expected, who = 'embedding') {
  if (!Array.isArray(vec) || vec.length !== expected) {
    throw new Error(`${who} dim mismatch: got ${Array.isArray(vec) ? vec.length : 'non-array'}, need ${expected}. ` +
      `Fix: set EMBEDDING_DIM=${Array.isArray(vec) ? vec.length : '?'} + migrate column, or switch embedding model.`);
  }
  return vec;
}

// Gemini embeddings — FREE tier (Google AI Studio key, no card).
// Requests outputDimensionality = EMBEDDING_DIM so vectors fit the vector(N)
// column with no migration. Native dim is 768; values ≤768 work, above falls
// back to native 768 and the assert below tells you to run 004 migration.
async function geminiEmbed(texts) {
  const model = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
  const out = [];
  for (const t of texts) {
    const res = await http(`https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text: t }] },
        taskType: 'RETRIEVAL_DOCUMENT',
        outputDimensionality: config.embeddingDim
      })
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Gemini embedding error ${res.status}: ${detail.slice(0, 200)}`);
    }
    const data = await res.json();
    out.push(assertEmbeddingDim(data.embedding.values, config.embeddingDim, 'Gemini'));
  }
  return out;
}

async function anthropicChat(messages, { json = false } = {}) {
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
  const rest = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
  const res = await http('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.llmModel, max_tokens: 4000, system, messages: rest })
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const data = await res.json();
  return data.content.map(b => b.text || '').join('');
}

async function geminiChat(messages) {
  const prompt = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
  const res = await http(`https://generativelanguage.googleapis.com/v1beta/models/${config.llmModel}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });
  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
}

function chatFor(provider, messages, opts) {
  if (provider === 'groq') return groqChat(messages, opts);
  if (provider === 'anthropic') return anthropicChat(messages, opts);
  if (provider === 'gemini') return geminiChat(messages, opts);
  return openaiChat(messages, opts);
}

export const llm = {
  async generateText(messages) {
    return chatFor(config.llmProvider, messages);
  },
  async generateJSON(messages, schema, retries = 1) {
    for (let i = 0; i <= retries; i++) {
      const raw = await chatFor(config.llmProvider, messages, { json: true });
      try {
        const cleaned = raw.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        const v = schema.safeParse(parsed);
        if (v.success) return v.data;
      } catch (e) { if (i === retries) throw new Error('LLM returned malformed JSON'); }
    }
    throw new Error('LLM JSON validation failed');
  },
  async embed(texts) {
    // FREE-FIRST: Gemini embeddings if a Gemini key exists (free tier),
    // else OpenAI. Groq has no embedding API.
    // Dim must equal EMBEDDING_DIM (default 1536 = vector(1536) column).
    // For native Gemini 768-dim: set EMBEDDING_DIM=768 and run migration 004.
    if (process.env.GEMINI_API_KEY) return geminiEmbed(texts);
    if (process.env.OPENAI_API_KEY) return openaiEmbed(texts);
    throw new Error('No embedding key configured: set GEMINI_API_KEY (free) or OPENAI_API_KEY');
  },
  async stream(messages, onToken) {
    // SSE passthrough: fetch upstream stream and forward tokens
    if (config.llmProvider === 'groq') return groqChat(messages, { stream: true });
    return openaiChat(messages, { stream: true });
  }
};

export async function withBackoff(fn, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { last = e; await new Promise(r => setTimeout(r, 500 * 2 ** i)); }
  }
  throw last;
}
