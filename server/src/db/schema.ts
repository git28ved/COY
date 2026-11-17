/**
 * Database schema. Kept as a TS string (not a .sql file) so `tsc` ships it in
 * dist/ with no extra copy step. Every statement is idempotent (IF NOT EXISTS).
 */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  age             INTEGER NOT NULL CHECK (age >= 18),
  bio             TEXT NOT NULL DEFAULT '',
  photo_url       TEXT NOT NULL,
  city            TEXT NOT NULL,
  college         TEXT NOT NULL,
  interests_json  TEXT NOT NULL DEFAULT '[]',
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- One swipe per (swiper, target) pair, ever. This is what makes
-- "a swiped profile never appears again" a database guarantee.
CREATE TABLE IF NOT EXISTS swipes (
  swiper_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction   TEXT NOT NULL CHECK (direction IN ('like', 'pass')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (swiper_id, target_id),
  CHECK (swiper_id <> target_id)
);

-- Reverse lookup used only by the match check ("did they like me?").
CREATE INDEX IF NOT EXISTS idx_swipes_target_swiper ON swipes (target_id, swiper_id);

-- A match is stored once per pair, with user_a < user_b.
CREATE TABLE IF NOT EXISTS matches (
  user_a      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_a, user_b),
  CHECK (user_a < user_b)
);

CREATE INDEX IF NOT EXISTS idx_matches_user_a ON matches (user_a);
CREATE INDEX IF NOT EXISTS idx_matches_user_b ON matches (user_b);
`;
