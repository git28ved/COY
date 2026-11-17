import express, { type Express } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from './db/db.js';
import { errorHandler, notFound } from './middleware/error.js';
import { discoverRouter } from './routes/discover.js';

export interface AppOptions {
  /** Absolute path to the built React app (client/dist). Served in production only. */
  clientDist?: string;
}

/**
 * Builds the Express app around a database. Kept separate from `index.ts`
 * (which calls `listen`) so tests can drive the real HTTP layer with
 * supertest on an in-memory DB, with no open port.
 */
export function createApp(db: Db, { clientDist }: AppOptions = {}): Express {
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

  app.use(discoverRouter(db));

  // Production: one process serves the API and the React build (D-001).
  // The UI uses ?tab= not paths, so only "/" and static assets are needed,
  // but any other GET that wants HTML also gets index.html.
  if (clientDist && existsSync(join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist, { index: 'index.html' }));
    app.use((req, res, next) => {
      if (req.method === 'GET' && req.accepts('html')) {
        res.set('Cache-Control', 'no-cache');
        res.sendFile(join(clientDist, 'index.html'));
        return;
      }
      next();
    });
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
