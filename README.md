# 🎯 Bar Darts

A mobile-first darts scorekeeper for Cricket and X01. Score from your phone, sync to a shared screen, and keep a permanent record of every throw.

## What It Does

Set up a game in seconds, attribute every dart to the right player even in team play, and let any device in the bar follow along in real time. Finished games save to history with per-player shot trends.

## Features

- **Two game modes**: Cricket and X01
- **Team play with individual attribution**: Each dart is tracked to the player who threw it, not just the team total
- **Real-time multi-device sync** over WebSocket, so a phone, laptop, and bar TV can all show the same live game
- **Shareable game links** for spectators
- **Game history** with completed-game summaries and per-player shot data
- **Mobile-first dark UI** built with shadcn/ui and Framer Motion transitions
- **Local + cloud persistence**: game state survives a refresh via localStorage and lives durably in Postgres

## Tech Stack

**Frontend**
- React 18 + Vite
- Wouter for shareable game URLs and the history page
- Framer Motion for screen transitions
- Tailwind CSS dark theme + shadcn/ui (new-york variant)

**Backend**
- Express 5 (run via `tsx` in dev)
- WebSocket server at `/ws` for room-based real-time sync
- Drizzle ORM + PostgreSQL

**Shared**
- Drizzle schema and WebSocket message types live in `shared/` and are imported by both client and server, so the wire format stays in sync.

## Project Structure

```
client/    React SPA (entry: client/src/main.tsx)
server/    Express API + WebSocket server (entry: server/index.ts)
shared/    Drizzle schema (schema.ts) + WebSocket message types (ws-types.ts)
```

Path aliases:

| Alias | Resolves to |
|---|---|
| `@/` | `client/src/` |
| `@shared/` | `shared/` |
| `@assets/` | `attached_assets/` |

## Architecture Notes

### Screen state machine, not a router
Game flow (`home → setup → game → post-game`) is driven by a discriminated `AppScreen` union in `types.ts`, with Framer Motion's `AnimatePresence` handling transitions. Wouter is reserved for shareable game URLs (`/game/:id`) and the history page.

### Parallel implementations per game mode
Cricket and X01 each get their own game logic, game screen, and post-game screen:

- Cricket: `game-logic.ts`, `cricket-game-screen.tsx`, `cricket-post-game-screen.tsx`
- X01: `x01-game-logic.ts`, `x01-game-screen.tsx`, `x01-post-game-screen.tsx`

The `Game` type is a discriminated union of `CricketGame | X01Game` keyed on `gameType`.

### State management
Local `useState` in `App.tsx`, no global store. State is mirrored to localStorage for instant recovery and persisted to Postgres for durability.

### Real-time sync
WebSocket messages are typed in `shared/ws-types.ts`. The `use-game-sync` hook manages the client connection. On any game update, the originating client saves via REST and broadcasts via WebSocket; receiving clients update local state and localStorage.

### Database

| Table | Purpose |
|---|---|
| `games` | Active game state as JSONB |
| `game_summaries` | Denormalized completed games for the history view |
| `player_names` | Remembered names for autocomplete |
| `shots` | Individual dart throws for per-player trend analysis |

## Getting Started

### Prerequisites
- Node 20+
- PostgreSQL database
- `DATABASE_URL` environment variable

### Install

```bash
npm install
```

### Push the schema

```bash
npm run db:push
```

### Run in dev

```bash
npm run dev
```

Express serves on port 3000 with Vite running as middleware for HMR.

### Build and run in production

```bash
npm run build
npm start
```

The build outputs to `dist/`. Production serves static files from `dist/public/` and runs the bundled server at `dist/index.cjs`.

## Commands

```bash
npm run dev      # Express + Vite HMR on port 3000
npm run build    # Build client (Vite) and server (esbuild) to dist/
npm start        # Run production build
npm run check    # TypeScript typecheck
npm run db:push  # Push Drizzle schema to PostgreSQL
npx vitest run   # Run all tests
npx vitest run client/src/lib/x01-game-logic.test.ts   # Single test file
```

---

Built by [Kevin Lowe](https://www.linkedin.com/in/kevin-lowe-5ab08164/) at [Reminiscent](https://reminiscent.io).
