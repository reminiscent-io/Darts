# Player Stats & Leaderboards — Design Spec

**Date:** 2026-06-13
**Status:** Approved (design), pending implementation plan
**Author:** Kevin + Claude

## Summary

A new **Players** area in the darts scorekeeper that answers two questions:

1. **Across all players, who's the best?** — a leaderboard overview with separate ranked lists per skill metric (no single "overall" score).
2. **For one player, how do they do across game types?** — a per-player performance dashboard covering Cricket and X01, plus an accuracy heatmap.

All statistics are computed **client-side** from existing REST APIs (the `shots` and `game_summaries` data already captured per game). No new database tables and no precomputation.

## Goals / Non-goals

**Goals**
- Separate leaderboards (win rate, Cricket MPR, X01 3-dart avg, accuracy/hit %, records & activity).
- Per-player dashboard with per-game-type breakdown, recent-form sparklines, and a dartboard accuracy heatmap.
- Honest handling of small samples (minimum games to qualify for skill leaderboards).
- Mobile-first, matching the app's existing dark theme and motion vocabulary.

**Non-goals (YAGNI)**
- No server-side aggregation endpoints or stats table (may revisit if the roster grows large — see Tradeoffs).
- No head-to-head / rivalry views in this iteration.
- No new auth, no editing of historical data.
- No shareable per-player URLs in v1 (screen-state navigation only; see Open Decisions — resolved).

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Ranking model | **Separate leaderboards** per metric. No composite score. |
| Leaderboard categories | **Core skill metrics** (Cricket MPR, X01 3-dart avg), **Win rate**, **Accuracy / hit %**, **Records & activity**. |
| Small-sample handling | **Minimum games to qualify** (default **3** games of that type). Unqualified players shown separately as "Not enough games yet". |
| Overview layout | **Layout A** — single scrolling page: a "top player" podium hero, then stacked leaderboard cards (top 3 each, expandable to full list). |
| Player dashboard | Hero + 3 KPIs + a card per game type (career stat + recent-form sparkline) + dartboard accuracy heatmap. Heatmap maps real board geometry (numbered wedges, double/triple rings, bull), kept compact. |
| Stats engine | **Client-side** aggregation from existing APIs. Pure, unit-tested functions. |

## Architecture

### Navigation
- Add `'players'` to the `AppScreen` union in `client/src/lib/types.ts`.
- Add a **Players** button on the Home screen (`client/src/pages/home-screen.tsx`), alongside History.
- `App.tsx` holds `selectedPlayer: string | null`. The players screen renders:
  - **Overview** (`selectedPlayer === null`) — leaderboards.
  - **Dashboard** (`selectedPlayer === <name>`) — that player's detail.
  - Back from dashboard clears `selectedPlayer`; back from overview returns to Home.
- Transitions use the existing Framer Motion `AnimatePresence` pattern. No new Wouter routes (Wouter stays reserved for shareable game links / history).

### Data flow (client-side)
**Overview** loads in parallel:
- `GET /api/players` → roster (`string[]`).
- `GET /api/history?limit=<large>` → all `game_summaries` (for win rates). **Server change required:** `/api/history` currently ignores query params and returns the default 50. Update the route to read `?limit=` and pass it through to `storage.getGameSummaries(limit)` (which already accepts a limit). Use a large limit (or treat absent as "all" via a high cap).
- For each player: `GET /api/players/:name/shots?limit=5000` → that player's shots. (Endpoint default is 500, max 5000; pass 5000 to capture full career. A few parallel requests at home-roster scale.)

**Player dashboard** is self-contained:
- `GET /api/players/:name/shots?limit=5000` + `GET /api/history?limit=<large>`.
- A player's own shots cover all their games; each shot's `gameMode` provides the `gameId → gameMode` map needed to split win/loss by game type.

**Caching:** a module-level in-memory cache (keyed by player name for shots, plus the summaries list) so hopping overview ↔ dashboard within a session doesn't refetch. Cache is best-effort and cleared on full reload. (No React Query dependency added; follows the existing `useEffect` + `fetch` pattern in `history-screen.tsx`.)

**Loading / error / empty states** throughout: skeletons while fetching, a friendly retry on error, and empty states (see Edge Cases).

### Computation module
`client/src/lib/player-stats.ts` — **pure functions**, no I/O:
- `computeLeaderboards(shotsByPlayer: Record<string, SelectShot[]>, summaries: SelectGameSummary[], opts?: { minGames?: number }): Leaderboards`
- `computePlayerDashboard(name: string, shots: SelectShot[], summaries: SelectGameSummary[]): PlayerDashboard`
- Plus small internal helpers (per-game grouping, round chunking, heatmap bucketing).

Keeping these pure mirrors the existing `getCricketPlayerStats` / `getX01PlayerStats` design and makes them unit-testable. If a server endpoint is ever added, this logic ports directly.

## Metric definitions

All metrics derive from the `shots` table (per-dart: `gameId`, `dartSeq`, `playerName`, `teamName`, `gameMode`, `target`, `multiplier`, `pointsScored`, `marksApplied`, `isBust`, `thrownAt`) and `game_summaries` (`team1Players`, `team2Players`, `winnerTeamIndex`, `completedAt`).

### Per-game grouping (correctness-critical)
The shots endpoint returns rows sorted by `thrownAt DESC`. Before computing round-based metrics, **sort ascending by `(gameId, dartSeq)` and chunk into rounds of 3 within each game** — never across game boundaries. This matches the existing in-game stat functions, which chunk a single game's `dartHistory` in groups of 3.

- **Rounds for a game** = ⌈(darts in that game) ÷ 3⌉.

### Win rate (from summaries)
- **Participated** in a game if `name ∈ team1Players ∪ team2Players`.
- **Won** if `name ∈ (winnerTeamIndex === 0 ? team1Players : team2Players)`.
- **Overall win rate** = wins ÷ participated. Computable from summaries alone (no shots needed).
- **Per-type win rate** = same, filtered to summaries whose `gameId` maps to that `gameMode` (via the shots-derived map). Summaries with no recorded shots (pre-shot-tracking games) count toward overall but are excluded from per-type.

### Cricket MPR
- **Career MPR** = Σ `marksApplied` (cricket shots) ÷ Σ rounds (over cricket games). Round to 2 decimals (parity with `getCricketPlayerStats`).
- **Best single-game MPR** = max over cricket games of (game marks ÷ game rounds).
- **Total marks** = Σ `marksApplied`.

### X01 3-dart average
- Chunk each X01 game's darts into rounds of 3; a round's total sums `pointsScored` with bust darts counted as 0 (parity with `getX01PlayerStats`).
- **3-dart avg** = mean of all per-game rounds.
- **Points per dart** = total points ÷ total darts.
- **Highest round** = max 3-dart round total across all X01 games.
- **Bust rate** = busts ÷ darts (X01 shots; `isBust`).

### Accuracy / hit %
- **Hit %** = darts with `target !== 'miss'` ÷ total darts. Computed overall and usable per-type.

### Records & activity
- Highest 3-dart round (X01), best single-game MPR (Cricket), total games played, total darts thrown.

### Heatmap
- Bucket non-miss shots by `(target, multiplier)`; counts feed a heat overlay on real dartboard geometry. Also surface **top targets** (e.g., "T20 ×38").

### Qualification
- Skill leaderboards (Cricket MPR, X01 3-dart avg, accuracy) require **≥ `minGames` games of that type** (default **3**, a tunable constant). Unqualified players are listed in a separate "Not enough games yet" area beneath each board. Win rate and activity boards have no minimum.

## Components & files

**New**
- `client/src/lib/player-stats.ts` — pure aggregation functions + exported result types.
- `client/src/lib/player-stats.test.ts` — vitest unit tests (pattern: `x01-game-logic.test.ts`).
- `client/src/pages/players-screen.tsx` — overview (podium hero + stacked leaderboard cards, Layout A).
- `client/src/pages/player-dashboard.tsx` — single-player view (hero, KPIs, per-type cards w/ sparklines, heatmap).
- `client/src/components/dartboard-heatmap.tsx` — reusable SVG board (wedges, double/triple rings, bull) + heat overlay.
- Small presentational components as needed: `leaderboard-card.tsx`, `stat-sparkline.tsx`.

**Modified**
- `client/src/lib/types.ts` — add `'players'` to `AppScreen`.
- `client/src/App.tsx` — `'players'` screen state, `selectedPlayer` state, AnimatePresence wiring, handlers.
- `client/src/pages/home-screen.tsx` — add **Players** entry point.
- `server/routes.ts` — `/api/history` reads `?limit=` and passes it to `getGameSummaries`.

## Testing strategy

- **Unit (vitest)** on `player-stats.ts`: fixtures of `SelectShot[]` + `SelectGameSummary[]` → assert MPR, 3-dart avg, PPD, highest round, bust rate, hit %, win rate (overall + per-type), heatmap buckets, and qualification filtering.
- **Edge/guard tests:** empty inputs, division-by-zero (no darts / no rounds / no games), per-game round chunking across multiple games, summaries with no shots (type unknown), and the min-games boundary (exactly 2 vs 3 games).
- **Manual / Playwright** against seeded or real data before completion: overview renders all boards, podium reflects top win rate, drilling into a player shows correct cards + heatmap, empty states display.

## Edge cases

- **No players / fresh app** — overview shows an inviting empty state ("No games played yet").
- **Player with only one game type** — the absent card reads "No X01 games yet" (or Cricket).
- **Below qualification threshold** — appears under "Not enough games yet" for that skill board; still appears on win-rate/activity boards.
- **Games predating shot-tracking** — counted in overall win rate; excluded from per-type splits and skill metrics (no shot rows).
- **Career > 5000 shots** — shots endpoint caps at 5000; acceptable at home scale. Noted as a known limit.
- **Name matching** — player identity is the exact name string (consistent with how shots/summaries store names).

## Tradeoffs & future work

- **Client-side aggregation (chosen):** minimal backend change, fine at home-roster scale. The cost is the overview fanning out one `shots` fetch per player and recomputing per visit (mitigated by in-memory cache). **If the roster/history grows large,** add a server endpoint (`GET /api/stats/leaderboards`, `GET /api/players/:name/stats`) that runs the same logic in SQL/Drizzle — the pure functions port directly.
- **Heatmap geometry** is presentational; if board rendering proves heavy, fall back to a "top targets" list (functions already produce the buckets).

## Open decisions — resolved
- Shareable per-player URL: **No** for v1 — use screen-state navigation, consistent with the rest of the game flow.
- Minimum games to qualify: **3** (tunable constant).
