# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Cricket & X01 Darts Scorekeeper — a mobile-first, installable PWA for tracking darts games. Supports team play with individual player attribution, real-time multi-device sync via WebSocket, game history, and per-player career stats aggregated from individual dart throws.

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
- `npm run check` — TypeScript type checking
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

**Components**: `components/ui/` is the stock shadcn set (47 files, largely untouched). `components/` proper holds the 10 app-specific ones: `dartboard-heatmap`, `trend-chart`, `long-press-score-button` (pairs with the `use-long-press` hook), `game-settings-sheet`, `current-player-bar`, `share-button`, and friends. `trend-chart.tsx` hand-rolls its SVG instead of using recharts on purpose, to keep the chart library out of the code-split stats chunk.

### PWA

The app installs as a PWA, and every piece of it is hand-rolled rather than generated by a Vite plugin:

- `client/index.html` — manifest link, `theme-color`, `apple-mobile-web-app-*` meta tags
- `client/public/manifest.webmanifest` — `standalone`, portrait. All three icon entries point at the same `favicon.png`, which is really 512x512, so the two 192x192 entries are mislabeled.
- `client/public/sw.js` — registered from `main.tsx` on window load, with registration failures swallowed
- `client/public/offline.html` — the navigation fallback

Service worker routing, which is the thing to reason about when a change refuses to show up in a browser:
- Google Fonts: cache-first
- Navigations: network-first, then cache, then `/offline.html`
- `/assets/` and `.js` / `.css` / `.png` / `.svg` / `.woff2`: stale-while-revalidate, so the first load after a deploy can still serve the previous asset
- Everything else, and every non-GET: not intercepted, so `/api` and `/ws` never touch the cache

`sw.js` calls `skipWaiting()` on install and `clients.claim()` on activate, so a new worker takes over immediately and there is no update prompt. Its `SKIP_WAITING` message listener is dead code; nothing in the client posts that message. `CACHE_VERSION` is a hardcoded string that the build never bumps, so changing a precached shell file means bumping it by hand.

### Server architecture
- `index.ts` — Express setup, `/api` request logging, error handler, then Vite middleware (dev) or static serving (prod)
- `routes.ts` — REST API under `/api`: games (`GET /active`, `POST`, `GET /:id`, `DELETE /:id`), history (`GET`/`POST`/`DELETE`), players (`GET`/`POST`, plus `GET /:name/shots`)
- `storage.ts` — `IStorage` interface with `DatabaseStorage` (Drizzle ORM + PostgreSQL). Also owns `persistShotsFromGameState`, which derives `shots` rows from a posted game state.
- `db.ts` — pg `Pool` + Drizzle instance
- `ws.ts` — WebSocket server at `/ws`. Room-based: clients join by `gameId`, updates broadcast to other viewers, with a heartbeat sweeping stale sockets.
- `vite.ts` / `static.ts` — dev middleware and prod static serving from `dist/public/`

`POST /api/games` writes shot rows as a side effect and swallows failures from it, so a broken `persistShotsFromGameState` degrades stats silently without breaking gameplay.

There is no authentication or authorization on the server. Every `/api` route and the WebSocket are open, and any client holding a `gameId` can read or overwrite that game. `express-session`, `connect-pg-simple`, `passport`, `passport-local`, and `memorystore` sit in `package.json` but are referenced nowhere in the source: vestigial scaffolding, not a session layer. (`claude@0.1.1` is likewise an unused dependency.) The gate in `access-screen.tsx` is client-side and protects nothing server-side.

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
- Both documents are current and worth reading before restyling components or the post-game/setup/in-game screens. They were written for an `/impeccable` skill that is not in this repo, and `DESIGN.md` closes by telling you to run `$impeccable document`; treat both as dangling references.

## Other docs

- `README.md` — the public-facing overview: features, stack, setup, and a short architecture summary. When you change routing or add a user-visible feature, update it in the same change.
- `replit.md` — Replit Agent's project notes. Agent reads it on every request and regenerates it if the file is deleted, so it stays, but only as a short stub: the owner's communication preference plus Replit-only details (port 5000, deploy config, the firewall URLs in the lockfile, the Replit Vite plugins). For architecture it points back here. Keep architecture out of it so it can't drift again.
- `docs/superpowers/` — plans and design specs for past features.
- `.claude/skills/` — two skills travel with the repo: `pwa`, which covers the service worker and manifest ground above in more depth, and `code-doubter`. No `impeccable` skill is present.
