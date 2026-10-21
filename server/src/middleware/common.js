import rateLimit from 'express-rate-limit';
export const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
export const llmLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, message: { ok: false, error: 'LLM rate limit exceeded, slow down.' } });
export function errorHandler(err, req, res, next) {
  console.error(JSON.stringify({ msg: err.message, stack: err.stack, path: req.path }));
  const status = err.status || 500;
  res.status(status).json({ ok: false, error: err.message || 'Internal error' });
}
export function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse({ body: req.body, params: req.params, query: req.query });
    if (!parsed.success) return res.status(400).json({ ok: false, error: 'Validation failed', details: parsed.error.flatten() });
    next();
  };
}
