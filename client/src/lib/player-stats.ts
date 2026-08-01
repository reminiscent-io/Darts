// Career statistics for players, aggregated from the per-dart `shots` rows and
// the completed-game summaries. Everything here is pure: no fetching, no dates
// of its own, no React. `stats-data.ts` does the I/O and hands the raw rows in.
//
// Round-based metrics (MPR, 3-dart average) chunk a player's darts in groups of
// three *within a single game* — never across game boundaries — which is what
// `getCricketPlayerStats` / `getX01PlayerStats` do for a live game.

import { GameSummary } from './types';

export type StatsGameType = 'cricket' | 'x01';

export const STATS_GAME_TYPES: StatsGameType[] = ['cricket', 'x01'];

/** Games of a type a player needs before they rank on that skill board. */
export const MIN_GAMES_TO_QUALIFY = 3;

/** How many recent games count as "current form". */
export const RECENT_FORM_WINDOW = 5;

/** A `shots` row as it arrives over JSON (`thrownAt` is an ISO string). */
export interface ShotRow {
  gameId: string;
  dartSeq: number;
  playerName: string;
  teamName: string;
  gameMode: string;
  target: string;
  multiplier: number;
  pointsScored: number;
  marksApplied: number | null;
  isBust: boolean | null;
  thrownAt: string;
}

export interface PlayerGameStats {
  gameId: string;
  gameType: StatsGameType;
  playedAt: string;
  darts: number;
  rounds: number;
  hits: number;
  hitPct: number;
  /** Cricket */
  marks: number;
  mpr: number;
  /** X01 */
  points: number;
  ppd: number;
  threeDartAvg: number;
  highestRound: number;
  busts: number;
  /** null when no summary recorded the game (e.g. it was never finished). */
  result: 'win' | 'loss' | null;
}

export interface GameTypeStats {
  gameType: StatsGameType;
  games: number;
  darts: number;
  rounds: number;
  wins: number;
  losses: number;
  winPct: number | null;
  hitPct: number;
  /** MPR for cricket, 3-dart average for X01. */
  headline: number;
  /** Best single game by the headline metric. */
  best: number;
  totalMarks: number;
  totalPoints: number;
  ppd: number;
  highestRound: number;
  bustRate: number;
  /** Headline metric per game, oldest first. */
  trend: number[];
  trendDates: string[];
  /** Mean headline over the last RECENT_FORM_WINDOW games, and everything before. */
  recentAvg: number | null;
  priorAvg: number | null;
  /** recentAvg - priorAvg; null until there are games on both sides. */
  delta: number | null;
}

export interface HeatCell {
  target: string;
  multiplier: number;
  count: number;
}

export interface TopTarget {
  label: string;
  target: string;
  multiplier: number;
  count: number;
}

export interface PlayerDashboard {
  name: string;
  games: number;
  darts: number;
  wins: number;
  losses: number;
  winPct: number | null;
  hitPct: number;
  cricket: GameTypeStats | null;
  x01: GameTypeStats | null;
  perGame: PlayerGameStats[];
  heatmap: HeatCell[];
  topTargets: TopTarget[];
  lastPlayed: string | null;
}

export interface LeaderboardRow {
  player: string;
  value: number;
  display: string;
  games: number;
  /** Extra context for the row, e.g. "12-4" for a win record. */
  detail?: string;
}

export interface Leaderboard {
  key: string;
  title: string;
  caption: string;
  gameType: StatsGameType | 'all';
  rows: LeaderboardRow[];
  /** Players short of MIN_GAMES_TO_QUALIFY for this board. */
  unqualified: LeaderboardRow[];
}

export interface Leaderboards {
  boards: Leaderboard[];
  totals: { players: number; games: number; darts: number };
}

// --- helpers ---

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function formatPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function asGameType(mode: string): StatsGameType {
  return mode === 'x01' ? 'x01' : 'cricket';
}

/**
 * Moving average over `window` samples, used to smooth noisy per-game trend
 * lines. Leading points average over however many samples exist so far.
 */
export function movingAverage(values: number[], window: number): number[] {
  return values.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    return mean(values.slice(start, i + 1));
  });
}

/** Splits a single game's darts (in throw order) into rounds of three. */
export function chunkIntoRounds<T>(darts: T[], size = 3): T[][] {
  const rounds: T[][] = [];
  for (let i = 0; i < darts.length; i += size) {
    rounds.push(darts.slice(i, i + size));
  }
  return rounds;
}

/** gameId → game type, derived from whatever shots were recorded. */
export function buildGameTypeMap(shotsByPlayer: Record<string, ShotRow[]>): Map<string, StatsGameType> {
  const map = new Map<string, StatsGameType>();
  for (const shots of Object.values(shotsByPlayer)) {
    for (const s of shots) {
      if (!map.has(s.gameId)) map.set(s.gameId, asGameType(s.gameMode));
    }
  }
  return map;
}

function summaryResultFor(summary: GameSummary, name: string): 'win' | 'loss' | null {
  const team = summary.teams?.find(t => t.players?.includes(name));
  if (!team) return null;
  // Solo games have nobody to beat; they'd otherwise read as a 100% win rate.
  if (summary.teams.length < 2) return null;
  return team.isWinner ? 'win' : 'loss';
}

function summaryGameType(summary: GameSummary, typeByGameId: Map<string, StatsGameType>): StatsGameType | null {
  if (summary.gameType === 'cricket' || summary.gameType === 'x01') return summary.gameType;
  return typeByGameId.get(summary.id) ?? null;
}

// --- per-game breakdown ---

/**
 * One row per game the player threw in, oldest first. This is the spine of both
 * the career aggregates and the over-time trends.
 */
export function computePlayerGames(
  shots: ShotRow[],
  summaries: GameSummary[],
  name: string,
): PlayerGameStats[] {
  const byGame = new Map<string, ShotRow[]>();
  for (const shot of shots) {
    if (shot.playerName !== name) continue;
    const list = byGame.get(shot.gameId);
    if (list) list.push(shot);
    else byGame.set(shot.gameId, [shot]);
  }

  const summaryById = new Map(summaries.map(s => [s.id, s]));
  const games: PlayerGameStats[] = [];

  for (const [gameId, gameShots] of Array.from(byGame.entries())) {
    // The API returns shots newest-first; round chunking needs throw order.
    const ordered = [...gameShots].sort((a, b) => a.dartSeq - b.dartSeq);
    const gameType = asGameType(ordered[0].gameMode);
    const darts = ordered.length;
    const rounds = chunkIntoRounds(ordered);

    const hits = ordered.filter(s => s.target !== 'miss').length;
    const marks = ordered.reduce((sum, s) => sum + (s.marksApplied ?? 0), 0);
    const busts = ordered.filter(s => s.isBust === true).length;
    const points = ordered.reduce((sum, s) => sum + (s.isBust ? 0 : s.pointsScored), 0);
    const roundTotals = rounds.map(r =>
      r.reduce((sum, s) => sum + (s.isBust ? 0 : s.pointsScored), 0),
    );

    const playedAt = ordered.reduce(
      (earliest, s) => (s.thrownAt < earliest ? s.thrownAt : earliest),
      ordered[0].thrownAt,
    );

    const summary = summaryById.get(gameId);

    games.push({
      gameId,
      gameType,
      playedAt,
      darts,
      rounds: rounds.length,
      hits,
      hitPct: darts > 0 ? hits / darts : 0,
      marks,
      mpr: rounds.length > 0 ? round2(marks / rounds.length) : 0,
      points,
      ppd: darts > 0 ? round2(points / darts) : 0,
      threeDartAvg: roundTotals.length > 0 ? round2(mean(roundTotals)) : 0,
      highestRound: roundTotals.length > 0 ? Math.max(...roundTotals) : 0,
      busts,
      result: summary ? summaryResultFor(summary, name) : null,
    });
  }

  return games.sort((a, b) => a.playedAt.localeCompare(b.playedAt));
}

function headlineFor(game: PlayerGameStats): number {
  return game.gameType === 'cricket' ? game.mpr : game.threeDartAvg;
}

function computeGameTypeStats(
  gameType: StatsGameType,
  games: PlayerGameStats[],
): GameTypeStats | null {
  const typeGames = games.filter(g => g.gameType === gameType);
  if (typeGames.length === 0) return null;

  const darts = typeGames.reduce((sum, g) => sum + g.darts, 0);
  const rounds = typeGames.reduce((sum, g) => sum + g.rounds, 0);
  const hits = typeGames.reduce((sum, g) => sum + g.hits, 0);
  const totalMarks = typeGames.reduce((sum, g) => sum + g.marks, 0);
  const totalPoints = typeGames.reduce((sum, g) => sum + g.points, 0);
  const busts = typeGames.reduce((sum, g) => sum + g.busts, 0);
  const wins = typeGames.filter(g => g.result === 'win').length;
  const losses = typeGames.filter(g => g.result === 'loss').length;
  const decided = wins + losses;

  // Career MPR is total marks over total rounds; the 3-dart average weights
  // every round equally, so it averages the per-game averages by round count.
  const headline = gameType === 'cricket'
    ? (rounds > 0 ? round2(totalMarks / rounds) : 0)
    : (rounds > 0
      ? round2(typeGames.reduce((sum, g) => sum + g.threeDartAvg * g.rounds, 0) / rounds)
      : 0);

  const trend = typeGames.map(headlineFor);
  const recent = trend.slice(-RECENT_FORM_WINDOW);
  const prior = trend.slice(0, -RECENT_FORM_WINDOW);
  const recentAvg = recent.length > 0 ? round2(mean(recent)) : null;
  const priorAvg = prior.length > 0 ? round2(mean(prior)) : null;

  return {
    gameType,
    games: typeGames.length,
    darts,
    rounds,
    wins,
    losses,
    winPct: decided > 0 ? wins / decided : null,
    hitPct: darts > 0 ? hits / darts : 0,
    headline,
    best: trend.length > 0 ? Math.max(...trend) : 0,
    totalMarks,
    totalPoints,
    ppd: darts > 0 ? round2(totalPoints / darts) : 0,
    highestRound: typeGames.reduce((max, g) => Math.max(max, g.highestRound), 0),
    bustRate: darts > 0 ? busts / darts : 0,
    trend,
    trendDates: typeGames.map(g => g.playedAt),
    recentAvg,
    priorAvg,
    delta: recentAvg !== null && priorAvg !== null ? round2(recentAvg - priorAvg) : null,
  };
}

export function computeHeatmap(shots: ShotRow[], name?: string): HeatCell[] {
  const counts = new Map<string, HeatCell>();
  for (const shot of shots) {
    if (name && shot.playerName !== name) continue;
    if (shot.target === 'miss') continue;
    const key = `${shot.target}|${shot.multiplier}`;
    const cell = counts.get(key);
    if (cell) cell.count += 1;
    else counts.set(key, { target: shot.target, multiplier: shot.multiplier, count: 1 });
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}

export function formatTargetLabel(target: string, multiplier: number): string {
  if (target === 'miss') return 'Miss';
  if (target === 'B') return multiplier >= 2 ? 'DB' : 'SB';
  const prefix = multiplier === 3 ? 'T' : multiplier === 2 ? 'D' : 'S';
  return `${prefix}${target}`;
}

/**
 * Everything the player detail screen shows. `shots` may contain other players'
 * rows; they are filtered out.
 */
export function computePlayerDashboard(
  name: string,
  shots: ShotRow[],
  summaries: GameSummary[],
): PlayerDashboard {
  const own = shots.filter(s => s.playerName === name);
  const perGame = computePlayerGames(own, summaries, name);
  const heatmap = computeHeatmap(own);

  const darts = perGame.reduce((sum, g) => sum + g.darts, 0);
  const hits = perGame.reduce((sum, g) => sum + g.hits, 0);

  // Summaries are the source of truth for games played: they cover games that
  // predate shot tracking, where there are no dart rows to group.
  const played = summaries.filter(s => s.teams?.some(t => t.players?.includes(name)));
  const results = played.map(s => summaryResultFor(s, name));
  const wins = results.filter(r => r === 'win').length;
  const losses = results.filter(r => r === 'loss').length;
  const decided = wins + losses;

  const gameIds = new Set(perGame.map(g => g.gameId));
  for (const s of played) gameIds.add(s.id);

  const lastPlayedAt = [
    ...perGame.map(g => g.playedAt),
    ...played.map(s => s.completedAt),
  ].sort();

  return {
    name,
    games: gameIds.size,
    darts,
    wins,
    losses,
    winPct: decided > 0 ? wins / decided : null,
    hitPct: darts > 0 ? hits / darts : 0,
    cricket: computeGameTypeStats('cricket', perGame),
    x01: computeGameTypeStats('x01', perGame),
    perGame,
    heatmap,
    topTargets: heatmap.slice(0, 5).map(cell => ({
      label: formatTargetLabel(cell.target, cell.multiplier),
      target: cell.target,
      multiplier: cell.multiplier,
      count: cell.count,
    })),
    lastPlayed: lastPlayedAt.length > 0 ? lastPlayedAt[lastPlayedAt.length - 1] : null,
  };
}

// --- leaderboards ---

interface BoardSpec {
  key: string;
  title: string;
  caption: string;
  gameType: StatsGameType | 'all';
  /** null = the player has no data for this board and is left off entirely. */
  value: (d: PlayerDashboard) => number | null;
  display: (value: number) => string;
  /** Games counted toward qualification. */
  games: (d: PlayerDashboard) => number;
  detail?: (d: PlayerDashboard) => string | undefined;
  requiresQualification: boolean;
}

const BOARD_SPECS: BoardSpec[] = [
  {
    key: 'winRate',
    title: 'Win rate',
    caption: 'All game types',
    gameType: 'all',
    value: d => d.winPct,
    display: formatPct,
    games: d => d.wins + d.losses,
    detail: d => `${d.wins}-${d.losses}`,
    requiresQualification: false,
  },
  {
    key: 'cricketMpr',
    title: 'Cricket MPR',
    caption: 'Marks per round, career',
    gameType: 'cricket',
    value: d => d.cricket?.headline ?? null,
    display: v => v.toFixed(2),
    games: d => d.cricket?.games ?? 0,
    detail: d => (d.cricket ? `${d.cricket.games} games` : undefined),
    requiresQualification: true,
  },
  {
    key: 'x01Average',
    title: 'X01 3-dart average',
    caption: 'Points per round, career',
    gameType: 'x01',
    value: d => d.x01?.headline ?? null,
    display: v => v.toFixed(1),
    games: d => d.x01?.games ?? 0,
    detail: d => (d.x01 ? `${d.x01.ppd.toFixed(2)} per dart` : undefined),
    requiresQualification: true,
  },
  {
    key: 'accuracy',
    title: 'Accuracy',
    caption: 'Darts on a scoring target',
    gameType: 'all',
    value: d => (d.darts > 0 ? d.hitPct : null),
    display: formatPct,
    games: d => d.perGame.length,
    detail: d => `${d.darts} darts`,
    requiresQualification: true,
  },
  {
    key: 'highestRound',
    title: 'Highest round',
    caption: 'Best 3 darts in X01',
    gameType: 'x01',
    value: d => (d.x01 && d.x01.highestRound > 0 ? d.x01.highestRound : null),
    display: v => String(v),
    games: d => d.x01?.games ?? 0,
    requiresQualification: false,
  },
  {
    key: 'bestMpr',
    title: 'Best cricket game',
    caption: 'Highest single-game MPR',
    gameType: 'cricket',
    value: d => (d.cricket && d.cricket.best > 0 ? d.cricket.best : null),
    display: v => v.toFixed(2),
    games: d => d.cricket?.games ?? 0,
    requiresQualification: false,
  },
  {
    key: 'activity',
    title: 'Most active',
    caption: 'Games played',
    gameType: 'all',
    value: d => (d.games > 0 ? d.games : null),
    display: v => String(v),
    games: d => d.games,
    detail: d => `${d.darts} darts thrown`,
    requiresQualification: false,
  },
];

export function computeLeaderboards(
  dashboards: PlayerDashboard[],
  opts: { minGames?: number } = {},
): Leaderboards {
  const minGames = opts.minGames ?? MIN_GAMES_TO_QUALIFY;

  const boards: Leaderboard[] = BOARD_SPECS.map(spec => {
    const rows: LeaderboardRow[] = [];
    const unqualified: LeaderboardRow[] = [];

    for (const d of dashboards) {
      const value = spec.value(d);
      if (value === null) continue;
      const games = spec.games(d);
      const row: LeaderboardRow = {
        player: d.name,
        value,
        display: spec.display(value),
        games,
        detail: spec.detail?.(d),
      };
      if (spec.requiresQualification && games < minGames) unqualified.push(row);
      else rows.push(row);
    }

    const byValue = (a: LeaderboardRow, b: LeaderboardRow) =>
      b.value - a.value || a.player.localeCompare(b.player);

    return {
      key: spec.key,
      title: spec.title,
      caption: spec.caption,
      gameType: spec.gameType,
      rows: rows.sort(byValue),
      unqualified: unqualified.sort(byValue),
    };
  });

  const allGameIds = new Set<string>();
  for (const d of dashboards) for (const g of d.perGame) allGameIds.add(g.gameId);

  return {
    boards,
    totals: {
      players: dashboards.filter(d => d.games > 0).length,
      games: allGameIds.size,
      darts: dashboards.reduce((sum, d) => sum + d.darts, 0),
    },
  };
}

// --- head-to-head comparison ---

export interface ComparisonMetric {
  key: string;
  label: string;
  /** One entry per compared player, in the order they were passed in. */
  values: Array<number | null>;
  displays: string[];
  higherIsBetter: boolean;
  /** Index of the leading player, or null when nobody has data / it's a tie. */
  bestIndex: number | null;
}

export interface ComparisonSeries {
  player: string;
  points: number[];
}

export interface ComparisonSection {
  key: StatsGameType | 'overall';
  title: string;
  /** Empty when nobody being compared has played this game type. */
  metrics: ComparisonMetric[];
  seriesLabel: string;
  series: ComparisonSeries[];
}

export interface HeadToHead {
  a: string;
  b: string;
  aWins: number;
  bWins: number;
  games: number;
}

export interface Comparison {
  players: string[];
  sections: ComparisonSection[];
  headToHead: HeadToHead[];
}

function buildMetric(
  key: string,
  label: string,
  values: Array<number | null>,
  display: (v: number) => string,
  higherIsBetter: boolean,
): ComparisonMetric {
  let bestIndex: number | null = null;
  let bestValue: number | null = null;
  let tied = false;

  values.forEach((v, i) => {
    if (v === null) return;
    if (bestValue === null || (higherIsBetter ? v > bestValue : v < bestValue)) {
      bestValue = v;
      bestIndex = i;
      tied = false;
    } else if (v === bestValue) {
      tied = true;
    }
  });

  return {
    key,
    label,
    values,
    displays: values.map(v => (v === null ? '—' : display(v))),
    higherIsBetter,
    bestIndex: tied ? null : bestIndex,
  };
}

/** Wins and losses between two players who were on opposing teams. */
export function computeHeadToHead(a: string, b: string, summaries: GameSummary[]): HeadToHead {
  let aWins = 0;
  let bWins = 0;
  let games = 0;

  for (const summary of summaries) {
    const teamA = summary.teams?.find(t => t.players?.includes(a));
    const teamB = summary.teams?.find(t => t.players?.includes(b));
    if (!teamA || !teamB || teamA === teamB) continue;
    games += 1;
    if (teamA.isWinner) aWins += 1;
    else if (teamB.isWinner) bWins += 1;
  }

  return { a, b, aWins, bWins, games };
}

/**
 * Side-by-side metrics for two or more players, split by game type, plus the
 * per-game series that drives the overlaid trend chart.
 */
export function computeComparison(
  dashboards: PlayerDashboard[],
  summaries: GameSummary[],
): Comparison {
  const players = dashboards.map(d => d.name);

  const overall: ComparisonSection = {
    key: 'overall',
    title: 'Overall',
    metrics: [
      buildMetric('winPct', 'Win rate', dashboards.map(d => d.winPct), formatPct, true),
      buildMetric('record', 'Wins', dashboards.map(d => d.wins), v => String(v), true),
      buildMetric('games', 'Games played', dashboards.map(d => d.games), v => String(v), true),
      buildMetric(
        'accuracy',
        'Accuracy',
        dashboards.map(d => (d.darts > 0 ? d.hitPct : null)),
        formatPct,
        true,
      ),
      buildMetric('darts', 'Darts thrown', dashboards.map(d => d.darts), v => String(v), true),
    ],
    seriesLabel: '',
    series: [],
  };

  const cricket: ComparisonSection = {
    key: 'cricket',
    title: 'Cricket',
    metrics: [
      buildMetric('mpr', 'MPR', dashboards.map(d => d.cricket?.headline ?? null), v => v.toFixed(2), true),
      buildMetric('bestMpr', 'Best game MPR', dashboards.map(d => d.cricket?.best ?? null), v => v.toFixed(2), true),
      buildMetric('marks', 'Total marks', dashboards.map(d => d.cricket?.totalMarks ?? null), v => String(v), true),
      buildMetric('cricketWin', 'Win rate', dashboards.map(d => d.cricket?.winPct ?? null), formatPct, true),
      buildMetric('cricketGames', 'Games', dashboards.map(d => d.cricket?.games ?? null), v => String(v), true),
    ],
    seriesLabel: 'MPR by game',
    series: dashboards
      .filter(d => d.cricket)
      .map(d => ({ player: d.name, points: d.cricket!.trend })),
  };

  const x01: ComparisonSection = {
    key: 'x01',
    title: 'X01',
    metrics: [
      buildMetric('avg', '3-dart average', dashboards.map(d => d.x01?.headline ?? null), v => v.toFixed(1), true),
      buildMetric('best', 'Best game average', dashboards.map(d => d.x01?.best ?? null), v => v.toFixed(1), true),
      buildMetric('highest', 'Highest round', dashboards.map(d => d.x01?.highestRound ?? null), v => String(v), true),
      buildMetric('bust', 'Bust rate', dashboards.map(d => d.x01?.bustRate ?? null), formatPct, false),
      buildMetric('x01Win', 'Win rate', dashboards.map(d => d.x01?.winPct ?? null), formatPct, true),
      buildMetric('x01Games', 'Games', dashboards.map(d => d.x01?.games ?? null), v => String(v), true),
    ],
    seriesLabel: '3-dart average by game',
    series: dashboards
      .filter(d => d.x01)
      .map(d => ({ player: d.name, points: d.x01!.trend })),
  };

  const headToHead: HeadToHead[] = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const h2h = computeHeadToHead(players[i], players[j], summaries);
      if (h2h.games > 0) headToHead.push(h2h);
    }
  }

  return {
    players,
    sections: [overall, cricket, x01].filter(
      section => section.key === 'overall' || section.series.length > 0,
    ),
    headToHead,
  };
}
