# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Cricket & X01 Darts Scorekeeper — a mobile-first web app for tracking darts games. Supports team play with individual player attribution, real-time multi-device sync via WebSocket, and game history with per-player shot tracking.

## Commands

- `npm run dev` — Start dev server (Express + Vite HMR) on port 3000
- `npm run build` — Build client (Vite) and server (esbuild) to `dist/`
- `npm start` — Run production build (`dist/index.cjs`)
- `npm run check` — TypeScript type checking
- `npm run db:push` — Push Drizzle schema to PostgreSQL
- `npx vitest run` — Run tests
- `npx vitest run client/src/lib/x01-game-logic.test.ts` — Run a single test file

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
- **No router for game flow** — screen state machine (`AppScreen` type in `types.ts`) drives navigation: `home → setup → game → post-game`. Transitions use Framer Motion `AnimatePresence`.
- **Wouter router** used only for shareable game links (`/game/:id`) and the history page.
- **Two game modes** with parallel implementations:
  - Cricket: `game-logic.ts` + `cricket-game-screen.tsx` + `cricket-post-game-screen.tsx`
  - X01: `x01-game-logic.ts` + `x01-game-screen.tsx` + `x01-post-game-screen.tsx`
- **Game type union**: `Game = CricketGame | X01Game` — discriminated on `gameType` field.
- **State management**: `useState` in `App.tsx`, no global store. Game state persists to both localStorage (fast) and PostgreSQL (durable).
- **UI**: shadcn/ui (new-york variant) + Tailwind CSS dark theme + Framer Motion animations.

### Server architecture
- `routes.ts` — REST API under `/api` for games, history, player names, and per-player shots
- `storage.ts` — `IStorage` interface with `DatabaseStorage` (Drizzle ORM + PostgreSQL)
- `ws.ts` — WebSocket server at `/ws` for real-time game sync. Room-based: clients join by `gameId`, updates broadcast to other viewers.
- Dev: Vite runs as Express middleware. Prod: static files served from `dist/public/`.

### Database (PostgreSQL + Drizzle ORM)
Schema in `shared/schema.ts` with four tables:
- `games` — active game state as JSONB
- `game_summaries` — denormalized completed game records for history
- `player_names` — remembered names for autocomplete
- `shots` — individual dart throws for per-player trend analysis

Requires `DATABASE_URL` environment variable.

### Real-time sync
WebSocket messages defined in `shared/ws-types.ts`. The `use-game-sync` hook manages client-side connection. On game update, the originating client saves via REST API and broadcasts via WebSocket; receiving clients update local state + localStorage.

## Design context

- `PRODUCT.md` — brand voice, users, anti-references, strategic principles. Register: **product** (design serves the tool).
- `DESIGN.md` — tokens, color strategy, typography hierarchy, motion vocabulary. Sourced from `client/src/index.css` + `tailwind.config.ts`.
- Both feed the `/impeccable` skill but are useful for any design or UI work — read them before restyling components or post-game/setup/in-game screens.
