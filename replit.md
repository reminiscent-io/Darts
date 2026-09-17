# Overview

Bar Darts is a mobile-first scorekeeper for Cricket and X01 darts, with team play, real-time multi-device sync, game history, and per-player stats. It installs as a PWA. The Express + PostgreSQL server does real work: it syncs live games, stores history, and records every dart the stats are built from.

This file only covers what's specific to Replit. The rest is written down once, elsewhere:

- `CLAUDE.md`: how the code works (architecture, file map, routing, sync, database, PWA, commands)
- `README.md`: features, stack, and setup

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

See `CLAUDE.md`. Don't copy architecture notes into this file, because a second copy goes stale. That's what happened to the earlier version of this file. When the code changes, update `CLAUDE.md`, plus `README.md` for anything users see.

## Replit Specifics

- **Run**: `.replit` runs `npm run dev` with `PORT=5000`, mapped to external port 80. When `PORT` isn't set, the server uses 3000.
- **Deploy**: autoscale. The build step is `npm run build` and the run step is `node ./dist/index.cjs`.
- **Database**: the PostgreSQL 16 module. The app reads `DATABASE_URL`, and schema changes go out with `npm run db:push`.
- **Lockfile**: 20 entries in `package-lock.json` resolve through `http://package-firewall.replit.local/npm/`, which only exists inside Replit. Leave them as they are. Contributors outside Replit repoint them locally so `npm install` works, and they don't commit that change.
- **Vite plugins**: `@replit/vite-plugin-runtime-error-modal` always loads. `@replit/vite-plugin-cartographer` and `@replit/vite-plugin-dev-banner` load only in development on Replit, when `REPL_ID` is set.
