import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createDb } from './db/db.js';

// In production the host (Render) tells us which port to use via PORT.
// In development PORT is often set for the frontend tooling, so the API uses its
// own API_PORT (default 4000) to avoid fighting Vite for the same port (D-011).
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number((isProd ? process.env.PORT : process.env.API_PORT) ?? 4000);

// server/dist/index.js → ../../client/dist
const clientDist = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'dist');

const db = createDb();
const app = createApp(db, { clientDist: isProd ? clientDist : undefined });

const server = app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});

// Close the DB cleanly so WAL contents are checkpointed on shutdown.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
