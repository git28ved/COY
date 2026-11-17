import { createApp } from './app.js';

// In production the host (Render/Railway) tells us which port to use via PORT.
// In development PORT is often set for the frontend tooling, so the API uses its
// own API_PORT (default 4000) to avoid fighting Vite for the same port.
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number((isProd ? process.env.PORT : process.env.API_PORT) ?? 4000);

createApp().listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
