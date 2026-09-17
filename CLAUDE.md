# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Cricket & X01 Darts Scorekeeper — a mobile-first web app for tracking darts games. Supports team play with individual player attribution, real-time multi-device sync via WebSocket, game history, and per-player career stats aggregated from individual dart throws.

## Setup

Node 20+ and a `DATABASE_URL` pointing at PostgreSQL.

`npm install` fails outside Replit. 20 entries in `package-lock.json` resolve to `http://package-firewall.replit.local/npm/...`, a host that only exists inside Replit's network; anywhere else npm exits with `E405 Method Not Allowed`. Repoint those entries at the public registry first:

```bash
sed -i 's|http://package-firewall.replit.local/npm/|https://registry.npmjs.org/|g' package-lock.json
npm install
```

Leave that rewrite out of your commit unless changing how Replit installs is the point of the change.

## Commands

- `npm run dev` — Start dev server (Express + Vite HMR). Port 3000, or `$PORT` if set (`.replit` sets 5000).
- `npm run build` — Runs `script/build.ts`: Vite builds the client to `dist/public/`, esbuild bundles the server to `dist/index.cjs`
- `npm start` — Run production build (`dist/index.cjs`)
- `npm run check` — TypeScript type checking. Fails on a clean checkout with 2 pre-existing errors in `server/ws.ts` (TS2802, `Set` iteration) because `tsconfig.json` sets no `target` and so defaults to ES5. Those 2 are the baseline; anything beyond them is yours.
- `npm run db:push` — Push Drizzle schema to PostgreSQL
- `npx vitest run` — Run tests (5 files, 120 tests, all under `client/src/lib/`)
- `npx vitest run client/src/lib/x01-game-logic.test.ts` — Run a single test file

Vitest inherits `root: client` from `vite.config.ts`, so it only discovers tests under `client/`. A test written in `server/` or `shared/` silently never runs.

There is no linter and no formatter in this project.

## Architecture

### Three-layer structure
- **`client/`** — React 18 SPA, built with Vite. Entry: `client/src/main.tsx`
- **`server/`** — Express 5 API + WebSocket server, run via `tsx`. Entry: `server/index.ts`
- **`shared/`** — Drizzle schema (`schema.ts`) and WebSocket message types (`ws-types.ts`), imported by both sides

### Path aliases
- `@/` → `client/src/`
- `@shared/` → `shared/`
- `@assets/` → `attached_assets/`

### Client architecture

**Screen state, not routes, for the game flow.** The `AppScreen` union in `lib/types.ts` is `home | setup | game | post-game | history | players`, driven by `useState` in `App.tsx` with Framer Motion `AnimatePresence` for transitions. History is screen state and has no URL.

**Wouter handles three routes only** (`App.tsx` bottom): `/game/:gameId` renders `SharedGameView` for shareable spectator links, `/players/:name?` and `/` both render `MainApp`. The whole players area is one route so drilling from the board list into a player and back keeps `MainApp` and its loaded stats mounted instead of refetching.

**Everything past the home screen is code-split** via `lazy()` in `App.tsx`, which keeps recharts out of the initial bundle. Converting one of those to a static import silently regresses first-load size.

**Access gate.** `pages/access-screen.tsx` gates the entire app behind a hardcoded code checked against a localStorage flag. It is client-side only and the code ships in the bundle, so it is a soft gate, not security. You will hit it first when running the app; the code is in that file.

**Two game modes** with parallel implementations:
- Cricket: `game-logic.ts` + `cricket-game-screen.tsx` + `cricket-post-game-screen.tsx`
- X01: `x01-game-logic.ts` + `checkout.ts` (checkout suggestions) + `x01-game-screen.tsx` + `x01-post-game-screen.tsx`

`game-logic.ts` also owns the shared persistence helpers both modes use (`loadGame`, `saveGame`, `saveGameToHistory`, `leaveGameLocally`, `endGameForEveryone`, `migrateStorage`).

**Game type union**: `Game = CricketGame | X01Game`, discriminated on `gameType`.

**Player stats** are a separate layer from game logic:
- `lib/player-stats.ts` — pure aggregation over dart rows and game summaries. No fetching, no dates of its own, no React. Round-based metrics (MPR, 3-dart average) chunk darts in threes within a single game, never across game boundaries.
- `lib/stats-data.ts` — the I/O side, with a session-lifetime cache so moving between boards, a player, and a comparison doesn't refetch a career.
- Screens: `players-screen.tsx` (leaderboards), `player-dashboard.tsx` (one player), `compare-players.tsx`.

**Leaving vs. ending a game** are different operations and both exist on the game screens. `leaveGameLocally(id)` steps this device out while the game lives on for everyone else; `endGameForEveryone(id)` deletes the row server-side and broadcasts `game-ended` so every device in the room drops it.

**State management**: `useState` in `App.tsx`, no global store. Game state persists to both localStorage (fast) and PostgreSQL (durable); on resume the client reads localStorage first and falls back to `/api/games/active`.

**UI**: shadcn/ui (new-york variant) + Tailwind CSS dark theme + Framer Motion animations. Dark mode is forced by adding `dark` to `documentElement` on mount.

### Server architecture
- `index.ts` — Express setup, `/api` request logging, error handler, then Vite middleware (dev) or static serving (prod)
- `routes.ts` — REST API under `/api`: games (`GET /active`, `POST`, `GET /:id`, `DELETE /:id`), history (`GET`/`POST`/`DELETE`), players (`GET`/`POST`, plus `GET /:name/shots`)
- `storage.ts` — `IStorage` interface with `DatabaseStorage` (Drizzle ORM + PostgreSQL). Also owns `persistShotsFromGameState`, which derives `shots` rows from a posted game state.
- `db.ts` — pg `Pool` + Drizzle instance
- `ws.ts` — WebSocket server at `/ws`. Room-based: clients join by `gameId`, updates broadcast to other viewers, with a heartbeat sweeping stale sockets.
- `vite.ts` / `static.ts` — dev middleware and prod static serving from `dist/public/`

`POST /api/games` writes shot rows as a side effect and swallows failures from it, so a broken `persistShotsFromGameState` degrades stats silently without breaking gameplay.

### Database (PostgreSQL + Drizzle ORM)
Schema in `shared/schema.ts`, four tables:
- `games` — active game state as JSONB
- `game_summaries` — denormalized completed game records for history
- `player_names` — remembered names for autocomplete
- `shots` — individual dart throws, unique on `(gameId, dartSeq)`, indexed on `(playerName, thrownAt)`

`game_summaries` carries both shapes: `teams` (JSONB) is canonical, while the nullable `team1*`/`team2*` columns predate X01 and multi-team games and are kept so rows written by older builds still read back. Write `teams`; tolerate the legacy columns when reading.

`migrations/` holds generated Drizzle SQL, but the documented workflow is `npm run db:push` rather than running migrations.

### Real-time sync
Message protocol in `shared/ws-types.ts`. Client sends `join` and `game-update`; server sends `game-state`, `player-count`, `game-ended`, `error`. Game state crosses the boundary as `Record<string, unknown>` and the client casts it, so the wire format is not type-checked end to end.

The `use-game-sync` hook manages the client connection. On update, the originating client saves via REST and broadcasts via WebSocket; receiving clients update local state + localStorage. `SharedGameView` retries the initial HTTP load 5 times over ~5s, because the host's save is fire-and-forget and a freshly shared link can 404 for a moment.

## Design context

- `PRODUCT.md` — brand voice, users, anti-references, strategic principles. Register: **product** (design serves the tool).
- `DESIGN.md` — tokens, color strategy, typography hierarchy, motion vocabulary. Sourced from `client/src/index.css` + `tailwind.config.ts`.
- Both feed the `/impeccable` skill but are useful for any design or UI work — read them before restyling components or post-game/setup/in-game screens.

## Other docs

- `README.md` — public-facing. Accurate on stack and setup; its routing section repeats the outdated claim that Wouter serves the history page.
- `replit.md` — stale. Predates X01, the players area, and the current routing; it references `game-screen.tsx` and `post-game-screen.tsx`, which no longer exist. Don't trust it as a description of the code.
- `docs/superpowers/` — plans and design specs for past features.
