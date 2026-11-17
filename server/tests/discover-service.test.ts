import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db/db.js';
import { AlreadySwipedError, NotFoundError, SelfSwipeError, ValidationError } from '../src/errors.js';
import { getFeed, getMatches, swipe } from '../src/services/discover-service.js';
import { count, FIXTURE_IDS, incoming, makeDb } from './helpers.js';

const ME = 'me';
/** Reopen an existing file without re-inserting the fixture users. */
const makeDbReopen = (file: string): Db => createDb(file);
const feedIds = (db: Db, limit = 50) => getFeed(db, ME, { limit }).profiles.map((p) => p.id);

let db: Db;
beforeEach(() => {
  db = makeDb();
});
afterEach(() => db.close());

describe('getFeed', () => {
  it('returns every other user and excludes self', () => {
    const ids = feedIds(db);
    expect(ids).not.toContain(ME);
    expect([...ids].sort()).toEqual([...FIXTURE_IDS].sort());
  });

  it('excludes profiles I liked or passed', () => {
    swipe(db, ME, 'alice', 'like');
    swipe(db, ME, 'bob', 'pass');
    const ids = feedIds(db);
    expect(ids).not.toContain('alice');
    expect(ids).not.toContain('bob');
    expect(ids).toHaveLength(FIXTURE_IDS.length - 2);
  });

  it('still includes profiles who passed on me (D-006) ⭐', () => {
    incoming(db, 'cara', ME, 'pass');
    incoming(db, 'dan', ME, 'like');
    expect(feedIds(db)).toEqual(expect.arrayContaining(['cara', 'dan']));
    expect(feedIds(db)).toHaveLength(FIXTURE_IDS.length);
  });

  it('orders identically with and without incoming likes or passes (D-005) ⭐', () => {
    const clean = makeDb();
    const before = feedIds(clean);

    incoming(db, 'zoe', ME, 'like');
    incoming(db, 'nina', ME, 'like');
    incoming(db, 'bob', ME, 'pass');
    expect(feedIds(db)).toEqual(before);

    // Also after I have swiped: the remaining order is the same subsequence.
    swipe(db, ME, 'alice', 'pass');
    swipe(clean, ME, 'alice', 'pass');
    expect(feedIds(db)).toEqual(feedIds(clean));
    clean.close();
  });

  it('is stable across calls and pages without gaps', () => {
    const all = feedIds(db);
    expect(feedIds(db)).toEqual(all);

    const page1 = getFeed(db, ME, { limit: 4 });
    expect(page1.profiles.map((p) => p.id)).toEqual(all.slice(0, 4));
    expect(page1.remaining).toBe(true);

    for (const p of page1.profiles) swipe(db, ME, p.id, 'pass');
    const page2 = getFeed(db, ME, { limit: 4 });
    expect(page2.profiles.map((p) => p.id)).toEqual(all.slice(4));
    expect(page2.remaining).toBe(false);
  });

  it('returns an empty feed once everyone is swiped', () => {
    for (const id of FIXTURE_IDS) swipe(db, ME, id, 'pass');
    expect(getFeed(db, ME)).toEqual({ profiles: [], remaining: false });
  });

  it('rejects an out-of-range limit', () => {
    for (const limit of [0, -1, 51, 1.5, Number.NaN]) {
      expect(() => getFeed(db, ME, { limit })).toThrow(ValidationError);
    }
  });

  it('sends only public profile fields', () => {
    incoming(db, 'alice', ME, 'like');
    const json = JSON.stringify(getFeed(db, ME));
    expect(json).not.toMatch(/liked|direction|swiper|interests_json|photo_url/);
  });
});

describe('swipe', () => {
  it('like with no incoming like → not matched', () => {
    expect(swipe(db, ME, 'alice', 'like')).toEqual({ matched: false });
    expect(count(db, 'SELECT COUNT(*) n FROM matches')).toBe(0);
  });

  it('like when they already liked me → matched, with a match row', () => {
    incoming(db, 'zoe', ME, 'like');
    const result = swipe(db, ME, 'zoe', 'like');
    expect(result.matched).toBe(true);
    if (!result.matched) throw new Error('unreachable');
    expect(result.match.profile.id).toBe('zoe');
    expect(result.match.matchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(count(db, `SELECT COUNT(*) n FROM matches WHERE user_a = 'me' AND user_b = 'zoe'`)).toBe(1);
  });

  it('stores the pair sorted whichever side sorts first', () => {
    incoming(db, 'alice', ME, 'like'); // 'alice' < 'me'
    expect(swipe(db, ME, 'alice', 'like').matched).toBe(true);
    expect(count(db, `SELECT COUNT(*) n FROM matches WHERE user_a = 'alice' AND user_b = 'me'`)).toBe(1);
  });

  it('like when they passed on me → identical to the no-swipe case ⭐', () => {
    incoming(db, 'bob', ME, 'pass');
    const passedOnMe = swipe(db, ME, 'bob', 'like');
    const stranger = swipe(db, ME, 'cara', 'like');
    expect(passedOnMe).toEqual({ matched: false });
    expect(passedOnMe).toStrictEqual(stranger);
  });

  it('pass when they liked me → not matched, no match row, same as any pass ⭐', () => {
    incoming(db, 'dan', ME, 'like');
    const passOnLiker = swipe(db, ME, 'dan', 'pass');
    const passOnStranger = swipe(db, ME, 'cara', 'pass');
    expect(passOnLiker).toStrictEqual({ matched: false });
    expect(passOnLiker).toStrictEqual(passOnStranger);
    expect(count(db, 'SELECT COUNT(*) n FROM matches')).toBe(0);
  });

  it('a later like from the other side creates the match exactly once', () => {
    expect(swipe(db, ME, 'nina', 'like')).toEqual({ matched: false });
    expect(swipe(db, 'nina', ME, 'like').matched).toBe(true);
    expect(count(db, 'SELECT COUNT(*) n FROM matches')).toBe(1);
    expect(getMatches(db, ME).map((m) => m.profile.id)).toEqual(['nina']);
  });

  it('a second swipe on the same profile → AlreadySwipedError, original unchanged', () => {
    swipe(db, ME, 'alice', 'pass');
    expect(() => swipe(db, ME, 'alice', 'like')).toThrow(AlreadySwipedError);
    expect(() => swipe(db, ME, 'alice', 'pass')).toThrow(AlreadySwipedError);
    const row = db.prepare(`SELECT direction FROM swipes WHERE swiper_id = 'me' AND target_id = 'alice'`).get();
    expect(row).toEqual({ direction: 'pass' });
  });

  it('cannot turn a pass into a like to probe for a match', () => {
    incoming(db, 'zoe', ME, 'like');
    swipe(db, ME, 'zoe', 'pass');
    expect(() => swipe(db, ME, 'zoe', 'like')).toThrow(AlreadySwipedError);
    expect(count(db, 'SELECT COUNT(*) n FROM matches')).toBe(0);
  });

  it('swipe on self → SelfSwipeError', () => {
    expect(() => swipe(db, ME, ME, 'like')).toThrow(SelfSwipeError);
  });

  it('swipe on an unknown id → NotFoundError, nothing written', () => {
    expect(() => swipe(db, ME, 'ghost', 'like')).toThrow(NotFoundError);
    expect(count(db, 'SELECT COUNT(*) n FROM swipes')).toBe(0);
  });

  it('an invalid direction → ValidationError', () => {
    expect(() => swipe(db, ME, 'alice', 'superlike' as 'like')).toThrow(ValidationError);
  });

  it('error statuses match the API contract', () => {
    expect(new SelfSwipeError().status).toBe(400);
    expect(new ValidationError().status).toBe(400);
    expect(new NotFoundError().status).toBe(404);
    expect(new AlreadySwipedError().status).toBe(409);
  });
});

describe('getMatches', () => {
  it('is empty with no matches, even if people liked me ⭐', () => {
    incoming(db, 'alice', ME, 'like');
    incoming(db, 'zoe', ME, 'like');
    expect(getMatches(db, ME)).toEqual([]);
  });

  it('returns only mutual matches, newest first', () => {
    for (const id of ['alice', 'bob', 'zoe']) incoming(db, id, ME, 'like');
    swipe(db, ME, 'alice', 'like');
    swipe(db, ME, 'cara', 'like'); // one-sided: not a match
    swipe(db, ME, 'zoe', 'like');
    swipe(db, ME, 'bob', 'pass'); // they liked me, I passed: not a match

    const matches = getMatches(db, ME);
    expect(matches.map((m) => m.profile.id)).toEqual(['zoe', 'alice']);
    for (const m of matches) {
      expect(Object.keys(m).sort()).toEqual(['matchedAt', 'profile']);
    }
  });

  it('is symmetric: the other person sees the match too', () => {
    incoming(db, 'nina', ME, 'like');
    swipe(db, ME, 'nina', 'like');
    expect(getMatches(db, 'nina').map((m) => m.profile.id)).toEqual([ME]);
  });
});

describe('persistence and concurrency', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'coy-svc-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('swipes and matches survive reopening the database', () => {
    const file = join(dir, 'p.db');
    const a = makeDb(file);
    incoming(a, 'zoe', ME, 'like');
    swipe(a, ME, 'zoe', 'like');
    swipe(a, ME, 'alice', 'pass');
    a.close();

    const b = makeDbReopen(file);
    expect(getFeed(b, ME, { limit: 50 }).profiles.map((p) => p.id)).not.toEqual(
      expect.arrayContaining(['zoe', 'alice']),
    );
    expect(getMatches(b, ME).map((m) => m.profile.id)).toEqual(['zoe']);
    b.close();
  });

  it('two connections double-liking the same pair: one wins, one match ⭐', () => {
    const file = join(dir, 'c.db');
    const a = makeDb(file);
    const b = makeDbReopen(file);
    incoming(a, 'zoe', ME, 'like');

    expect(swipe(a, ME, 'zoe', 'like').matched).toBe(true);
    expect(() => swipe(b, ME, 'zoe', 'like')).toThrow(AlreadySwipedError);
    expect(count(b, 'SELECT COUNT(*) n FROM matches')).toBe(1);
    a.close();
    b.close();
  });
});
