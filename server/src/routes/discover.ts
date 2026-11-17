import { Router } from 'express';
import { z } from 'zod';
import { CURRENT_USER_ID } from '../constants.js';
import type { Db } from '../db/db.js';
import { getFeed, getMatches, swipe } from '../services/discover-service.js';

/** Max page size over HTTP. The service allows up to 50; the API is stricter. */
export const API_MAX_FEED_LIMIT = 20;

const feedQuery = z.object({
  limit: z.coerce.number().int().min(1).max(API_MAX_FEED_LIMIT).default(10),
});

const swipeBody = z
  .object({
    targetId: z.string().trim().min(1).max(64),
    direction: z.enum(['like', 'pass']),
  })
  .strict();

/**
 * Thin HTTP layer (D-003): validate input with zod, call the service, send the
 * result. No business rules live here. Errors go to the error middleware.
 * There is no auth in this assignment, so every request acts as CURRENT_USER_ID.
 */
export function discoverRouter(db: Db): Router {
  const router = Router();

  router.get('/feed', (req, res) => {
    const { limit } = feedQuery.parse(req.query);
    res.json(getFeed(db, CURRENT_USER_ID, { limit }));
  });

  router.post('/swipe', (req, res) => {
    const { targetId, direction } = swipeBody.parse(req.body ?? {});
    res.json(swipe(db, CURRENT_USER_ID, targetId, direction));
  });

  router.get('/matches', (_req, res) => {
    res.json({ matches: getMatches(db, CURRENT_USER_ID) });
  });

  return router;
}
