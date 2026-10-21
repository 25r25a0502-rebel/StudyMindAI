import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { llm, withBackoff } from './llm/provider.js';
import { retrieveChunks } from './retrieval.js';
import { QuizSchema, FlashcardsSchema, ExamSchema, CodeExamplesSchema, CodeReviewSchema } from './llm/schemas.js';

async function docContext(docId, query, k = 8) {
  const chunks = await retrieveChunks(docId, query, k);
  return chunks.map(c => `[p${c.page_number}] ${c.content}`).join('\n---\n').slice(0, 12000);
}

export async function generateQuiz(docId, userId, { count = 10, difficulty = 'medium' } = {}) {
  const ctx = await docContext(docId, 'key concepts definitions theorems examples');
  const data = await withBackoff(() => llm.generateJSON([
    { role: 'system', content: 'Generate study quizzes as STRICT JSON. No markdown.' },
    { role: 'user', content: `DATA:\n${ctx}\n\nCreate ${count} ${difficulty} questions (mix of mcq, true_false, multi_answer, coding). Coding questions have plain-text answer + explanation. Return {"questions":[{"id":"q1","type":"mcq|true_false|multi_answer|coding","topic":"...","difficulty":"...","question":"...","options":["A.."],"answer":"...","explanation":"..."}]}` }
  ], QuizSchema));
  const { data: quiz } = await supabaseAdmin.from('quizzes').insert({
    document_id: docId, user_id: userId,
    config: { count, difficulty }, questions: data.questions
  }).select().single();
  return quiz;
}

export async function generateExam(docId, userId) {
  const ctx = await docContext(docId, 'important exam questions long short answers');
  const data = await withBackoff(() => llm.generateJSON([
    { role: 'system', content: 'Return STRICT JSON only.' },
    { role: 'user', content: `DATA:\n${ctx}\n\nCreate 4 short (2-3 marks) + 3 long (6-mark) + 2 long (10-mark) questions with answer outlines. Return {"questions":[{"marks":3,"question":"...","answer_outline":"...","topic":"..."}]}` }
  ], ExamSchema));
  const rows = data.questions.map(q => ({ document_id: docId, user_id: userId, ...q }));
  await supabaseAdmin.from('exam_questions').insert(rows);
  return data.questions;
}

export async function generateSummary(docId, userId, type = 'concise') {
  const ctx = await docContext(docId, 'summarize main ideas', 12);
  const shape = type === 'revision'
    ? 'a one-page exam revision sheet: ## numbered sections, **bold** key terms, • bullet must-know points, one line mnemonics where handy'
    : type === 'keypoints'
      ? 'a bullet list of key points: ## sections per topic, each point on its own line starting with •, **bold** the core term in every point'
      : 'concise study notes: ## headings per topic, short paragraphs (2-3 lines each), **bold** important terms, • bullets for lists, one line break between blocks';
  const text = await withBackoff(() => llm.generateText([
    { role: 'system', content: 'You are a study-notes writer. Use only the DATA provided. FORMATTING IS MANDATORY: Markdown with ## headings, **bold** key terms, • or - bullets (one point per line), short paragraphs separated by blank lines. No walls of text, no plain unformatted output.' },
    { role: 'user', content: `DATA:\n${ctx}\n\nWrite ${shape}.` }
  ]));
  await supabaseAdmin.from('summaries').insert({ document_id: docId, user_id: userId, type, content: text });
  return text;
}

export async function generateFlashcards(docId, userId, count = 20) {
  const ctx = await docContext(docId, 'flashcard facts definitions');
  const data = await withBackoff(() => llm.generateJSON([
    { role: 'system', content: 'Return STRICT JSON only.' },
    { role: 'user', content: `DATA:\n${ctx}\n\nCreate ${count} flashcards. Return {"cards":[{"front":"...","back":"..."}]}` }
  ], FlashcardsSchema));
  const { data: set } = await supabaseAdmin.from('flashcard_sets').insert({ document_id: docId, user_id: userId }).select().single();
  await supabaseAdmin.from('flashcards').insert(data.cards.map(c => ({ set_id: set.id, ...c })));
  return { set, cards: data.cards };
}

export async function generateCode(docId, userId, question = '') {
  const ctx = await docContext(docId, question || 'algorithms concepts code implementations');
  const task = question
    ? `The user asks: "${question}". Answer it with code grounded in the DATA below (pick the most relevant language, plus one alternative where sensible). Then add 2 related practice tasks ("Try it yourself") drawn from the same DATA.`
    : `For each key concept give implementations in C, C++, Java, Python, JavaScript, SQL where relevant (max 8 examples).`;
  const data = await withBackoff(() => llm.generateJSON([
    { role: 'system', content: 'Return STRICT JSON only.' },
    { role: 'user', content: `DATA:\n${ctx}\n\n${task} Each item: title, language, code, line-by-line explanation, complexity. Return {"examples":[{"language":"Python","title":"...","code":"...","explanation":"...","complexity":"O(n)"}]}` }
  ], CodeExamplesSchema));
  return data.examples;
}

export async function reviewCode(docId, userId, { language = '', question = '', code = '' } = {}) {
  if (!code.trim()) throw Object.assign(new Error('No code submitted'), { status: 400 });
  const ctx = await docContext(docId, question || 'code concepts');
  const data = await withBackoff(() => llm.generateJSON([
    { role: 'system', content: 'You are a strict but fair coding mentor. Return STRICT JSON only.' },
    { role: 'user', content: `DATA (course context):\n${ctx}\n\nTASK: ${question}\nLANGUAGE: ${language}\nSTUDENT CODE:\n${code.slice(0, 6000)}\n\nReview it: correctness vs the task, efficiency, edge cases. Invent 3-5 concrete test cases (input → expected output) and judge each as pass/fail/uncertain by reasoning about the code. Rate overall 0-10. Return {"rating":8.5,"verdict":"...","issues":[{"severity":"error|warning|info","message":"..."}],"test_cases":[{"input":"...","expected":"...","result":"pass|fail|uncertain","note":"..."}],"suggestion":"corrected code or key fix..."}` }
  ], CodeReviewSchema));
  return data;
}
