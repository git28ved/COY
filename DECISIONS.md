# Coy Discover Tab: Decision Log

One entry per decision that has trade-offs. Format: context → options → decision → consequences.
Status: **Proposed** (needs your OK), **Accepted**, **Superseded by D-xxx**.

Explanations of *how* things work live in [EXPLANATION.md](EXPLANATION.md). This file records *why*.

---

## D-001: Stack: React (Vite) frontend and Node.js + Express backend, in TypeScript
**Status:** Accepted (your choice, 2026-11-18). Replaces the earlier Next.js proposal.

**Context:** The brief allows "React.js or Next.js" for the frontend and "Node.js with Express, or Next.js API routes" for the backend.

**Options:**
1. Next.js frontend and route handlers in one repo
2. React (Vite) frontend and a separate Express server ← **chosen**
3. Next.js frontend and a separate Express server

**Decision:** Option 2. One repo with npm workspaces: `client/` (Vite + React + TS) and `server/` (Express + TS).

**Why:**
- Express serves the spec's paths **exactly** (`GET /feed`, `POST /swipe`, `GET /matches`), with no rewrites.
- A clear frontend/backend split makes the backend easy to review and test on its own, and the brief emphasises backend logic.
- A `createApp(db)` factory lets tests build the whole HTTP app on an in-memory DB with `supertest`, which gives real HTTP tests.
- Vite has a fast dev loop and a simple static build.

**Consequences:**
- In development, Vite runs on :5173 and proxies `/feed`, `/swipe` and `/matches` to Express on :4000. One `npm run dev` starts both through `concurrently`.
- In production, Express serves the built `client/dist` alongside the API, so it is still **one process and one deploy**.
- The frontend switches tabs with state plus a `?tab=` query, not paths, so page URLs never collide with API paths.
- The `Profile` type is defined in the server and copied to the client as `client/src/types.ts`. A shared package would be overkill at this size.

---

## D-002: Storage: SQLite via better-sqlite3
**Status:** Proposed

**Options:** JSON file, SQLite, Postgres (hosted).

**Decision:** SQLite.

**Why:**
- A JSON file has no transactions or unique constraints. "A swipe happens once" and "a match is created once" would have to be hand-rolled and would race.
- SQLite gives a `PRIMARY KEY (swiper_id, target_id)` and real transactions with no extra infrastructure.
- `:memory:` databases make tests fast and isolated.
- Postgres would be overkill for one user and adds setup for the reviewer.

**Consequences:** Express is a long-running process, so it fits hosts with a persistent disk (Render or Railway, see D-010). Serverless hosts like Vercel are out unless we swap to Turso.

---

## D-003: All business logic in a service layer, not in route handlers
**Status:** Proposed

**Decision:** `server/src/services/discover-service.ts` exposes `getFeed(db, userId)`, `swipe(db, userId, targetId, dir)` and `getMatches(db, userId)`. Express routes only validate (zod), call the service and serialize. A central error middleware maps typed errors to status codes.

**Why:** The brief explicitly grades "clean, tested backend logic". Pure functions over an injected DB are trivially unit-testable, and `createApp(db)` makes the HTTP layer testable with supertest.

---

## D-004: Privacy: whitelist serializer for every profile sent to the client
**Status:** Proposed

**Decision:** One `toPublicProfile(row)` function builds a new object with explicit fields. Rows are never spread (`...row`) into responses.

**Why:** A blacklist ("delete likedYou") fails open when someone adds a column later. A whitelist fails closed. A test pins the exact key set.

---

## D-005: Privacy: feed ordering must not depend on incoming likes
**Status:** Proposed

**Context:** A common "optimisation" is to put people who already liked you early in the deck so matches happen faster. Then the first few cards reveal likers, which is a side-channel leak of Coy's core promise.

**Decision:** Order the feed with a deterministic shuffle (hash of `userId + profileId`) that never reads incoming swipes. This order is also stable across reloads.

**Consequences:** Demo matches show up at random positions rather than first. To keep the demo lively, roughly a third of seeded profiles like the user (D-008).

---

## D-006: Privacy: identical response for a pass, and a feed that only excludes your own swipes
**Status:** Proposed

**Decision:**
- `POST /swipe` with `pass` always returns `{ matched: false }`.
- A `like` without mutual interest also returns `{ matched: false }`, so you can't tell "they haven't seen me" from "they passed".
- The feed does **not** hide people who passed on you.

**Why:** Each of these would otherwise leak someone else's choice.

---

## D-007: Repeat swipes return 409 Conflict and swipes are final
**Status:** Proposed

**Options:** Silently overwrite, idempotent 200, or 409.

**Decision:** 409 if a swipe already exists for the pair. No undo in v1.

**Why:** The requirement says a swiped profile "must never appear again", so a second swipe means a client bug or tampering, and the server should say so. Overwriting a pass with a like would also let a client probe for matches.

**Possible later:** "Undo last pass" would be a separate, deliberate feature with its own privacy review.

---

## D-008: Seed data: 36 profiles, about 12 of whom have already liked the user
**Status:** Proposed

**Decision:** Indian college and city context (fits Coy's audience). Varied interests. Photos from a placeholder service (see open question Q-2). The seed script is deterministic and idempotent. A `npm run reset` resets the demo.

---

## D-009: Swipe animation library: Framer Motion
**Status:** Proposed

**Options:** Hand-rolled pointer events with CSS transforms, react-spring with use-gesture, or Framer Motion.

**Decision:** Framer Motion (`drag="x"`, `useMotionValue`, `useTransform` for rotation and stamp opacity, `animate` for fly-out).

**Why:** Velocity-aware drag, springs and exit animations come out of the box, and it handles touch and mouse the same way. Hand-rolling these is where swipe UIs usually feel janky.

---

## D-011: The API port comes from `API_PORT` in development and `PORT` in production
**Status:** Accepted (2026-11-18, found during Phase 0)

**Context:** When we first ran it, the dev tooling set `PORT=5173` for the frontend. The server also read `PORT`, so Express tried to bind Vite's port and the page was blank.

**Decision:** In development the server reads `API_PORT` (default 4000). In production (`NODE_ENV=production`) it reads `PORT`, the variable Render and Railway inject.

**Why:** Each process owns its own variable, so they can't collide. We still follow the hosting convention in production.

---

## D-012: Schema lives in a TypeScript module, not a .sql file
**Status:** Proposed (2026-11-18, Phase 1)

**Context:** The plan had `db/schema.sql`, read at startup. `tsc` only emits `.ts` files, so `dist/` would have no `schema.sql` and the production server would crash on boot.

**Options:** Copy the file in a build step, read it from `src/` at runtime, or export the SQL as a string from `schema.ts`.

**Decision:** `server/src/db/schema.ts` exports `SCHEMA`. Every statement uses `IF NOT EXISTS`, so `createDb()` applies it on every start.

**Why:** No extra build step, and dev and prod behave the same. The SQL is still in one readable place.

**Consequences:** No migration system. That's fine for a demo whose data can be reseeded at any time. A real app would need versioned migrations.

---

## D-013: Swipes run in an IMMEDIATE transaction
**Status:** Proposed (2026-11-18, Phase 2)

**Context:** better-sqlite3 is synchronous, so one Node process already runs swipes one at a time. Two processes on the same file (two server instances, or the seed running during a request) could still interleave a normal `BEGIN` transaction.

**Decision:** `swipe()` uses `db.transaction(...).immediate()`, which takes the write lock before reading anything.

**Why:** The primary keys already stop duplicate rows. The lock also means the "already swiped?" and "do they like me?" checks always see a consistent state. It costs nothing at this scale. A test runs two connections against one file.

---

## D-010: Deployment
**Status:** Open (see Q-1)

---

## Open questions (for you to decide)

- **Q-1: Live demo URL?** A deployed link helps a lot with reviewers. The best fit for Express + SQLite is Render or Railway with a persistent disk, as a single service. The alternative is local-only with a good README and a GIF.
- **Q-2: Photos:** *(Phase 1 uses randomuser.me portrait URLs as a placeholder. They're set in one helper in `seed/profiles.ts`, so switching is a one-line change.)* An external placeholder service (e.g. randomuser.me portraits, realistic but external), or generated avatars committed to the repo (always works offline, less realistic).
- **Q-3: Stretch goals** if time allows: Playwright E2E, undo last pass, filters (age or city), unmatch.
