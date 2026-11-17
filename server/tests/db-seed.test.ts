import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CURRENT_USER_ID } from '../src/constants.js';
import { createDb, type Db } from '../src/db/db.js';
import { seed } from '../src/seed/seed.js';
import {
  INCOMING_LIKE_IDS,
  INCOMING_PASS_IDS,
  INTERESTS,
  SEED_PROFILES,
} from '../src/seed/profiles.js';

const count = (db: Db, sql: string, ...params: unknown[]) =>
  (db.prepare(sql).get(...params) as { n: number }).n;

describe('schema', () => {
  let db: Db;
  beforeEach(() => {
    db = createDb(':memory:');
    seed(db);
  });
  afterEach(() => db.close());

  it('turns on foreign keys', () => {
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('allows only one swipe per (swiper, target) pair', () => {
    db.prepare(`INSERT INTO swipes VALUES ('me', 'p03', 'like', 'x')`).run();
    expect(() =>
      db.prepare(`INSERT INTO swipes VALUES ('me', 'p03', 'pass', 'x')`).run(),
    ).toThrow(/UNIQUE|PRIMARY KEY/);
  });

  it('rejects an invalid direction, a self-swipe and an unknown user', () => {
    const ins = db.prepare(`INSERT INTO swipes (swiper_id, target_id, direction) VALUES (?, ?, ?)`);
    expect(() => ins.run('me', 'p03', 'superlike')).toThrow(/CHECK/);
    expect(() => ins.run('me', 'me', 'like')).toThrow(/CHECK/);
    expect(() => ins.run('me', 'nobody', 'like')).toThrow(/FOREIGN KEY/);
  });

  it('stores a match pair only in sorted order', () => {
    // 'me' < 'p01' lexicographically, so ('me', 'p01') is the only valid order.
    expect(() => db.prepare(`INSERT INTO matches (user_a, user_b) VALUES ('p01', 'me')`).run()).toThrow(/CHECK/);
    expect(() => db.prepare(`INSERT INTO matches (user_a, user_b) VALUES ('me', 'p01')`).run()).not.toThrow();
  });
});

describe('seed', () => {
  it('inserts me + 36 profiles with valid data', () => {
    const db = createDb(':memory:');
    seed(db);
    expect(count(db, 'SELECT COUNT(*) n FROM users')).toBe(37);
    expect(SEED_PROFILES.length).toBeGreaterThanOrEqual(30);

    const ids = new Set(SEED_PROFILES.map((p) => p.id));
    expect(ids.size).toBe(SEED_PROFILES.length);

    for (const p of SEED_PROFILES) {
      expect(p.age).toBeGreaterThanOrEqual(18);
      expect(p.name && p.bio && p.city && p.college && p.photoUrl).toBeTruthy();
      expect(p.interests.length).toBeGreaterThan(0);
      for (const i of p.interests) expect(INTERESTS).toContain(i);
    }
    db.close();
  });

  it('seeds incoming likes and passes towards me only, with no outgoing swipes or matches', () => {
    const db = createDb(':memory:');
    seed(db);
    expect(count(db, `SELECT COUNT(*) n FROM swipes WHERE target_id = ? AND direction = 'like'`, CURRENT_USER_ID)).toBe(INCOMING_LIKE_IDS.length);
    expect(count(db, `SELECT COUNT(*) n FROM swipes WHERE target_id = ? AND direction = 'pass'`, CURRENT_USER_ID)).toBe(INCOMING_PASS_IDS.length);
    expect(count(db, 'SELECT COUNT(*) n FROM swipes WHERE swiper_id = ?', CURRENT_USER_ID)).toBe(0);
    expect(count(db, 'SELECT COUNT(*) n FROM matches')).toBe(0);
    // Likers and passers never overlap.
    expect(INCOMING_LIKE_IDS.filter((id) => (INCOMING_PASS_IDS as readonly string[]).includes(id))).toEqual([]);
    db.close();
  });

  it('is idempotent and resets demo state when rerun', () => {
    const db = createDb(':memory:');
    seed(db);
    db.prepare(`INSERT INTO swipes (swiper_id, target_id, direction) VALUES ('me', 'p01', 'like')`).run();
    db.prepare(`INSERT INTO matches (user_a, user_b) VALUES ('me', 'p01')`).run();

    seed(db);
    expect(count(db, 'SELECT COUNT(*) n FROM users')).toBe(37);
    expect(count(db, 'SELECT COUNT(*) n FROM swipes')).toBe(INCOMING_LIKE_IDS.length + INCOMING_PASS_IDS.length);
    expect(count(db, 'SELECT COUNT(*) n FROM matches')).toBe(0);
    db.close();
  });
});

describe('persistence', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'coy-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('keeps data across separate connections to the same file', () => {
    const file = join(dir, 'test.db');
    const a = createDb(file);
    seed(a);
    a.prepare(`INSERT INTO swipes (swiper_id, target_id, direction) VALUES ('me', 'p05', 'pass')`).run();
    a.close();

    const b = createDb(file);
    expect(count(b, 'SELECT COUNT(*) n FROM users')).toBe(37);
    expect(count(b, `SELECT COUNT(*) n FROM swipes WHERE swiper_id = 'me' AND target_id = 'p05'`)).toBe(1);
    b.close();
  });
});
