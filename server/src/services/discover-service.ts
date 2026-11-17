import { createHash } from 'node:crypto';
import type { Db } from '../db/db.js';
import { AlreadySwipedError, NotFoundError, SelfSwipeError, ValidationError } from '../errors.js';
import { toPublicProfile, type PublicProfile, type UserRow } from '../serializers.js';

/**
 * All Discover business logic (D-003). Every function takes the database as
 * its first argument so tests can pass a fresh in-memory DB.
 *
 * Privacy rule for this file: the ONLY query that reads swipes made *towards*
 * the current user is `theyLikedMe` inside `swipe()`, and it runs only after
 * the current user has liked that same person. Nothing else ever looks at
 * incoming swipes: not the feed filter, not the feed order, not the responses.
 */

export type Direction = 'like' | 'pass';

export interface Match {
  profile: PublicProfile;
  matchedAt: string;
}

export type SwipeResult = { matched: false } | { matched: true; match: Match };

export interface FeedResult {
  profiles: PublicProfile[];
  /** True if more unswiped profiles exist beyond this page. */
  remaining: boolean;
}

export const DEFAULT_FEED_LIMIT = 10;
export const MAX_FEED_LIMIT = 50;

/**
 * Deterministic shuffle key (D-005). Depends only on the viewer and the
 * profile id, never on who liked whom, so the position of a card says nothing
 * about how that person feels about you. Stable across reloads.
 */
export function feedOrderKey(userId: string, profileId: string): string {
  return createHash('sha256').update(`${userId}:${profileId}`).digest('hex');
}

/** Profiles the user has not swiped on yet, in a privacy-safe stable order. */
export function getFeed(
  db: Db,
  userId: string,
  { limit = DEFAULT_FEED_LIMIT }: { limit?: number } = {},
): FeedResult {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_FEED_LIMIT) {
    throw new ValidationError(`limit must be an integer between 1 and ${MAX_FEED_LIMIT}`);
  }

  // Excludes only people *I* swiped on (D-006). People who passed on me stay in.
  const rows = db
    .prepare(
      `SELECT u.* FROM users u
       WHERE u.id <> @me
         AND NOT EXISTS (
           SELECT 1 FROM swipes s WHERE s.swiper_id = @me AND s.target_id = u.id
         )`,
    )
    .all({ me: userId }) as UserRow[];

  const ordered = rows
    .map((row) => ({ row, key: feedOrderKey(userId, row.id) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map(({ row }) => row);

  return {
    profiles: ordered.slice(0, limit).map(toPublicProfile),
    remaining: ordered.length > limit,
  };
}

/**
 * Records a like or pass. Returns whether it created a match.
 *
 * A pass, and a like that isn't mutual, both return exactly `{ matched: false }`
 * whatever the other person did (D-006), so the response can't be used to
 * learn whether someone liked or passed on you.
 */
export function swipe(db: Db, userId: string, targetId: string, direction: Direction): SwipeResult {
  if (direction !== 'like' && direction !== 'pass') {
    throw new ValidationError('direction must be "like" or "pass"');
  }
  if (targetId === userId) throw new SelfSwipeError();

  const run = db.transaction((): SwipeResult => {
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as UserRow | undefined;
    if (!target) throw new NotFoundError();

    try {
      db.prepare('INSERT INTO swipes (swiper_id, target_id, direction) VALUES (?, ?, ?)').run(
        userId,
        targetId,
        direction,
      );
    } catch (err) {
      if (isPrimaryKeyViolation(err)) throw new AlreadySwipedError();
      throw err;
    }

    if (direction === 'pass') return { matched: false };

    const theyLikedMe = db
      .prepare(
        `SELECT 1 FROM swipes WHERE swiper_id = ? AND target_id = ? AND direction = 'like'`,
      )
      .get(targetId, userId);
    if (!theyLikedMe) return { matched: false };

    const [a, b] = userId < targetId ? [userId, targetId] : [targetId, userId];
    db.prepare('INSERT OR IGNORE INTO matches (user_a, user_b) VALUES (?, ?)').run(a, b);
    const { created_at } = db
      .prepare('SELECT created_at FROM matches WHERE user_a = ? AND user_b = ?')
      .get(a, b) as { created_at: string };

    return { matched: true, match: { profile: toPublicProfile(target), matchedAt: created_at } };
  });

  // IMMEDIATE takes the write lock up front, so two processes can't both pass
  // the checks and race on the same pair.
  return run.immediate();
}

/** Mutual matches only, newest first. */
export function getMatches(db: Db, userId: string): Match[] {
  const rows = db
    .prepare(
      `SELECT u.*, m.created_at AS matched_at
       FROM matches m
       JOIN users u ON u.id = CASE WHEN m.user_a = @me THEN m.user_b ELSE m.user_a END
       WHERE m.user_a = @me OR m.user_b = @me
       ORDER BY m.created_at DESC, m.rowid DESC`,
    )
    .all({ me: userId }) as (UserRow & { matched_at: string })[];

  return rows.map((row) => ({ profile: toPublicProfile(row), matchedAt: row.matched_at }));
}

function isPrimaryKeyViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || err.code === 'SQLITE_CONSTRAINT_UNIQUE')
  );
}
