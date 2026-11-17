# Coy Discover Tab: Explanation

A running explanation of what we are building, how it works, and why it is shaped this way.
**Kept up to date as the code changes.** Every design choice that has trade-offs gets a matching entry in [DECISIONS.md](DECISIONS.md). The phase-by-phase build plan is in [IMPLEMENTATION.md](IMPLEMENTATION.md).

Last updated: 2026-11-18 (Phase 1 done: database and seed data)

---

## 1. What the assignment asks for

Coy's SDE intern assignment has two parts:

| Part | What | Status |
|---|---|---|
| A | Use app.getcoy.com and suggest two core features, with reasons | Still required. You write this from your own experience of the app. |
| B | Build a swipe-based **Discover** tab as a standalone app in a public GitHub repo | **This repo** |

The overview says what they grade: *"understanding a live consumer product, thinking about its privacy edge cases, and writing clean, tested backend logic."*
So the reviewer will look closely at three things:

1. **Privacy.** "Never reveal who has liked the user unless it is mutual" is called *the core promise of Coy*. This is the main test.
2. **Backend correctness and tests.** Match logic, no repeat profiles, persistence.
3. **Product polish.** Smooth swipe feel, a clear match moment, a good empty state, mobile-first.

## 2. Requirements checklist

Each item gets ticked off with a pointer to the code and the test that proves it.

**Profile data**
- [x] 30+ seeded profiles (name, age, photo, bio, city/college, interests): 36 in `server/src/seed/profiles.ts`, checked in `tests/db-seed.test.ts`
- [x] Some seeded profiles have already liked the logged-in user: 12 likers (`INCOMING_LIKE_IDS`), plus 4 who passed (`INCOMING_PASS_IDS`) to prove rejections don't leak

**Swipe experience**
- [ ] One card at a time
- [ ] Drag to swipe on mobile, buttons on desktop (plus keyboard arrows)
- [ ] Smooth animations and clear LIKE / NOPE feedback
- [ ] A swiped profile never appears again (enforced on the server, not only in the UI)
- [ ] Clear empty state

**Matching**
- [ ] A match only when both sides liked each other
- [ ] "It's a match!" screen at that moment
- [ ] Matches view listing all mutual matches
- [ ] No way to learn who liked you unless it is mutual (see section 5)

**Backend APIs**
- [ ] `GET /feed`: profiles not yet swiped on
- [ ] `POST /swipe`: records like/pass, returns whether it created a match
- [ ] `GET /matches`: mutual matches
- [ ] Swipes and matches persist across reloads

**App shell**
- [ ] Bottom tab bar: blank **Home** tab and **Discover** tab

## 3. Architecture: React (Vite) + Node.js/Express

See D-001 to D-003 in DECISIONS.md for why.

```
coy-discover/                      npm workspaces root (`npm run dev` starts both)
├── server/                        Node.js + Express + TypeScript
│   ├── src/
│   │   ├── index.ts               → reads env, opens DB, app.listen(4000)
│   │   ├── app.ts                 → createApp(db): Express app (exported for tests)
│   │   ├── routes/discover.ts     → GET /feed, POST /swipe, GET /matches (thin)
│   │   ├── middleware/error.ts    → typed errors → 400/404/409, else generic 500
│   │   ├── db/db.ts, schema.sql   → SQLite connection + schema
│   │   ├── services/discover-service.ts → ALL business logic (pure, testable)
│   │   ├── serializers.ts         → whitelist: what a profile looks like on the wire
│   │   └── seed/                  → 36 profiles + incoming likes
│   └── tests/                     → Vitest unit tests + supertest API tests
└── client/                        React 19 + Vite 8 + TypeScript + Tailwind + Framer Motion
    ├── vite.config.ts             → dev proxy: /feed /swipe /matches → :4000
    └── src/
        ├── App.tsx                → tab shell (Home | Discover)
        ├── api.ts                 → typed fetch wrappers
        ├── hooks/useDiscoverFeed.ts
        └── components/            → SwipeCard, CardDeck, MatchModal, MatchesList, EmptyDeck, TabBar
```

**Request flow:**

```
Browser ──fetch /swipe──▶ (dev: Vite proxy) ──▶ Express route ──▶ discover-service ──▶ SQLite
                                                   ▲ zod validation      ▲ transaction
                                                   └── error middleware ◀┘ typed errors
```

**Layering rule:** Express routes only parse input and format output. Every rule (can I swipe this? is it a match?) lives in `discover-service.ts`. Tests can then exercise the logic against an in-memory SQLite database with no HTTP involved, and `createApp(db)` lets supertest test the real HTTP layer too.

The API is served at **exactly** `/feed`, `/swipe` and `/matches`, as the spec says. In production, Express also serves the built React app (`client/dist`), so the whole thing is one process and one deploy.

## 4. Data model (SQLite)

```sql
users(id, name, age, bio, photo_url, city, college, interests_json, created_at)
-- id = 'me' is the single logged-in user

swipes(
  swiper_id  REFERENCES users(id),
  target_id  REFERENCES users(id),
  direction  TEXT CHECK (direction IN ('like','pass')),
  created_at,
  PRIMARY KEY (swiper_id, target_id)       -- one swipe per pair, ever
)

matches(
  user_a, user_b,                          -- stored with user_a < user_b
  created_at,
  PRIMARY KEY (user_a, user_b)
)
```

- Seeded "they already liked me" data is just rows in `swipes` where `target_id = 'me'`. Nothing special about it, and nothing exposes it.
- The primary key on `swipes` makes "never appears again" a **database guarantee**, not just UI behaviour.
- `CHECK` constraints also block a self-swipe (`swiper_id <> target_id`) and a match stored in the wrong order (`user_a < user_b`). Foreign keys are turned on per connection.
- The schema is in `server/src/db/schema.ts` (D-012). `createDb()` applies it on every start, and every statement is `IF NOT EXISTS`.

## 5. Privacy model: how "never reveal who liked you" is enforced

This is the part we should be able to explain in an interview. Leaks can come through more channels than the obvious one:

| Leak channel | Example of the bug | Our defence |
|---|---|---|
| Response fields | Feed profile includes `likedYou: true` | Profiles go through a **whitelist serializer**. Tests assert the exact set of keys. |
| Feed ordering | Likers sorted to the front ("boost" logic) | Order is computed **without looking at incoming likes** (deterministic shuffle). A test checks that order is independent of likes. |
| Swipe response for a pass | `{ matched: false, theyLikedYou: true }` | A pass always returns the same shape `{ matched: false }`, whatever the other side did. |
| Feed filtering | Hiding people who *passed* on you shrinks the feed and reveals rejections | The feed only excludes people **you** swiped on. |
| Match timing | Matches shown before you have liked them | A match row is created only inside your like transaction. |
| Enumeration | `GET /profiles/:id/likes` or similar | No endpoint reads incoming likes. The only query touching `target_id = me` is inside the match check. |
| Client bundle / devtools | Seed data with likes shipped to the browser | The likes data only exists server side. |

## 6. API contract (draft)

```
GET  /feed?limit=10
200 → { profiles: Profile[], remaining: boolean }

POST /swipe   { targetId: string, direction: "like" | "pass" }
200 → { matched: false }
200 → { matched: true, match: { profile: Profile, matchedAt } }
400 → invalid body / swiping yourself
404 → unknown profile
409 → already swiped on this profile

GET  /matches
200 → { matches: [{ profile: Profile, matchedAt }] }   newest first
```

`Profile = { id, name, age, photoUrl, bio, city, college, interests[] }`. Nothing else.

## 7. Frontend behaviour

- **Card stack:** the top card is draggable, and the next card sits behind it (scaled down slightly) so the next swipe feels instant.
- **Gestures:** drag past a threshold (or flick fast enough) to commit. Otherwise the card springs back. The card rotates with drag distance. LIKE and NOPE stamps fade in with direction.
- **Desktop:** ✕ / ♥ buttons plus ← / → keys.
- **Optimistic UI:** the card leaves at once and the request runs in the background. On failure the card comes back with a toast.
- **Prefetch:** fetch more profiles when 3 or fewer are left in the local stack.
- **Match moment:** a full-screen "It's a match!" overlay with both photos, plus "Keep swiping" and "View matches".
- **Empty state:** a friendly message with a link to Matches.

## 8. Testing plan

- **Unit (service layer, in-memory SQLite):** like → no match; like → match when they liked first; pass never matches; double swipe rejected; feed excludes swiped; feed excludes self; match created exactly once; concurrent double-like does not create 2 matches.
- **Privacy tests:** exact key set of a serialized profile; feed order is identical with or without incoming likes; pass response identical whether or not they liked you.
- **API tests (supertest against `createApp(memoryDb)`):** status codes and shapes for each endpoint.
- **(Stretch) E2E:** Playwright swipe → match → appears in Matches → reload persists.

## 9. How to run

```
npm install        # installs both workspaces
npm run seed       # creates server/data/coy.db with 36 profiles
npm run dev        # Express on :4000 + Vite on :5173 → open http://localhost:5173
npm test           # server unit + API tests
```

## 10. Changelog

- 2026-11-18: Read the assignment, wrote the initial plan, data model, privacy model and API contract.
- 2026-11-18: Added IMPLEMENTATION.md, which splits the build into phases 0–9 with tasks, tests and completion criteria.
- 2026-11-18: Changed the stack to a React (Vite) frontend and a Node.js + Express backend (D-001 accepted). Updated the architecture, run commands and test approach.
- 2026-11-18: Phase 0 done. npm workspaces with `server/` (Express 5, Vitest, supertest) and `client/` (Vite 8, React 19, Tailwind 4, framer-motion). Verified the dev proxy in the browser. Fixed a port clash (D-011).
- 2026-11-18: Phase 1 done. SQLite schema with constraints and indexes, `createDb()`, 36 seed profiles (12 likers, 4 passers), and an idempotent `npm run seed`. 8 new tests: constraints, seed contents, reseed, and persistence across connections. The schema moved to a TS module (D-012).
