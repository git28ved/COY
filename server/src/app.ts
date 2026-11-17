import express, { type Express } from 'express';

/**
 * Builds the Express app. Kept separate from `index.ts` (which calls `listen`)
 * so tests can drive the real HTTP layer with supertest, no open port needed.
 * Phase 3 adds the `db` parameter and the /feed, /swipe and /matches routes.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));

  // API responses are per-user and change on every swipe: never cache them.
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}
