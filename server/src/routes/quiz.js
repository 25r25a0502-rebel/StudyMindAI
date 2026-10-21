import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { scoreQuiz } from '../services/llm/schemas.js';
import { generateQuiz } from '../services/generation.js';

export const quizRouter = Router();

quizRouter.post('/:id/attempts', async (req, res, next) => {
  try {
    const { answers, durationSec = 0 } = req.body;
    const { data: quiz } = await supabaseAdmin.from('quizzes').select('*').eq('id', req.params.id).eq('user_id', req.user.id).single();
    if (!quiz) return res.status(404).json({ ok: false, error: 'Quiz not found' });
    const { score, total, results } = scoreQuiz(quiz.questions, answers || []);
    const { data: attempt } = await supabaseAdmin.from('quiz_attempts').insert({
      quiz_id: quiz.id, user_id: req.user.id, score, total, duration_sec: durationSec, answers
    }).select().single();
    await supabaseAdmin.from('question_results').insert(results.map(r => ({ attempt_id: attempt.id, ...r })));
    res.status(201).json({ ok: true, data: { ...attempt, results } });
  } catch (e) { next(e); }
});

export const progressRouter = Router();

progressRouter.get('/overview', async (req, res, next) => {
  try {
    const { data: attempts } = await supabaseAdmin.from('quiz_attempts').select('*').eq('user_id', req.user.id).order('created_at');
    const { data: docs } = await supabaseAdmin.from('documents').select('id').eq('user_id', req.user.id);
    const acc = attempts?.length ? attempts.map(a => ({ date: a.created_at.slice(0, 10), pct: a.total ? Math.round(100 * a.score / a.total) : 0 })) : [];
    const streak = calcStreak(attempts?.map(a => a.created_at.slice(0, 10)) || []);
    res.json({ ok: true, data: { attempts: attempts?.length || 0, documents: docs?.length || 0, accuracyTrend: acc, streak } });
  } catch (e) { next(e); }
});

progressRouter.get('/topics', async (req, res, next) => {
  try {
    const { data } = await supabaseAdmin.from('question_results').select('topic,is_correct,attempt_id,quiz_attempts!inner(user_id)')
      .eq('quiz_attempts.user_id', req.user.id);
    const agg = {};
    for (const r of data || []) {
      agg[r.topic] = agg[r.topic] || { topic: r.topic, correct: 0, total: 0 };
      agg[r.topic].total++; if (r.is_correct) agg[r.topic].correct++;
    }
    const topics = Object.values(agg).map(t => ({ ...t, accuracy: t.total ? Math.round(100 * t.correct / t.total) : 0 }));
    const weak = topics.filter(t => t.accuracy < 60).map(t => t.topic);
    res.json({ ok: true, data: { topics, weak } });
  } catch (e) { next(e); }
});

progressRouter.post('/weak-quiz', async (req, res, next) => {
  try {
    const { documentId } = req.body;
    const quiz = await generateQuiz(documentId, req.user.id, { count: 10, difficulty: 'medium' });
    res.status(201).json({ ok: true, data: quiz });
  } catch (e) { next(e); }
});

function calcStreak(dates) {
  const uniq = [...new Set(dates)].sort().reverse();
  let streak = 0; let d = new Date();
  for (const s of uniq) {
    const day = d.toISOString().slice(0, 10);
    if (s === day) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}
