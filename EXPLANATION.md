# Coy Discover Tab: Explanation

A running explanation of what we are building, how it works, and why it is shaped this way.
**Kept up to date as the code changes.** Every design choice that has trade-offs gets a matching entry in [DECISIONS.md](DECISIONS.md). The phase-by-phase build plan is in [IMPLEMENTATION.md](IMPLEMENTATION.md).

Last updated: 2026-11-18 (Phase 5 done: swipe deck)

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
- [x] One card at a time (`components/CardDeck.tsx`: top card plus one behind)
- [x] Drag to swipe on mobile, buttons on desktop (plus keyboard arrows) (`components/SwipeCard.tsx`, `CardDeck.tsx`)
- [x] Smooth animations and clear LIKE / NOPE feedback (rotation with drag, fading stamps, spring-back, fly-out)
- [x] A swiped profile never appears again (enforced on the server, not only in the UI). Checked in the browser: after a reload, the next card is always unswiped. *Server side:* the swipes primary key, the `getFeed` filter and `AlreadySwipedError`, tested in `discover-service.test.ts`.
- [ ] Clear empty state (*basic version in Phase 5, polished in Phase 6*)

**Matching**
- [x] A match only when both sides liked each other: `swipe()` in `services/discover-service.ts`, with tests for like/like, like/pass, pass/like and the other side liking second
- [ ] "It's a match!" screen at that moment
- [ ] Matches view listing all mutual matches
- [ ] No way to learn who liked you unless it is mutual (see section 5). *Service layer done:* the whitelist serializer, a shuffle that ignores likes, identical pass and no-match responses. The HTTP layer is checked in Phase 3.

**Backend APIs**
- [x] `GET /feed`: profiles not yet swiped on (`routes/discover.ts`, `tests/api.test.ts`)
- [x] `POST /swipe`: records like/pass, returns whether it created a match
- [x] `GET /matches`: mutual matches
- [x] Swipes and matches persist across reloads (SQLite file. Tested by reopening the DB, and checked by hand across two server processes.)

**App shell**
- [x] Bottom tab bar: blank **Home** tab and **Discover** tab (`client/src/App.tsx`, `components/TabBar.tsx`, `components/HomeTab.tsx`)

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
        ├── api.ts                 → typed fetch wrappers + ApiError
        ├── types.ts               → copy of the server's API contract
        ├── hooks/useUrlState.ts   → ?tab= / &view= state
        ├── hooks/useMatches.ts    → GET /matches (badge, Matches view)
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
| Response fields | Feed profile includes `likedYou: true` | Profiles go through a **whitelist serializer** (`toPublicProfile` in `serializers.ts`). Tests assert the exact set of keys and that joined extras like `liked_you` are dropped. |
| Feed ordering | Likers sorted to the front ("boost" logic) | Order is `sha256(viewer:profile)` (`feedOrderKey`), computed **without looking at incoming likes**. A test compares the feed with and without incoming likes and passes: same order. |
| Swipe response for a pass | `{ matched: false, theyLikedYou: true }` | A pass always returns the same shape `{ matched: false }`, whatever the other side did. |
| Feed filtering | Hiding people who *passed* on you shrinks the feed and reveals rejections | The feed only excludes people **you** swiped on. |
| Match timing | Matches shown before you have liked them | A match row is created only inside your like transaction. `getMatches` reads only the `matches` table, so one-sided likes never appear (tested). |
| Probing by re-swiping | Pass someone, then like them, to see if a match appears | Swipes are final. A second swipe gets `AlreadySwipedError` (409), and the original row is left unchanged (tested). |
| Enumeration | `GET /profiles/:id/likes` or similar | No endpoint reads incoming likes. The only query touching `target_id = me` is inside the match check. |
| Client bundle / devtools | Seed data with likes shipped to the browser | The likes data only exists server side. |

## 6. API contract (implemented in Phase 3)

```
GET  /feed?limit=10
200 → { profiles: Profile[], remaining: boolean }

POST /swipe   { targetId: string, direction: "like" | "pass" }
200 → { matched: false }
200 → { matched: true, match: { profile: Profile, matchedAt } }
400 → invalid body (VALIDATION_ERROR), malformed JSON (BAD_JSON), swiping yourself (SELF_SWIPE)
404 → unknown profile (NOT_FOUND)
409 → already swiped on this profile (ALREADY_SWIPED)
413 → body over 10kb (PAYLOAD_TOO_LARGE)

GET  /matches
200 → { matches: [{ profile: Profile, matchedAt }] }   newest first
```

`Profile = { id, name, age, photoUrl, bio, city, college, interests[] }`. Nothing else.

**Errors** always look like `{ error: string, code: string }`. A validation error also has `issues: [{ path, message }]`, describing only the client's own input. A 500 is always `{ error: "Something went wrong", code: "INTERNAL" }`. The real error is logged on the server, never sent.

`GET /feed?limit=` accepts integers 1–20 (default 10). `POST /swipe` rejects unknown body fields. Every response has `Cache-Control: no-store`.

## 7. Frontend behaviour

**App shell (Phase 4):**
- On a phone it's a full-screen column; on desktop, a centred 430px "phone". The content is on top and the tab bar at the bottom, with safe-area padding for notched phones.
- The tab is kept in `?tab=home|discover`, and the Discover sub-view in `&view=matches`, so a reload keeps your place. This uses query params, never paths, so pages can't collide with `/feed`, `/swipe` and `/matches`.
- Both tab panels stay mounted and the inactive one is `hidden`. Switching tabs never resets the deck.
- The tab bar follows the WAI-ARIA tabs pattern (`role=tablist`, roving tabindex, ←/→/Home/End).
- `api.ts` wraps fetch. Every failure becomes an `ApiError` with `status` and `code`. A network failure is `code: 'NETWORK'`.


**Swipe deck (Phase 5):**
- `hooks/useDiscoverFeed.ts` holds the local queue. It fetches `/feed?limit=10` on mount, and again when ≤ 3 cards are left, **but only when no swipe is in flight**. The server has then recorded everything we swiped and can't send it back. A local `swiped` set is a second guard against duplicates.
- **Swiping is optimistic:** the card leaves at once and `POST /swipe` runs in the background. A network or 500 error puts the card back on top and shows a toast. A 409 or 404 counts as done (nothing to retry).
- **`SwipeCard`:** drag on x only. Rotation is ±15° over ±200px, and the LIKE/NOPE stamps fade in between 20 and 120px. It commits at 120px **or** a 600px/s flick. Otherwise it springs back.
- **Buttons and arrow keys** call the same `swipe()` through a ref. Each card can leave only once, so a double-tap can't send two requests.
- The **next two photos are preloaded**. A broken photo falls back to the person's initial.
- With **`prefers-reduced-motion`**, a swipe fades the card instead of flinging it.

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

### How the service works (Phase 2)

`server/src/services/discover-service.ts` holds three functions. Each takes the database as its first argument.

- **`getFeed(db, me, { limit })`** loads every user except me that *I* haven't swiped on. It sorts them by `sha256("me:" + id)` and returns the first `limit`, plus `remaining`. The query never touches swipes where I am the target.
- **`swipe(db, me, target, direction)`** runs one `IMMEDIATE` transaction:
  1. Reject a self-swipe (400) or an unknown target (404).
  2. Insert the swipe. If the primary key already exists, return 409.
  3. On a pass, return `{ matched: false }` straight away.
  4. On a like, check *only now* whether the target liked me. If so, store the match (sorted pair, `INSERT OR IGNORE`) and return it.
- **`getMatches(db, me)`** joins `matches` to `users` for the other person, newest first.

Errors are typed classes in `errors.ts`, and each carries its HTTP status. Phase 3's error middleware will just read `err.status`.

## 9. How to run

```
npm install        # installs both workspaces
npm run seed       # creates server/data/coy.db with 36 profiles
npm run dev        # Express on :4000 + Vite on :5173 → open http://localhost:5173
npm test           # server unit + API tests
npm run coverage -w server   # coverage report, fails under 90% on services/ and serializers
```

## 10. Changelog

- 2026-11-18: Read the assignment, wrote the initial plan, data model, privacy model and API contract.
- 2026-11-18: Added IMPLEMENTATION.md, which splits the build into phases 0–9 with tasks, tests and completion criteria.
- 2026-11-18: Changed the stack to a React (Vite) frontend and a Node.js + Express backend (D-001 accepted). Updated the architecture, run commands and test approach.
- 2026-11-18: Phase 0 done. npm workspaces with `server/` (Express 5, Vitest, supertest) and `client/` (Vite 8, React 19, Tailwind 4, framer-motion). Verified the dev proxy in the browser. Fixed a port clash (D-011).
- 2026-11-18: Phase 1 done. SQLite schema with constraints and indexes, `createDb()`, 36 seed profiles (12 likers, 4 passers), and an idempotent `npm run seed`. 8 new tests: constraints, seed contents, reseed, and persistence across connections. The schema moved to a TS module (D-012).
- 2026-11-18: Pushed to https://github.com/git28ved/COY.
- 2026-11-18: Phase 2 done. `discover-service.ts` (feed, swipe, matches), a whitelist serializer, and typed errors. 29 new tests, including all the ⭐ privacy tests and a two-connection race. Coverage thresholds are enforced.
- 2026-11-18: Deployment chosen: Render free tier, seed when the DB is empty (D-010). Accepted D-002, D-012 and D-013.
- 2026-11-18: Phase 3 done. Express routes (zod validation, strict body), a central error middleware with stable error codes, a JSON 404, production static serving, and graceful shutdown. 30 new tests, including a full-session privacy sweep over the real seed. 69/69 pass.
- 2026-11-18: Phase 4 done. Tab shell (Home | Discover) with URL-synced tab and view, an accessible tab bar, a Discover/Matches switch with a match-count badge, typed API client and design tokens. Checked in headless Chrome at phone and desktop sizes.
- 2026-11-18: Phase 5 done. Swipe deck: drag, flick, buttons and keys; LIKE/NOPE stamps; optimistic swipes that roll back on failure; prefetch; photo preload; basic loading, error and empty states; match and error toasts. Checked in the browser across all 36 profiles.
