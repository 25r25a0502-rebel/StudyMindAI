import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { config } from '../config/index.js';
import { processDocument, processRawText } from '../services/ingestion/pipeline.js';
import { generateQuiz, generateExam, generateSummary, generateFlashcards, generateCode, reviewCode } from '../services/generation.js';
import { answerQuestion, retrieveChunks } from '../services/retrieval.js';
import { validate, llmLimiter } from '../middleware/common.js';
import { scoreQuiz } from '../services/llm/schemas.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxFileMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /pdf|msword|officedocument|presentation|text\/plain|image\/(png|jpeg)/.test(file.mimetype)
      || /\.(pdf|docx?|pptx?|txt|png|jpe?g)$/i.test(file.originalname);
    cb(ok ? null : new Error('Unsupported file type'), ok);
  }
});

export const docsRouter = Router();

// Upload file
docsRouter.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No file provided' });
    const title = req.body.title || req.file.originalname;
    const path = `${req.user.id}/${Date.now()}-${req.file.originalname}`;
    const { error: upErr } = await supabaseAdmin.storage.from(config.bucket).upload(path, req.file.buffer, { contentType: req.file.mimetype });
    if (upErr) throw upErr;
    const { data: doc, error } = await supabaseAdmin.from('documents').insert({
      user_id: req.user.id, title, file_path: path, file_type: req.file.mimetype, status: 'uploading'
    }).select().single();
    if (error) throw error;
    // async background job (non-blocking) — never allowed to die silently
    console.log(`[upload] received ${req.file.originalname} (${req.file.size} bytes) → doc ${doc.id}`);
    setImmediate(() => {
      processDocument(doc.id, req.user.id, req.file.buffer, req.file.mimetype, req.file.originalname)
        .catch(e => console.error(`[upload] background crash ${doc.id}:`, e.message));
    });
    res.status(201).json({ ok: true, data: doc });
  } catch (e) { next(e); }
});

// Pasted text
docsRouter.post('/text', async (req, res, next) => {
  try {
    const { title, text } = req.body;
    if (!text || text.length < 50) return res.status(400).json({ ok: false, error: 'Text too short' });
    const { data: doc } = await supabaseAdmin.from('documents').insert({
      user_id: req.user.id, title: title || 'Pasted notes', file_type: 'text/plain', status: 'uploading', char_count: text.length
    }).select().single();
    setImmediate(() => {
      processRawText(doc.id, req.user.id, text)
        .catch(e => console.error(`[upload] background crash ${doc.id}:`, e.message));
    });
    res.status(201).json({ ok: true, data: doc });
  } catch (e) { next(e); }
});

docsRouter.get('/', async (req, res, next) => {
  try {
    const { data } = await supabaseAdmin.from('documents').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false });
    res.json({ ok: true, data });
  } catch (e) { next(e); }
});

docsRouter.get('/:id', async (req, res, next) => {
  try {
    const { data } = await supabaseAdmin.from('documents').select('*').eq('id', req.params.id).eq('user_id', req.user.id).single();
    if (!data) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, data });
  } catch (e) { next(e); }
});

docsRouter.delete('/:id', async (req, res, next) => {
  try {
    const { data: doc } = await supabaseAdmin.from('documents').select('*').eq('id', req.params.id).eq('user_id', req.user.id).single();
    if (!doc) return res.status(404).json({ ok: false, error: 'Not found' });
    if (doc.file_path) await supabaseAdmin.storage.from(config.bucket).remove([doc.file_path]);
    await supabaseAdmin.from('documents').delete().eq('id', req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Generation endpoints (rate-limited)
docsRouter.post('/:id/quiz', llmLimiter, async (req, res, next) => {
  try {
    const { count = 10, difficulty = 'medium' } = req.body;
    if (count < 5 || count > 50) return res.status(400).json({ ok: false, error: 'count must be 5-50' });
    const quiz = await generateQuiz(req.params.id, req.user.id, { count, difficulty });
    res.status(201).json({ ok: true, data: quiz });
  } catch (e) { next(e); }
});
docsRouter.post('/:id/exam-questions', llmLimiter, async (req, res, next) => {
  try { res.status(201).json({ ok: true, data: await generateExam(req.params.id, req.user.id) }); } catch (e) { next(e); }
});
docsRouter.post('/:id/summary', llmLimiter, async (req, res, next) => {
  try { res.status(201).json({ ok: true, data: await generateSummary(req.params.id, req.user.id, req.body.type || 'concise') }); } catch (e) { next(e); }
});
docsRouter.post('/:id/flashcards', llmLimiter, async (req, res, next) => {
  try { res.status(201).json({ ok: true, data: await generateFlashcards(req.params.id, req.user.id) }); } catch (e) { next(e); }
});
docsRouter.post('/:id/code-examples', llmLimiter, async (req, res, next) => {
  try { res.status(201).json({ ok: true, data: await generateCode(req.params.id, req.user.id, req.body.question || '') }); } catch (e) { next(e); }
});
docsRouter.post('/:id/code-review', llmLimiter, async (req, res, next) => {
  try {
    const { language = '', question = '', code = '' } = req.body;
    res.json({ ok: true, data: await reviewCode(req.params.id, req.user.id, { language, question, code }) });
  } catch (e) { next(e); }
});

// Streaming chat via SSE
docsRouter.post('/:id/chat', llmLimiter, async (req, res, next) => {
  try {
    const { message, sessionId } = req.body;
    if (!message) return res.status(400).json({ ok: false, error: 'message required' });
    let sid = sessionId;
    if (!sid) {
      const { data: s } = await supabaseAdmin.from('chat_sessions').insert({ document_id: req.params.id, user_id: req.user.id }).select().single();
      sid = s.id;
    }
    await supabaseAdmin.from('chat_messages').insert({ session_id: sid, role: 'user', content: message });
    const { answer, sources } = await answerQuestion(req.params.id, message);
    await supabaseAdmin.from('chat_messages').insert({ session_id: sid, role: 'assistant', content: answer, sources });
    if (req.headers.accept === 'text/event-stream') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      // simple chunked stream of words
      for (const w of answer.split(' ')) { res.write(`data: ${JSON.stringify({ token: w + ' ' })}\n\n`); }
      res.write(`data: ${JSON.stringify({ done: true, sources, sessionId: sid })}\n\n`);
      res.end();
    } else {
      res.json({ ok: true, data: { answer, sources, sessionId: sid } });
    }
  } catch (e) { next(e); }
});
docsRouter.get('/:id/chat/history', async (req, res, next) => {
  try {
    const { data: sessions } = await supabaseAdmin.from('chat_sessions').select('*, chat_messages(*)').eq('document_id', req.params.id).eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(1);
    res.json({ ok: true, data: sessions?.[0] || null });
  } catch (e) { next(e); }
});

// Wiring inspector: proves which LLM + how many chunks this doc has
docsRouter.get('/:id/stats', async (req, res, next) => {
  try {
    const { data: doc } = await supabaseAdmin.from('documents').select('id').eq('id', req.params.id).eq('user_id', req.user.id).single();
    if (!doc) return res.status(404).json({ ok: false, error: 'Not found' });
    const { count } = await supabaseAdmin.from('document_chunks').select('id', { count: 'exact', head: true }).eq('document_id', req.params.id);
    res.json({ ok: true, data: {
      chunks: count || 0,
      provider: config.llmProvider, model: config.llmModel,
      embeddingDim: config.embeddingDim, topK: config.topK,
      keys: { groq: !!process.env.GROQ_API_KEY, gemini: !!process.env.GEMINI_API_KEY, openai: !!process.env.OPENAI_API_KEY }
    } });
  } catch (e) { next(e); }
});
