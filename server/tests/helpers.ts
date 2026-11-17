import { createDb, type Db } from '../src/db/db.js';

/**
 * Small hand-made fixture: `me` plus a few people. Ids are chosen so some sort
 * before 'me' ('alice', 'bob') and some after ('nina', 'zoe'), which covers
 * both orderings of a stored match pair.
 */
export const FIXTURE_IDS = ['alice', 'bob', 'cara', 'dan', 'nina', 'zoe'] as const;

export function makeDb(path = ':memory:'): Db {
  const db = createDb(path);
  const insert = db.prepare(
    `INSERT INTO users (id, name, age, bio, photo_url, city, college, interests_json)
     VALUES (?, ?, 21, 'bio', 'https://example.com/p.jpg', 'Delhi', 'DU', '["Music"]')`,
  );
  insert.run('me', 'Me');
  for (const id of FIXTURE_IDS) insert.run(id, id[0]!.toUpperCase() + id.slice(1));
  return db;
}

/** Record a swipe made by someone else, directly in the DB (not through the service). */
export function incoming(db: Db, from: string, to: string, direction: 'like' | 'pass') {
  db.prepare('INSERT INTO swipes (swiper_id, target_id, direction) VALUES (?, ?, ?)').run(from, to, direction);
}

export const count = (db: Db, sql: string, ...params: unknown[]) =>
  (db.prepare(sql).get(...params) as { n: number }).n;
