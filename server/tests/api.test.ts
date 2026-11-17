import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import type { Db } from '../src/db/db.js';
import { createDb } from '../src/db/db.js';
import { seed } from '../src/seed/seed.js';
import { INCOMING_LIKE_IDS, INCOMING_PASS_IDS } from '../src/seed/profiles.js';
import { PUBLIC_PROFILE_KEYS } from '../src/serializers.js';
import { FIXTURE_IDS, incoming, makeDb } from './helpers.js';

let db: Db;
let api: ReturnType<typeof request>;
beforeEach(() => {
  db = makeDb();
  api = request(createApp(db));
});
afterEach(() => {
  if (db.open) db.close();
});

describe('GET /feed', () => {
  it('200 with { profiles, remaining } and public profiles only', async () => {
    const res = await api.get('/feed');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['profiles', 'remaining']);
    expect(res.body.profiles).toHaveLength(FIXTURE_IDS.length);
    expect(res.body.remaining).toBe(false);
    for (const p of res.body.profiles) {
      expect(Object.keys(p).sort()).toEqual([...PUBLIC_PROFILE_KEYS].sort());
    }
  });

  it('respects limit and reports remaining', async () => {
    const res = await api.get('/feed?limit=2');
    expect(res.body.profiles).toHaveLength(2);
    expect(res.body.remaining).toBe(true);
  });

  it.each(['abc', '0', '21', '1.5', '-3', ''])('limit=%s → 400', async (limit) => {
    const res = await api.get(`/feed?limit=${limit}`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /swipe', () => {
  it('pass → 200 { matched: false } and the profile leaves the feed', async () => {
    const res = await api.post('/swipe').send({ targetId: 'alice', direction: 'pass' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ matched: false });

    const feed = await api.get('/feed');
    expect(feed.body.profiles.map((p: { id: string }) => p.id)).not.toContain('alice');
  });

  it('like on someone who liked me → matched: true with the public profile', async () => {
    incoming(db, 'zoe', 'me', 'like');
    const res = await api.post('/swipe').send({ targetId: 'zoe', direction: 'like' });
    expect(res.status).toBe(200);
    expect(res.body.matched).toBe(true);
    expect(Object.keys(res.body.match).sort()).toEqual(['matchedAt', 'profile']);
    expect(res.body.match.profile.id).toBe('zoe');
    expect(Object.keys(res.body.match.profile).sort()).toEqual([...PUBLIC_PROFILE_KEYS].sort());
  });

  it('pass on a liker and like on a passer look exactly like a stranger ⭐', async () => {
    incoming(db, 'dan', 'me', 'like');
    incoming(db, 'bob', 'me', 'pass');
    const passOnLiker = await api.post('/swipe').send({ targetId: 'dan', direction: 'pass' });
    const likeOnPasser = await api.post('/swipe').send({ targetId: 'bob', direction: 'like' });
    const likeOnStranger = await api.post('/swipe').send({ targetId: 'cara', direction: 'like' });
    for (const res of [passOnLiker, likeOnPasser, likeOnStranger]) {
      expect(res.status).toBe(200);
      expect(res.text).toBe('{"matched":false}');
    }
  });

  it.each([
    ['missing body', undefined],
    ['missing targetId', { direction: 'like' }],
    ['empty targetId', { targetId: '  ', direction: 'like' }],
    ['bad direction', { targetId: 'alice', direction: 'superlike' }],
    ['wrong types', { targetId: 42, direction: true }],
    ['extra fields', { targetId: 'alice', direction: 'like', swiperId: 'zoe' }],
    ['array body', [{ targetId: 'alice', direction: 'like' }]],
  ])('%s → 400', async (_name, body) => {
    const req = api.post('/swipe');
    const res = body === undefined ? await req : await req.send(body as object);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('malformed JSON → 400', async () => {
    const res = await api.post('/swipe').set('Content-Type', 'application/json').send('{"targetId":');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Malformed JSON body', code: 'BAD_JSON' });
  });

  it('body over 10kb → 413', async () => {
    const res = await api.post('/swipe').send({ targetId: 'x'.repeat(20_000), direction: 'like' });
    expect(res.status).toBe(413);
    expect(res.body.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('swiping yourself → 400', async () => {
    const res = await api.post('/swipe').send({ targetId: 'me', direction: 'like' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('SELF_SWIPE');
  });

  it('unknown profile → 404', async () => {
    const res = await api.post('/swipe').send({ targetId: 'ghost', direction: 'like' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('second swipe on the same profile → 409', async () => {
    await api.post('/swipe').send({ targetId: 'alice', direction: 'pass' });
    const res = await api.post('/swipe').send({ targetId: 'alice', direction: 'like' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_SWIPED');
  });
});

describe('GET /matches', () => {
  it('empty at first even when people liked me ⭐', async () => {
    incoming(db, 'alice', 'me', 'like');
    const res = await api.get('/matches');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ matches: [] });
  });

  it('contains the profile after a mutual like', async () => {
    incoming(db, 'nina', 'me', 'like');
    await api.post('/swipe').send({ targetId: 'nina', direction: 'like' });
    const res = await api.get('/matches');
    expect(res.body.matches).toHaveLength(1);
    expect(res.body.matches[0].profile.id).toBe('nina');
    expect(typeof res.body.matches[0].matchedAt).toBe('string');
  });
});

describe('errors', () => {
  it('a 500 is generic: no stack trace, no SQL, no internals', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    db.close(); // every query now throws inside the service
    const res = await api.get('/feed');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Something went wrong', code: 'INTERNAL' });
    expect(res.text).not.toMatch(/at |\.ts|sqlite|database|stack/i);
    expect(spy).toHaveBeenCalled(); // logged server side instead
    spy.mockRestore();
  });
});

describe('privacy sweep over the real seed data ⭐', () => {
  /** Every key at any depth of a JSON value. */
  const allKeys = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.flatMap(allKeys)
      : v && typeof v === 'object'
        ? Object.entries(v).flatMap(([k, child]) => [k, ...allKeys(child)])
        : [];

  const ALLOWED_KEYS = new Set([
    ...PUBLIC_PROFILE_KEYS, 'profiles', 'remaining', 'matched', 'match', 'profile', 'matchedAt', 'matches',
  ]);

  it('no response from a full session exposes anything beyond the public contract', async () => {
    const seeded = createDb(':memory:');
    seed(seeded);
    const app = request(createApp(seeded));
    const bodies: unknown[] = [];

    // Swipe through the entire deck the way the client would: like everyone
    // at an even position, pass the rest, refetch in pages of 20.
    let i = 0;
    for (;;) {
      const feed = await app.get('/feed?limit=20');
      bodies.push(feed.body);
      if (feed.body.profiles.length === 0) break;
      for (const p of feed.body.profiles as { id: string }[]) {
        const res = await app.post('/swipe').send({ targetId: p.id, direction: i++ % 2 ? 'pass' : 'like' });
        expect(res.status).toBe(200);
        bodies.push(res.body);
      }
    }
    const matches = await app.get('/matches');
    bodies.push(matches.body);

    // 1. Only contract keys, at every depth.
    for (const body of bodies) {
      for (const key of allKeys(body)) expect(ALLOWED_KEYS).toContain(key);
    }
    // 2. No internal vocabulary anywhere in the raw JSON (the seed bios avoid these words).
    const raw = JSON.stringify(bodies);
    expect(raw).not.toMatch(/liked|direction|swiper|target_id|interests_json/i);

    // 3. Matches are exactly the likers I liked back, nobody else.
    const matchedIds = (matches.body.matches as { profile: { id: string } }[]).map((m) => m.profile.id).sort();
    const likedByMe = new Set(
      (seeded.prepare(`SELECT target_id FROM swipes WHERE swiper_id = 'me' AND direction = 'like'`).all() as { target_id: string }[]).map((r) => r.target_id),
    );
    expect(matchedIds).toEqual(INCOMING_LIKE_IDS.filter((id) => likedByMe.has(id)).sort());
    for (const id of INCOMING_PASS_IDS) expect(matchedIds).not.toContain(id);

    // 4. The deck saw all 36 profiles exactly once, including the 4 who passed on me.
    expect(seeded.prepare(`SELECT COUNT(*) n FROM swipes WHERE swiper_id = 'me'`).get()).toEqual({ n: 36 });
    seeded.close();
  });
});
