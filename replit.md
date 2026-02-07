# Overview

Cricket Darts Scorekeeper — a mobile-first web app for tracking Cricket darts games in casual/bar settings. The app handles team-level scoring with individual player attribution. It's designed to feel like a premium native app with a dark theme, touch-optimized controls, and smooth animations. Game state primarily lives client-side using localStorage for persistence, though the project includes a full server setup with PostgreSQL/Drizzle ORM scaffolding.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React + TypeScript with Vite as the build tool
- **Styling**: Tailwind CSS with a custom dark theme using CSS variables (HSL color system). The `new-york` style variant of shadcn/ui components is used extensively
- **Animations**: Framer Motion for screen transitions and UI feedback (200-300ms max transitions)
- **UI Components**: Full shadcn/ui component library installed under `client/src/components/ui/`
- **Fonts**: Inter (sans-serif) for labels, JetBrains Mono (monospace) for scores/numbers — loaded via Google Fonts
- **State Management**: Local React state with `useState`/`useCallback` in the root `App.tsx`. No global state library (no Redux/Zustand). Game state persists to `localStorage`
- **Routing**: No router — the app uses a simple screen state machine (`AppScreen` type: `'home' | 'setup' | 'game' | 'post-game'`) with `AnimatePresence` for transitions
- **Path aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`, `@assets/` maps to `attached_assets/`

### App Screen Flow
1. **Home Screen** (`home-screen.tsx`) — New Game / Resume Game buttons
2. **Setup Screen** (`setup-screen.tsx`) — Team names, player names, who goes first
3. **Game Screen** (`game-screen.tsx`) — Main scoreboard, dart entry with multiplier selection, undo support
4. **Post-Game Screen** (`post-game-screen.tsx`) — Winner display, player stats, rematch/new game options

### Game Logic
- All game logic lives in `client/src/lib/game-logic.ts`
- Types defined in `client/src/lib/types.ts` — Cricket numbers (20, 19, 18, 17, 16, 15, Bull), teams, players, dart entries, game state
- Games are saved to/loaded from `localStorage`
- Turn order supports unequal team sizes (e.g., 2v1)
- No backend database needed for game functionality

### Backend Architecture
- **Runtime**: Node.js with Express 5 (via `tsx` for TypeScript execution)
- **Server entry**: `server/index.ts` creates an HTTP server, registers routes, and serves static files or Vite dev middleware
- **Routes**: `server/routes.ts` — currently empty placeholder, all routes should be prefixed with `/api`
- **Storage**: `server/storage.ts` — implements `IStorage` interface with `MemStorage` (in-memory Map). Has basic user CRUD as scaffolding
- **Dev mode**: Vite dev server runs as middleware (`server/vite.ts`) with HMR
- **Production**: Client is built to `dist/public/`, server is bundled with esbuild to `dist/index.cjs`

### Database
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: `shared/schema.ts` — currently only has a `users` table (id, username, password). Uses `drizzle-zod` for validation schemas
- **Migrations**: Output to `./migrations/` directory
- **Push command**: `npm run db:push` uses `drizzle-kit push`
- **Note**: The database is scaffolded but not actively used by the game — game state lives in localStorage. The database exists for potential future features (user accounts, game history, etc.)

### Build System
- **Dev**: `npm run dev` — runs `tsx server/index.ts` with Vite middleware
- **Build**: `npm run build` — runs `script/build.ts` which does Vite build (client) then esbuild (server)
- **Production**: `npm start` — runs `node dist/index.cjs`
- **Type check**: `npm run check` — runs `tsc`

### PWA Support
- Configured with meta tags for iOS home screen (apple-mobile-web-app-capable, theme-color)
- Viewport locked to prevent zoom (`maximum-scale=1, user-scalable=no`)

## External Dependencies

### Database
- **PostgreSQL** via `DATABASE_URL` environment variable
- **Drizzle ORM** for schema definition and queries
- **connect-pg-simple** for session storage (scaffolded)

### Frontend Libraries
- **@tanstack/react-query** — set up in `queryClient.ts` but not heavily used (game is client-side)
- **Framer Motion** — animations and screen transitions
- **Radix UI** — full suite of accessible primitives via shadcn/ui
- **Lucide React** — icon library
- **embla-carousel-react** — carousel component
- **date-fns** — date formatting
- **react-day-picker** — calendar component
- **recharts** — charting (available but may not be actively used)
- **vaul** — drawer component
- **cmdk** — command palette component
- **react-hook-form** + **zod** — form handling and validation

### Replit-specific
- `@replit/vite-plugin-runtime-error-modal` — error overlay in dev
- `@replit/vite-plugin-cartographer` — dev tooling (conditionally loaded)
- `@replit/vite-plugin-dev-banner` — dev banner (conditionally loaded)