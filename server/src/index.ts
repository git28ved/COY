import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createDb } from './db/db.js';

// In production the host (Render) tells us which port to use via PORT.
// In development PORT is often set for the frontend tooling, so the API uses its
// own API_PORT (default 4000) to avoid fighting Vite for the same port (D-011).
const isProd = process.env.NODE_ENV === 'production';
const portVar = isProd ? 'PORT' : 'API_PORT';
const rawPort = process.env[portVar] ?? '4000';
const PORT = Number(rawPort);
if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) {
  console.error(`[server] ${portVar}="${rawPort}" is not a valid port number.`);
  process.exit(1);
}

/** If shutdown takes longer than this (stuck connections), exit anyway. */
const SHUTDOWN_TIMEOUT_MS = 3000;

// server/dist/index.js → ../../client/dist
const clientDist = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'dist');

const db = createDb();
const app = createApp(db, { clientDist: isProd ? clientDist : undefined });

const server = app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});

// A clear message instead of a stack trace when the port is taken.
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `[server] Port ${PORT} is already in use. Stop the other server ` +
        `(lsof -ti:${PORT} | xargs kill) or start with ${portVar}=<another port>.`,
    );
  } else {
    console.error('[server] failed to start:', err);
  }
  db.close();
  process.exit(1);
});

// Graceful shutdown: stop accepting requests, drop idle keep-alive connections
// (Vite's proxy holds some open, which used to make Ctrl+C hang), then close
// the DB so SQLite's WAL is checkpointed. A second signal, or the timeout,
// forces the exit.
let shuttingDown = false;
function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) {
    console.log(`[server] ${signal} again: forcing exit`);
    process.exit(1);
  }
  shuttingDown = true;
  console.log(`[server] ${signal} received, shutting down…`);

  setTimeout(() => {
    console.error('[server] shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();

  server.close(() => {
    db.close();
    process.exit(0);
  });
  server.closeIdleConnections();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
