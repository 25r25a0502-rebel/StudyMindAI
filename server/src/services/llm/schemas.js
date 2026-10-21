import { z } from 'zod';

export const QuizSchema = z.object({
  questions: z.array(z.object({
    id: z.string(),
    type: z.enum(['mcq', 'true_false', 'multi_answer', 'coding']),
    topic: z.string(),
    difficulty: z.string(),
    question: z.string(),
    options: z.array(z.string()).optional(),
    answer: z.string(),
    explanation: z.string()
  }))
});
export const FlashcardsSchema = z.object({
  cards: z.array(z.object({ front: z.string(), back: z.string() }))
});
export const ExamSchema = z.object({
  questions: z.array(z.object({ marks: z.number(), question: z.string(), answer_outline: z.string(), topic: z.string() }))
});
export const SummarySchema = z.object({ content: z.string() });
export const CodeExamplesSchema = z.object({
  examples: z.array(z.object({ language: z.string(), title: z.string(), code: z.string(), explanation: z.string(), complexity: z.string().optional() }))
});
export const CodeReviewSchema = z.object({
  rating: z.number().min(0).max(10),
  verdict: z.string(),
  issues: z.array(z.object({ severity: z.enum(['info', 'warning', 'error']), message: z.string() })),
  test_cases: z.array(z.object({ input: z.string(), expected: z.string(), result: z.enum(['pass', 'fail', 'uncertain']), note: z.string() })),
  suggestion: z.string()
});

export function scoreQuiz(questions, answers) {
  // answers: [{questionId, answer}]
  let score = 0;
  const results = questions.map(q => {
    const a = answers.find(x => x.questionId === q.id);
    const correct = !!a && a.answer.trim().toLowerCase() === String(q.answer).trim().toLowerCase();
    if (correct) score++;
    return { question_ref: q.id, topic: q.topic || 'general', is_correct: correct };
  });
  return { score, total: questions.length, results };
}
