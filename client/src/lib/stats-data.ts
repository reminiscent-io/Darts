// Fetching and caching for the player stats screens. All aggregation lives in
// `player-stats.ts`; this module only gets the raw rows and remembers them for
// the session so hopping between boards, a player and a comparison doesn't
// refetch the same career every time.

import { GameSummary } from './types';
import { loadGameHistoryForStats, loadPlayerNames, loadPlayerNamesFromDb } from './game-logic';
import {
  computePlayerDashboard,
  type PlayerDashboard,
  type ShotRow,
} from './player-stats';

/** The `/api/players/:name/shots` ceiling. A career beyond this is truncated. */
const SHOTS_LIMIT = 5000;

const shotsCache = new Map<string, ShotRow[]>();
let summariesCache: GameSummary[] | null = null;
let rosterCache: string[] | null = null;
const dashboardCache = new Map<string, PlayerDashboard>();

/** Drops everything so the next load hits the network again. */
export function clearStatsCache(): void {
  shotsCache.clear();
  dashboardCache.clear();
  summariesCache = null;
  rosterCache = null;
}

async function fetchRoster(): Promise<string[]> {
  if (rosterCache) return rosterCache;
  const names = await loadPlayerNamesFromDb();
  rosterCache = names.length > 0 ? names : loadPlayerNames();
  return rosterCache;
}

async function fetchSummaries(): Promise<GameSummary[]> {
  if (summariesCache) return summariesCache;
  summariesCache = await loadGameHistoryForStats();
  return summariesCache;
}

async function fetchShots(player: string): Promise<ShotRow[]> {
  const cached = shotsCache.get(player);
  if (cached) return cached;
  try {
    const res = await fetch(`/api/players/${encodeURIComponent(player)}/shots?limit=${SHOTS_LIMIT}`);
    if (!res.ok) return [];
    const rows = (await res.json()) as ShotRow[];
    shotsCache.set(player, rows);
    return rows;
  } catch {
    return [];
  }
}

export interface StatsBundle {
  roster: string[];
  summaries: GameSummary[];
  dashboards: PlayerDashboard[];
}

/**
 * Every known player's career. The roster comes from remembered names, plus
 * anyone who only shows up in game history (e.g. a guest nobody saved).
 */
export async function loadAllPlayerStats(): Promise<StatsBundle> {
  const [roster, summaries] = await Promise.all([fetchRoster(), fetchSummaries()]);

  const names = new Set(roster);
  for (const summary of summaries) {
    for (const team of summary.teams ?? []) {
      for (const player of team.players ?? []) names.add(player);
    }
  }
  const allNames = Array.from(names)
    .filter(n => n.trim().length > 0)
    .sort((a, b) => a.localeCompare(b));

  const dashboards = await Promise.all(allNames.map(name => loadPlayerDashboard(name, summaries)));
  return { roster: allNames, summaries, dashboards };
}

/** One player's career. Pass `summaries` to reuse an already-loaded history. */
export async function loadPlayerDashboard(
  name: string,
  summaries?: GameSummary[],
): Promise<PlayerDashboard> {
  const cached = dashboardCache.get(name);
  if (cached) return cached;
  const [shots, history] = await Promise.all([
    fetchShots(name),
    summaries ? Promise.resolve(summaries) : fetchSummaries(),
  ]);
  const dashboard = computePlayerDashboard(name, shots, history);
  dashboardCache.set(name, dashboard);
  return dashboard;
}
