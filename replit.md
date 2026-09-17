# Overview

Cricket & X01 Darts Scorekeeper — a mobile-first web app for tracking darts games in casual/bar settings. It handles both Cricket and X01, with team-level scoring and individual player attribution. It's designed to feel like a premium native app with a dark theme, touch-optimized controls, and smooth animations, and it installs as a PWA.

Game state lives in two places: localStorage as a fast cache, and PostgreSQL as the durable copy. The server is not scaffolding — it carries real-time sync between devices, game history, and the per-dart `shots` table that all the career statistics are built from.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React + TypeScript with Vite as the build tool
- **Styling**: Tailwind CSS with a custom dark theme using CSS variables (HSL color system). The `new-york` style variant of shadcn/ui components is used extensively
- **Animations**: Framer Motion for screen transitions and UI feedback (200-300ms max transitions)
- **UI Components**: Full shadcn/ui component library installed under `client/src/components/ui/`
- **Fonts**: Inter (sans-serif) for labels, JetBrains Mono (monospace) for scores/numbers — loaded via Google Fonts
- **State Management**: Local React state with `useState`/`useCallback` in the root `App.tsx`. No global state library (no Redux/Zustand). Game state persists to `localStorage` and to PostgreSQL
- **Routing**: Mostly a screen state machine (`AppScreen` type: `'home' | 'setup' | 'game' | 'post-game' | 'history' | 'players'`) with `AnimatePresence` for transitions. Wouter handles three real routes: `/game/:gameId` for shareable spectator links, plus `/players/:name?` and `/`. History is screen state and has no URL
- **Code splitting**: every screen past the home screen is loaded with `lazy()`, which keeps recharts out of the initial bundle
- **Access gate**: `pages/access-screen.tsx` puts a hardcoded code in front of the whole app, checked against a localStorage flag. Client-side only, so it is a soft gate rather than security
- **Path aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`, `@assets/` maps to `attached_assets/`

### App Screen Flow
1. **Home Screen** (`home-screen.tsx`) — New Game / Resume Game, plus entry to history and players
2. **Setup Screen** (`setup-screen.tsx`) — Game type, team and player names, who goes first
3. **Game Screen** — one per mode: `cricket-game-screen.tsx` and `x01-game-screen.tsx`. Scoreboard, dart entry with multiplier selection, undo
4. **Post-Game Screen** — one per mode: `cricket-post-game-screen.tsx` and `x01-post-game-screen.tsx`. Winner, player stats, rematch
5. **History Screen** (`history-screen.tsx`) — completed games
6. **Players area** (`players-screen.tsx`, `player-dashboard.tsx`, `compare-players.tsx`) — leaderboards, one player's trends, head-to-head

### Game Logic
- Cricket logic lives in `client/src/lib/game-logic.ts`; X01 logic in `x01-game-logic.ts`, with checkout suggestions in `checkout.ts`
- `game-logic.ts` also owns the persistence helpers both modes share (`loadGame`, `saveGame`, `saveGameToHistory`, `leaveGameLocally`, `endGameForEveryone`, `migrateStorage`)
- Career statistics live in `player-stats.ts` (pure aggregation) with fetching and caching in `stats-data.ts`
- Types defined in `client/src/lib/types.ts` — Cricket numbers (20, 19, 18, 17, 16, 15, Bull), X01 game shape, teams, players, dart entries. `Game` is a `CricketGame | X01Game` union discriminated on `gameType`
- Games are saved to both localStorage (fast cache) and PostgreSQL database (durable persistence)
- On load, the app checks localStorage first, then falls back to the database
- Turn order supports unequal team sizes (e.g., 2v1)

### Backend Architecture
- **Runtime**: Node.js with Express 5 (via `tsx` for TypeScript execution)
- **Server entry**: `server/index.ts` creates an HTTP server, registers routes, and serves static files or Vite dev middleware
- **Database connection**: `server/db.ts` — creates a PostgreSQL pool and Drizzle ORM instance
- **Routes**: `server/routes.ts` — API routes for games, history, player names, and per-player shots, all prefixed with `/api`
- **WebSocket**: `server/ws.ts` — room-based real-time sync at `/ws`, with a heartbeat that sweeps stale sockets
- **Storage**: `server/storage.ts` — implements `IStorage` interface with `DatabaseStorage` using Drizzle ORM for PostgreSQL CRUD operations
- **Dev mode**: Vite dev server runs as middleware (`server/vite.ts`) with HMR
- **Production**: Client is built to `dist/public/`, server is bundled with esbuild to `dist/index.cjs`

### Database
- **ORM**: Drizzle ORM with PostgreSQL dialect via `pg` driver (node-postgres)
- **Schema**: `shared/schema.ts` defines four tables:
  - `games` — stores active/completed game state as JSONB (id, status, game_state, created_at, updated_at)
  - `game_summaries` — denormalized completed game summaries for the history view. `teams` (JSONB) is the canonical shape; the nullable `team1*`/`team2*` columns predate X01 and multi-team games and are kept so older rows still read back
  - `player_names` — remembered player names for autocomplete suggestions (unique name constraint)
  - `shots` — one row per dart thrown, unique on `(game_id, dart_seq)` and indexed on `(player_name, thrown_at)`. Everything on the player stats screens derives from this table
- **Migrations**: Output to `./migrations/` directory
- **Push command**: `npm run db:push` uses `drizzle-kit push`

### API Endpoints
- `GET /api/games/active` — returns the most recent in-progress game state, or null
- `POST /api/games` — upserts a game (body: `{ id, status, gameState }`) and derives `shots` rows as a side effect; failures there are logged and swallowed
- `GET /api/games/:id` — returns one game's state, used by shareable links
- `DELETE /api/games/:id` — deletes a game record and, for a live game, tells every device in its room to drop it
- `GET /api/history` — returns completed game summaries, ordered by most recent
- `POST /api/history` — saves a completed game summary
- `DELETE /api/history` — clears all game history
- `GET /api/players` — returns sorted list of remembered player names
- `POST /api/players` — adds player names (body: `{ names: string[] }`, deduplicates automatically)
- `GET /api/players/:name/shots` — that player's dart rows, for the stats screens

None of these routes authenticate. Any client holding a `gameId` can read or overwrite that game.

### Build System
- **Dev**: `npm run dev` — runs `tsx server/index.ts` with Vite middleware
- **Build**: `npm run build` — runs `script/build.ts` which does Vite build (client) then esbuild (server)
- **Production**: `npm start` — runs `node dist/index.cjs`
- **Type check**: `npm run check` — runs `tsc`

### PWA Support
- Hand-rolled, not generated by a Vite plugin
- `client/public/manifest.webmanifest` — standalone display, portrait orientation
- `client/public/sw.js` — registered from `main.tsx`. Fonts cache-first, navigations network-first with an `/offline.html` fallback, static assets stale-while-revalidate. `/api` and `/ws` are never intercepted
- `client/public/offline.html` — the navigation fallback page
- Meta tags for the iOS home screen (apple-mobile-web-app-capable, theme-color)
- Viewport locked to prevent zoom (`maximum-scale=1, user-scalable=no`)

## External Dependencies

### Database
- **PostgreSQL** via `DATABASE_URL` environment variable
- **Drizzle ORM** for schema definition and queries
- **connect-pg-simple**, **express-session**, **passport**, **passport-local**, **memorystore** — all present in `package.json` but referenced nowhere in the source. There is no session layer; treat them as vestigial

### Frontend Libraries
- **@tanstack/react-query** — set up in `queryClient.ts` but not heavily used (game is client-side)
- **Framer Motion** — animations and screen transitions
- **Radix UI** — full suite of accessible primitives via shadcn/ui
- **Lucide React** — icon library
- **embla-carousel-react** — carousel component
- **date-fns** — date formatting
- **react-day-picker** — calendar component
- **recharts** — charting, used by the in-game trend charts. The stats screens deliberately avoid it: `trend-chart.tsx` hand-rolls SVG to keep the library out of their code-split chunk
- **vaul** — drawer component
- **cmdk** — command palette component
- **react-hook-form** + **zod** — form handling and validation

### Replit-specific
- `@replit/vite-plugin-runtime-error-modal` — error overlay in dev
- `@replit/vite-plugin-cartographer` — dev tooling (conditionally loaded)
- `@replit/vite-plugin-dev-banner` — dev banner (conditionally loaded)