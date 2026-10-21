import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import { authMiddleware } from './middleware/auth.js';
import { generalLimiter, errorHandler } from './middleware/common.js';
import { docsRouter } from './routes/documents.js';
import { quizRouter, progressRouter } from './routes/quiz.js';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: '1mb' }));
  app.use(generalLimiter);
  app.get('/health', (req, res) => res.json({ ok: true }));
  app.use('/api/documents', authMiddleware, docsRouter);
  app.use('/api/quizzes', authMiddleware, quizRouter);
  app.use('/api/progress', authMiddleware, progressRouter);
  app.use(errorHandler);
  return app;
}
