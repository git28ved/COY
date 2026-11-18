# Coy Discover Tab: Implementation Plan

The step-by-step build plan. Each phase ends in something runnable and testable, with a commit.
- *What* and *how it works*: [EXPLANATION.md](EXPLANATION.md)
- *Why*: [DECISIONS.md](DECISIONS.md)
- *In what order, and when is it done*: this file

**Stack:** React 19 + Vite 8 + TypeScript + Tailwind + Framer Motion (client) · Node.js + Express + TypeScript + SQLite (server) · Vitest + supertest (tests). See D-001.

Status legend: ⬜ not started · 🟨 in progress · ✅ done

Last updated: 2026-11-18 (Phase 7 done)

---

## Progress overview

| # | Phase | Status | Est. |
|---|---|---|---|
| 0 | Project setup (workspaces) | ✅ | 1h |
| 1 | Database and seed data | ✅ | 1.5h |
| 2 | Service layer and unit tests | ✅ | 2.5h |
| 3 | Express routes and API tests | ✅ | 1.5h |
| 4 | React app shell and tab bar | ✅ | 1h |
| 5 | Swipe card and deck | ✅ | 3h |
| 6 | Match overlay, Matches view, empty state | ✅ | 2h |
| 7 | Polish, accessibility, error handling | ✅ | 1.5h |
| 8 | README, demo GIF, deployment | ⬜ | 1.5h |
| 9 | Stretch goals (optional) | ⬜ | — |

Rule of thumb: **backend first (phases 1–3), fully tested, before any UI.** The backend is what Coy says it grades. The UI then sits on a contract that is already proven.

---

## Phase 0: Project setup ✅

**Done 2026-11-18.** Commit: `chore: scaffold workspaces`.

**What exists now**
```
Coy-app/
├── package.json            workspaces ["server","client"], concurrently dev script
├── .gitignore / .nvmrc     node 22; DB files ignored
├── server/                 Express 5 + TS (ESM, NodeNext), Vitest 5, supertest, tsx
│   ├── src/app.ts          createApp(): json limit 10kb, no x-powered-by, Cache-Control: no-store, GET /health
│   ├── src/index.ts        listen on API_PORT (dev) or PORT (prod), default 4000 (D-011)
│   ├── src/seed/seed.ts    placeholder until Phase 1
│   └── tests/app.test.ts   2 tests: /health and the security/caching headers
└── client/                 Vite 8 + React 19 + TS + Tailwind 4 + framer-motion, oxlint
    ├── vite.config.ts      proxies /feed /swipe /matches /health → :4000
    └── src/App.tsx         placeholder that shows "API: ok" when the proxy works
```

**Checks**
- [x] `npm run dev` starts both; the browser shows "API: ok" through the proxy
- [x] `npm test`: 2/2 pass
- [x] `npm run typecheck`, `npm run lint` and `npm run build`: clean
- [x] `git init` and first commit
- [x] Public GitHub repo created and pushed: https://github.com/git28ved/COY

**Notes**
- The scaffolder picked React 19 (not 18) and TypeScript 7. Both are fine for this project.
- `npm audit` reports 6 "high" issues, all from **picomatch** (ReDoS) inside Vite's dev tooling. The advisory covers every published version, so no fix exists yet. It only runs at build or dev time on our own file globs and is never shipped to users. Recheck before submitting.

## Phase 1: Database and seed data ✅

**Done 2026-11-18.** Commit: `feat(db): schema and seed`.

**Checks**
- [x] `npm run seed` → `select count(*) from users` gives 37; swipes: 12 likes and 4 passes towards `me`
- [x] `server/tests/db-seed.test.ts`: 8 tests (schema constraints, seed contents, idempotent reseed, persistence across connections). `npm test` 10/10.
- [x] `npm run typecheck` and `npm run build -w server` clean

**Changes from the plan**
- The schema is `db/schema.ts` (an exported string), not `schema.sql`. `tsc` doesn't copy `.sql` files into `dist/`, so the production build couldn't find them (D-012).
- The default DB path is resolved from the server folder, not the current directory, so `npm run seed` and `npm start` always use `server/data/coy.db`, wherever they're run from.
- The schema also has `CHECK` constraints: `swiper_id <> target_id` and `user_a < user_b`. The database itself blocks self-swipes and duplicate match pairs.
- `seed(db)` is an exported function, so tests seed `:memory:` with the real data. The CLI entry only runs when the file is executed directly.

**Files** (`server/src/`)
- `db/db.ts`: `createDb(path = process.env.DB_PATH ?? 'data/coy.db')` turns on `foreign_keys` and WAL mode, then runs the schema. Tests pass `':memory:'`.
- `db/schema.ts` (planned as `schema.sql`): the `users`, `swipes` and `matches` tables (EXPLANATION section 4), plus indexes:
  - `swipes(target_id, swiper_id)`: used by the reverse lookup in the match check
  - `matches(user_a)` and `matches(user_b)`
- `constants.ts`: `CURRENT_USER_ID = 'me'`
- `seed/profiles.ts`: 36 hand-written profiles
- `seed/seed.ts`: wipes and inserts `me` and the 36 profiles, then the incoming likes

**Seed details (D-008)**
- 36 profiles with a mix of ages 19–26 and cities/colleges (Delhi, Mumbai, Bangalore, Pune; IIT, DU, BITS, NMIMS…)
- Interests come from a fixed vocabulary of about 25 tags so chips render consistently
- 12 profiles get a `swipes` row `(theirId → 'me', 'like')`, chosen by fixed IDs so the demo is reproducible
- 4 profiles get `(theirId → 'me', 'pass')`. This proves rejections never leak.
- Seed runs in one transaction and is safe to run again

**Done when:** `npm run seed` then `sqlite3 server/data/coy.db "select count(*) from users"` gives 37.

---

## Phase 2: Service layer and unit tests ⭐ most important phase ✅

**Done 2026-11-18.** Commit: `feat(core): discover service with tests`.

**Checks**
- [x] 29 new tests (`discover-service.test.ts` 25, `serializers.test.ts` 4). `npm test`: 39/39 pass.
- [x] `npm run coverage -w server`: `services/` is at 97% of lines and 91% of branches. `serializers.ts` is at 100%. The thresholds are enforced in `vitest.config.ts`.
- [x] Typecheck, lint and build are clean.

**Changes from the plan**
- `swipe()` runs as `transaction.immediate()`, which takes the write lock before any check. Two server processes can't both pass the "already swiped?" check for the same pair.
- `getFeed` also checks `limit` itself: an integer from 1 to 50 (`ValidationError`). The route will narrow it to 1–20.
- The shuffle key is `sha256(userId + ':' + profileId)` (`feedOrderKey`). Ties can't happen in practice, and the order is the same on every reload.
- `getMatches` breaks ties on `rowid` when two matches share the same millisecond, so "newest first" always holds.
- `tests/helpers.ts` has a small fixture (`me`, plus alice, bob, cara, dan, nina and zoe). Some ids sort before `me` and some after, so both pair orders are tested. Phase 3 will reuse it.
- Extra tests beyond the list: no turning a pass into a like to probe for a match; a match made from the other side; both users see the match; two DB connections double-liking create one match; the feed JSON contains no internal field names.


**File:** `server/src/services/discover-service.ts`. Every function takes `db` as its first argument (D-003).

```ts
getFeed(db, userId, { limit }): { profiles: PublicProfile[]; remaining: boolean }
swipe(db, userId, targetId, direction): SwipeResult
getMatches(db, userId): { profile: PublicProfile; matchedAt: string }[]
```

**`getFeed` logic**
```sql
SELECT u.* FROM users u
WHERE u.id != :me
  AND NOT EXISTS (SELECT 1 FROM swipes s WHERE s.swiper_id = :me AND s.target_id = u.id)
```
Then sort by `hash(userId + ':' + u.id)` (D-005). **This query never reads swipes where `target_id = me`.**

**`swipe` logic** (inside a `db.transaction`)
1. Reject if `targetId === userId` → `SelfSwipeError`
2. Reject if the target doesn't exist → `NotFoundError`
3. `INSERT INTO swipes`; a primary key conflict (`SQLITE_CONSTRAINT_PRIMARYKEY`) → `AlreadySwipedError`
4. If `direction === 'pass'` → return `{ matched: false }`
5. Check the reverse like: `SELECT 1 FROM swipes WHERE swiper_id = target AND target_id = me AND direction = 'like'`
6. If it exists → `INSERT OR IGNORE INTO matches (min, max)` → return `{ matched: true, match }`
7. Otherwise → `{ matched: false }`

**`serializers.ts`:** `toPublicProfile(row)` builds an explicit object with `id, name, age, photoUrl, bio, city, college, interests` (D-004).

**`errors.ts`:** typed errors (`NotFoundError`, `AlreadySwipedError`, `SelfSwipeError`, `ValidationError`) that carry a `status`, which the error middleware reads.

**Tests (`server/tests/discover-service.test.ts`)**, each on a fresh `:memory:` DB with a small fixture:
- [x] feed excludes self
- [x] feed excludes profiles I liked or passed
- [x] feed *includes* profiles who passed on me (D-006)
- [x] feed order is identical with and without incoming likes (D-005) ⭐
- [x] feed order is stable across calls
- [x] like with no incoming like → `{ matched: false }`
- [x] like when they already liked me → `{ matched: true }` and a match row exists
- [x] like when they passed on me → `{ matched: false }`, identical to the no-swipe case ⭐
- [x] pass when they liked me → `{ matched: false }`, no match ⭐
- [x] second swipe on the same profile → `AlreadySwipedError`, and the original swipe is unchanged
- [x] swipe on self → `SelfSwipeError`
- [x] swipe on unknown id → `NotFoundError`
- [x] the match is created exactly once (pair ordering `a < b`)
- [x] `getMatches` returns newest first, only mutual ones
- [x] persistence: write with one `createDb(tmpFile)` handle, read with a new handle

**Tests (`server/tests/serializers.test.ts`)**
- [x] `Object.keys(toPublicProfile(row)).sort()` equals the exact whitelist ⭐
- [x] extra columns on the row (e.g. `liked_you`) are dropped

**Done when:** all of the above pass and coverage of `services/` and `serializers.ts` is ≥ 90% (`vitest --coverage`).

---

## Phase 3: Express routes and API tests ✅

**Done 2026-11-18.** Commit: `feat(api): express routes with supertest`.

**Checks**
- [x] `npm test`: 69/69 pass (30 new: 26 in `api.test.ts`, plus 4 in `app.test.ts` covering the JSON 404 and production static serving)
- [x] Smoke test against the real server with curl: `/feed`, a seeded liker → `matched: true`, a repeat swipe → 409, and the match shows up in `/matches`
- [x] Production build (`NODE_ENV=production node dist/index.js`) serves the React `index.html` at `/` and the API on the same port
- [x] Typecheck, lint and build are clean. Routes and middleware are at 100% coverage.

**Changes from the plan**
- `POST /swipe` body schema is `.strict()`, so unknown fields such as `swiperId` get a 400. Clients can't even try to act as someone else.
- `targetId` is trimmed, 1–64 characters. A body over 10kb → 413 `PAYLOAD_TOO_LARGE`.
- Every error body is `{ error, code }` with a stable machine `code` (`VALIDATION_ERROR`, `BAD_JSON`, `SELF_SWIPE`, `NOT_FOUND`, `ALREADY_SWIPED`, `INTERNAL`, ...). The client will switch on `code`, not on message text.
- Unknown routes → JSON 404. In production, a GET that accepts HTML gets `index.html`, and API JSON 404s are still returned.
- `index.ts` closes the DB on SIGINT/SIGTERM so WAL data is flushed when Render stops the service.
- **Privacy sweep test:** swipes through the whole real seed deck over HTTP and checks that every key, at any depth of every response, is in the contract. It also checks that no internal words (`liked`, `direction`, `swiper`...) appear, and that the matches are exactly the likers I liked back.
- The "no `liked`/`direction`/`swiper` strings" rule applies to success responses. A 400 may name the field the client sent wrong (e.g. `direction`). That only echoes the client's own input.


**Files** (`server/src/`)
- `app.ts`: `createApp(db)`:
  ```ts
  const app = express();
  app.use(express.json({ limit: '10kb' }));
  app.disable('x-powered-by');
  app.use((_, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/health', ...);
  app.use(discoverRouter(db));
  if (production) serve client/dist with an index.html fallback
  app.use(errorHandler);
  ```
- `routes/discover.ts`: `discoverRouter(db)`
  - `GET /feed`: `limit` query (1–20, default 10) checked with zod
  - `POST /swipe`: body `{ targetId: string, direction: 'like'|'pass' }` checked with zod
  - `GET /matches`
- `middleware/error.ts`: zod error → 400; typed errors → their `status`; malformed JSON → 400; anything else → 500 `{ error: 'Something went wrong' }` (no stack traces to the client; logged on the server)
- `index.ts`: `createApp(createDb()).listen(PORT ?? 4000)`

**Tests (`server/tests/api.test.ts`)**, using `request(createApp(memoryDbWithFixture))`:
- [x] `GET /feed` → 200 with the right shape
- [x] `GET /feed?limit=abc` → 400
- [x] `POST /swipe` with a bad body or malformed JSON → 400
- [x] `POST /swipe` on an unknown id → 404
- [x] `POST /swipe` twice → 409
- [x] `POST /swipe` like on a seeded liker → `matched: true`
- [x] `GET /matches` after that → contains the profile
- [x] no response body anywhere contains the strings `liked`, `direction` or `swiper` ⭐
- [x] a 500 never includes a stack trace

**Done when:** `curl localhost:4000/feed` works and all server tests pass.

---

## Phase 4: React app shell and tab bar ✅

**Done 2026-11-18.** Commit: `feat(ui): tab shell`.

**Checks** (driven in headless Chrome at 390×844 with touch, using playwright-core against the running dev server)
- [x] Opens on Discover by default (`?tab=discover`)
- [x] Clicking Home → `?tab=home`, and the Discover panel is `hidden`. A reload stays on Home.
- [x] ←/→ on the focused tab switches tabs, and focus follows (WAI-ARIA tabs pattern)
- [x] Discover | Matches switch → `?tab=discover&view=matches`, kept after a reload
- [x] After a match exists, the Matches badge shows the count ("1 match")
- [x] Desktop (1280×800): the app sits in a centred phone frame
- [x] No console errors. Typecheck, lint and build are clean.

**Changes from the plan**
- **Default tab is Discover** when there's no `?tab=`, so a reviewer lands straight on the product. Home is still the first tab in the bar.
- **The Discover sub-view is in the URL too** (`&view=matches`), not just the tab.
- **Both tab panels stay mounted.** The inactive one gets the `hidden` attribute, so going to Home and back never loses the deck position or refetches it.
- **`replaceState`, not `pushState`:** switching tabs doesn't fill the back-button history.
- **`hooks/useMatches.ts`** was added now, because the Matches badge needs it. Phase 6 reuses it, along with its `add()` for instant updates after a match.
- **`api.ts`** turns network failures into `ApiError(0, 'NETWORK')` and server errors into `ApiError(status, code)` from the `{ error, code }` body.
- **Design tokens** are in `index.css` `@theme`: `brand`, `like`, `nope`, `ink`, `ink-muted`, `surface`, `backdrop`.


**Files** (`client/src/`)
- `main.tsx`, `index.css`: Tailwind; mobile-first container (max-width ~430px centred on desktop), `100dvh`, safe-area padding
- `types.ts`: `Profile`, `SwipeResult`, `Match` (copied from the server's types)
- `api.ts`: `getFeed(limit)`, `postSwipe(targetId, direction)`, `getMatches()`. These throw a typed `ApiError` with the status.
- `App.tsx`: holds the active tab in state, synced to `?tab=` so a reload keeps the tab
- `components/TabBar.tsx`: fixed bottom bar with **Home** and **Discover** icons and an active state, `role="tablist"`
- `components/HomeTab.tsx`: blank, as the brief requires
- `components/DiscoverTab.tsx`: has its own sub-switch: **Discover** (deck) | **Matches** (with a count badge)

**Done when:** you can switch between tabs on a phone-sized viewport and a reload keeps the tab.

---

## Phase 5: Swipe card and deck ✅

**Done 2026-11-18.** Commit: `feat(ui): swipe deck`.

**Checks** (headless Chrome at 390×844, against the dev server, all 36 seed profiles)
- [x] A short drag springs back and keeps the same card. A long drag left passes. The LIKE/NOPE stamps fade in as you drag.
- [x] The ♥ button, the ← key and the → key each advance one card
- [x] A rapid double-tap on ♥ sends **1** request (the input lock works)
- [x] Offline (`/swipe` aborted): the card comes back on top, with the toast "You're offline. Card put back."
- [x] Liking seeded likers → a match toast, and the Matches badge count goes up
- [x] After a reload, the top card is the server's next unswiped profile. No swiped profile comes back.
- [x] Swiping through the whole deck → "You're all caught up", and the server feed is `[]`. 37 requests in total: 36 plus the 1 deliberately failed offline.
- [x] No console errors. Typecheck, lint and build are clean. Server tests are 69/69.

**Changes from the plan**
- **No `dragSnapToOrigin`.** On release, the card either flies out or springs back to 0 by our own `animate()` call, so the two animations never fight. `dragMomentum={false}`.
- **One `SwipeCard` component for both positions** (top and behind), keyed by profile id. When the top card leaves, the one behind keeps its instance and springs from 0.95 to 1 scale.
- **The feed only fetches when no swipe is in flight.** Then the server already knows every card we've swiped and never sends one back. A local `swiped` set is a second guard.
- **Feed and matches state live in `DiscoverTab`, not the deck.** Flipping to Matches and back keeps the queue.
- **Pulled forward from Phase 6/7:** a basic skeleton, error + Retry, an "all caught up" empty state, `Toast`, and `prefers-reduced-motion` (a fade instead of the fly-out). Phase 6 polishes them.
- **A match currently shows a toast.** Phase 6 replaces it with the full-screen overlay.
- **Photos** fall back to the person's initial on a gradient if the image fails to load.


**Files** (`client/src/`)
- `components/SwipeCard.tsx`
  - `motion.div` with `drag="x"`, `dragSnapToOrigin`
  - `x = useMotionValue(0)`; `rotate = useTransform(x, [-200, 200], [-15, 15])`
  - LIKE stamp opacity `useTransform(x, [20, 120], [0, 1])`; NOPE stamp mirrored
  - `onDragEnd`: commit if `|offset.x| > 120` **or** `|velocity.x| > 600`; otherwise spring back
  - Fly-out: `animate(x, ±window.innerWidth * 1.5)`, then call `onSwiped`
  - Content: photo, a gradient overlay with name and age, city/college, bio, interest chips
  - `touch-action: pan-y` so vertical page scroll still works on mobile
- `components/CardDeck.tsx`
  - Renders the top 2 cards; the back card is at `scale 0.95` and animates to 1 when it becomes the top card
  - ✕ and ♥ buttons trigger the same fly-out programmatically (through a ref)
  - Keyboard: `←` pass, `→` like (only while the Discover tab is active and no modal is open)
  - Locks input while a fly-out runs, so a double tap can't swipe twice
- `hooks/useDiscoverFeed.ts`
  - Holds the local queue. Fetches `/feed` on mount, and again when ≤ 3 cards are left.
  - `swipe(profile, dir)`: removes the card optimistically, `POST /swipe`, and on error puts it back and shows a toast (a 409 is treated as success: already recorded)
  - If the result is `matched` → raises a `onMatch(match)` event
  - De-duplicates by id when merging fetched pages
  - Preloads the next 2 photos with `new Image().src = ...`

**Done when:** you can swipe through the whole deck with mouse, touch and keys; it feels smooth at 60fps; after a reload no swiped profile comes back.

---

## Phase 6: Match overlay, Matches view, empty state ✅

**Done 2026-11-18.** Commit: `feat(ui): match modal and matches view`.

**Checks** (headless Chrome at 390×844)
- [x] Matches view with no matches → "No matches yet", and **Keep swiping** goes back to the deck
- [x] Liking a seeded liker opens "It's a match! You and Naina like each other." with focus on **Keep swiping**
- [x] While the overlay is open, → doesn't swipe the card behind it. Tab cycles between the two buttons only, and Esc closes it.
- [x] Arrow keys work again after it closes
- [x] **View matches** → `&view=matches`, newest first ("Yash, 19", then "Naina, 21"), with "Matched just now"
- [x] After a reload, the Matches list is identical
- [x] Swiping to the end → the illustrated "You're all caught up" with **See your 11 matches**. The ✕/♥ buttons are hidden.
- [x] No console errors. Typecheck, lint and build are clean. Server tests are 69/69.

**Changes from the plan**
- **The overlay shows a "You" tile, not your photo.** The API has no `/me` endpoint, and adding one only for this felt like needless API surface.
- **The overlay renders into the phone frame** (`#app-frame`, through a portal), so on desktop it covers the app, not the whole page.
- **Matches made in quick succession queue up** and show one overlay at a time. **View matches** clears the queue.
- **Opening the Matches view quietly re-syncs with `GET /matches`.**
- **"Matched 5 min. ago"** uses `Intl.RelativeTimeFormat` (`lib/time.ts`) and refreshes every minute.
- **Q-2 (photos) is deferred.** We'll come back to it.


**Files** (`client/src/components/`)
- `MatchModal.tsx`: full-screen overlay with "It's a match!", the user's and match's photos sliding in, a light confetti or heart burst, and **Keep swiping** / **View matches** buttons. Focus is trapped inside and `Esc` closes it. Uses `AnimatePresence`.
- `MatchesList.tsx`: grid of matched profiles (photo, name, matched time as "2m ago"). A friendly empty state: "No matches yet. Keep swiping!"
- `EmptyDeck.tsx`: "You're all caught up" with an illustration and a button to the Matches view
- `CardSkeleton.tsx` for loading, and an error state with **Retry**
- `Toast.tsx`: a small toast for network errors

**Done when:** liking a seeded liker shows the overlay, the match appears in Matches, and both survive a reload.

---

## Phase 7: Polish, accessibility, error handling ✅

**Done 2026-11-18.** Commit: `polish: a11y, performance and privacy audit`.

- [x] Buttons have `aria-label`s, and the card has an accessible name ("Priya, 21, Delhi University"). Done in Phase 5.
- [x] `prefers-reduced-motion` (`useReducedMotion`) replaces the fly-out with a fade, and the match overlay drops its burst and slide. A full browser session with reduced motion on swiped every card.
- [x] Image `alt` text, `loading="eager"` on the top card, `decoding="async"`
- [x] Haptic feedback on mobile (`navigator.vibrate?.(10)`) when a swipe commits. *Not testable in headless Chrome. It's a no-op where unsupported, e.g. iOS Safari.*
- [x] Toast on network failure, and the card comes back. Done in Phase 5.
- [x] **Lighthouse on mobile (production build), two runs: Performance 96 · Accessibility 100 · Best Practices 100 · SEO 100.** FCP 1.6 s, LCP 2.4–2.7 s, CLS 0.
- [x] Lint and `tsc --noEmit` are clean in both workspaces

**Added in this phase**
- **Screen-reader announcements:** a hidden `role=status` region says "Liked Myra." / "Passed on Naina." after each swipe. Checked in the browser.
- **`ErrorBoundary` around the app:** a render crash shows "Something went wrong" with a Reload button instead of a blank page. *Not exercised in the browser; there's no safe way to trigger a crash without test-only code.*
- **Performance fixes found by Lighthouse** (it scored 81 before):
  - gzip through `compression` (the JS goes from 226 KB to about 71 KB)
  - `/assets/*` cached for a year as `immutable`, with HTML on `no-cache`. That also re-enables the back/forward cache, which a blanket `no-store` had blocked.
  - `robots.txt`, a meta description and `theme-color`
  - a preconnect to the photo host
- **Security headers on every response:** `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`. A CSP is deferred until the photo host is settled (Q-2).
- **Frontend privacy audit:**
  - The built bundle has no seed data, ids or internal field names. `direction` only appears as CSS `flex-direction`, inside the animation library, and in the client's own outgoing swipe.
  - In a full browser session, all 43 API responses held only contract keys.
- Server tests: 72 (+3: security headers, cache headers per file type, gzip).

## Phase 8: README, demo, deployment

- [ ] `README.md`: one-line pitch, GIF, live link, quick start, API table, **Privacy section** (a short version of EXPLANATION section 5), test command and output, project structure, trade-offs and what I'd do next
- [ ] Record a 20–30s GIF: swipe → match → Matches → reload
- [ ] Deploy as **one Render free web service** (D-010): build `npm ci && npm run build`, start `npm start`. The server seeds on startup if the DB is empty, with no disk. Add `render.yaml`, and a cold-start note in the README.
- [ ] GitHub Actions: `lint`, `typecheck` and `test` on push (a green badge in the README)
- [ ] Final pass over EXPLANATION.md so every checklist item points to code and tests

---

## Phase 9: Stretch goals (only after 0–8 are done)

Pick from Q-3 in DECISIONS.md:
- Playwright E2E: swipe → match → reload persists
- Undo last *pass* only (never a like, so it can't be used to probe for matches)
- Filters for age range and city
- Unmatch: removes the match and keeps both swipes, so neither profile reappears
- Frontend component tests with Vitest + React Testing Library

---

## Commit plan

One commit per phase, using conventional commits:
`chore: scaffold workspaces`, `feat(db): schema and seed`, `feat(core): discover service with tests`, `feat(api): express routes with supertest`, `feat(ui): tab shell`, `feat(ui): swipe deck`, `feat(ui): match modal and matches view`, `polish: a11y and error states`, `docs: README and demo`.

A clean history like this helps when a reviewer reads the repo.

## Definition of done (whole project)

- [ ] Every checklist item in EXPLANATION section 2 is ticked, with code and test references
- [ ] `npm test` is green and covers all ⭐ privacy tests
- [ ] A fresh clone → `npm install && npm run seed && npm run dev` works first time
- [ ] The README explains the privacy model in plain words
- [ ] Every DECISIONS.md entry is Accepted or Superseded, with no Proposed left
