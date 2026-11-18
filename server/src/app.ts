import compression from 'compression';
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
  app.use(compression()); // gzip JSON and the JS/CSS bundle (~226 KB → ~71 KB)
  app.use(express.json({ limit: '10kb' }));

  // Every response gets basic hardening headers and, by default, no-store: API
  // data is per-user and changes on every swipe. Static files override the
  // caching below. A full CSP is left out on purpose: photos come
  // from an external host for now (Q-2).
  app.use((_req, res, next) => {
    res.set({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
    });
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
    app.use(
      express.static(clientDist, {
        index: 'index.html',
        setHeaders(res, filePath) {
          // Vite puts content-hashed files in /assets: their name changes with
          // their content, so they can be cached forever. Everything else
          // (index.html, favicon, robots.txt) is revalidated on each visit.
          res.set(
            'Cache-Control',
            /[\\/]assets[\\/]/.test(filePath) ? 'public, max-age=31536000, immutable' : 'no-cache',
          );
        },
      }),
    );
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
