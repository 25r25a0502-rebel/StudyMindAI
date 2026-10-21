import { test } from 'node:test';
import assert from 'node:assert';
import { chunkText, cleanText } from '../src/utils/chunking.js';
import { scoreQuiz } from '../src/services/llm/schemas.js';
import { assertEmbeddingDim } from '../src/services/llm/provider.js';

test('chunking splits with overlap and metadata', () => {
  const text = 'Sentence one. '.repeat(500);
  const chunks = chunkText([{ page: 2, text }]);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every(c => c.page_number === 2 && c.token_count > 0));
});
test('cleanText strips control chars', () => {
  assert.equal(cleanText('a\u0000b'), 'ab');
});
test('scoreQuiz computes per-topic results', () => {
  const qs = [{ id: 'q1', topic: 'forces', answer: 'Newton' }, { id: 'q2', topic: 'energy', answer: 'Joule' }];
  const { score, total, results } = scoreQuiz(qs, [{ questionId: 'q1', answer: 'newton' }, { questionId: 'q2', answer: 'wrong' }]);
  assert.equal(score, 1); assert.equal(total, 2);
  assert.equal(results[0].is_correct, true);
});
test('assertEmbeddingDim accepts matching dims, rejects mismatches', () => {
  assert.deepEqual(assertEmbeddingDim([0.1, 0.2], 2), [0.1, 0.2]);
  assert.throws(() => assertEmbeddingDim([0.1, 0.2, 0.3], 2), /dim mismatch/);
});
