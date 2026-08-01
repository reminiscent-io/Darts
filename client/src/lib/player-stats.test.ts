import { describe, it, expect } from 'vitest';
import {
  computePlayerGames,
  computePlayerDashboard,
  computeLeaderboards,
  computeComparison,
  computeHeadToHead,
  computeHeatmap,
  chunkIntoRounds,
  movingAverage,
  formatTargetLabel,
  MIN_GAMES_TO_QUALIFY,
  type ShotRow,
} from './player-stats';
import { GameSummary } from './types';

let seq = 0;

function shot(overrides: Partial<ShotRow> & { gameId: string; playerName: string }): ShotRow {
  return {
    dartSeq: seq++,
    teamName: 'Team 1',
    gameMode: 'cricket',
    target: '20',
    multiplier: 1,
    pointsScored: 0,
    marksApplied: 1,
    isBust: null,
    thrownAt: '2026-01-01T10:00:00.000Z',
    ...overrides,
  };
}

/** `count` cricket darts, each applying `marks` marks. */
function cricketDarts(
  gameId: string,
  player: string,
  count: number,
  marks: number,
  thrownAt = '2026-01-01T10:00:00.000Z',
): ShotRow[] {
  return Array.from({ length: count }, (_, i) =>
    shot({
      gameId,
      playerName: player,
      dartSeq: i,
      gameMode: 'cricket',
      marksApplied: marks,
      thrownAt,
    }),
  );
}

/** `count` X01 darts, each scoring `points`. */
function x01Darts(
  gameId: string,
  player: string,
  count: number,
  points: number,
  thrownAt = '2026-01-01T10:00:00.000Z',
): ShotRow[] {
  return Array.from({ length: count }, (_, i) =>
    shot({
      gameId,
      playerName: player,
      dartSeq: i,
      gameMode: 'x01',
      marksApplied: null,
      pointsScored: points,
      isBust: false,
      thrownAt,
    }),
  );
}

function summary(
  id: string,
  gameType: 'cricket' | 'x01',
  teams: Array<{ players: string[]; isWinner: boolean }>,
  completedAt = '2026-01-01T11:00:00.000Z',
): GameSummary {
  return {
    id,
    gameType,
    teams: teams.map((t, i) => ({
      name: `Team ${i + 1}`,
      players: t.players,
      score: 0,
      isWinner: t.isWinner,
    })),
    totalDarts: 0,
    completedAt,
  };
}

describe('chunkIntoRounds', () => {
  it('groups darts in threes with a short final round', () => {
    expect(chunkIntoRounds([1, 2, 3, 4, 5, 6, 7])).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });

  it('returns nothing for no darts', () => {
    expect(chunkIntoRounds([])).toEqual([]);
  });
});

describe('movingAverage', () => {
  it('averages over the trailing window, using what exists at the start', () => {
    expect(movingAverage([3, 6, 9, 12], 3)).toEqual([3, 4.5, 6, 9]);
  });

  it('handles an empty series', () => {
    expect(movingAverage([], 3)).toEqual([]);
  });
});

describe('computePlayerGames', () => {
  it('chunks rounds per game and never across game boundaries', () => {
    // Two cricket games of 2 darts each: 2 rounds total, not 1 round of 4 darts.
    const shots = [
      ...cricketDarts('g1', 'Ann', 2, 1, '2026-01-01T10:00:00.000Z'),
      ...cricketDarts('g2', 'Ann', 2, 1, '2026-01-02T10:00:00.000Z'),
    ];
    const games = computePlayerGames(shots, [], 'Ann');
    expect(games).toHaveLength(2);
    expect(games.every(g => g.rounds === 1)).toBe(true);
    expect(games.every(g => g.mpr === 2)).toBe(true);
  });

  it('orders games oldest first regardless of shot order', () => {
    const shots = [
      ...cricketDarts('late', 'Ann', 3, 1, '2026-03-01T10:00:00.000Z'),
      ...cricketDarts('early', 'Ann', 3, 1, '2026-01-01T10:00:00.000Z'),
    ];
    expect(computePlayerGames(shots, [], 'Ann').map(g => g.gameId)).toEqual(['early', 'late']);
  });

  it('sorts by dartSeq before chunking, even when rows arrive newest-first', () => {
    // 6 darts: seq 0-2 score 60 each, seq 3-5 score 0. Correct chunking gives
    // rounds of 180 and 0; chunking the reversed order would give 60 and 120.
    const ordered = [
      ...Array.from({ length: 3 }, (_, i) =>
        shot({ gameId: 'g1', playerName: 'Ann', dartSeq: i, gameMode: 'x01', pointsScored: 60, isBust: false, marksApplied: null }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        shot({ gameId: 'g1', playerName: 'Ann', dartSeq: 3 + i, gameMode: 'x01', pointsScored: 0, isBust: false, marksApplied: null }),
      ),
    ];
    const games = computePlayerGames([...ordered].reverse(), [], 'Ann');
    expect(games[0].highestRound).toBe(180);
    expect(games[0].threeDartAvg).toBe(90);
  });

  it('counts bust darts as zero points but still as darts thrown', () => {
    const shots = [
      ...x01Darts('g1', 'Ann', 2, 60),
      shot({ gameId: 'g1', playerName: 'Ann', dartSeq: 2, gameMode: 'x01', pointsScored: 20, isBust: true, marksApplied: null }),
    ];
    const [game] = computePlayerGames(shots, [], 'Ann');
    expect(game.darts).toBe(3);
    expect(game.points).toBe(120);
    expect(game.threeDartAvg).toBe(120);
    expect(game.busts).toBe(1);
  });

  it('ignores other players’ shots', () => {
    const shots = [
      ...cricketDarts('g1', 'Ann', 3, 2),
      ...cricketDarts('g1', 'Bob', 3, 1),
    ];
    const games = computePlayerGames(shots, [], 'Ann');
    expect(games).toHaveLength(1);
    expect(games[0].marks).toBe(6);
  });

  it('tags win/loss from the summary and leaves it null when there is none', () => {
    const shots = [
      ...cricketDarts('won', 'Ann', 3, 1, '2026-01-01T10:00:00.000Z'),
      ...cricketDarts('lost', 'Ann', 3, 1, '2026-01-02T10:00:00.000Z'),
      ...cricketDarts('unknown', 'Ann', 3, 1, '2026-01-03T10:00:00.000Z'),
    ];
    const summaries = [
      summary('won', 'cricket', [{ players: ['Ann'], isWinner: true }, { players: ['Bob'], isWinner: false }]),
      summary('lost', 'cricket', [{ players: ['Ann'], isWinner: false }, { players: ['Bob'], isWinner: true }]),
    ];
    expect(computePlayerGames(shots, summaries, 'Ann').map(g => g.result)).toEqual(['win', 'loss', null]);
  });

  it('computes hit % with misses excluded from hits', () => {
    const shots = [
      ...cricketDarts('g1', 'Ann', 3, 1),
      shot({ gameId: 'g1', playerName: 'Ann', dartSeq: 3, target: 'miss', marksApplied: 0 }),
    ];
    const [game] = computePlayerGames(shots, [], 'Ann');
    expect(game.hits).toBe(3);
    expect(game.hitPct).toBe(0.75);
  });

  it('returns nothing when the player has no shots', () => {
    expect(computePlayerGames([], [], 'Ann')).toEqual([]);
  });
});

describe('computePlayerDashboard', () => {
  it('splits career stats by game type', () => {
    const shots = [
      ...cricketDarts('c1', 'Ann', 3, 2, '2026-01-01T10:00:00.000Z'),
      ...x01Darts('x1', 'Ann', 3, 20, '2026-01-02T10:00:00.000Z'),
    ];
    const d = computePlayerDashboard('Ann', shots, []);
    expect(d.cricket?.games).toBe(1);
    expect(d.cricket?.headline).toBe(6); // 6 marks / 1 round
    expect(d.x01?.games).toBe(1);
    expect(d.x01?.headline).toBe(60); // 3 darts x 20
    expect(d.games).toBe(2);
    expect(d.darts).toBe(6);
  });

  it('is null for a game type the player has never played', () => {
    const d = computePlayerDashboard('Ann', cricketDarts('c1', 'Ann', 3, 1), []);
    expect(d.cricket).not.toBeNull();
    expect(d.x01).toBeNull();
  });

  it('weights the career 3-dart average by rounds, not by game', () => {
    // Game 1: 3 darts x 20 = one round of 60. Game 2: 6 darts x 10 = two rounds of 30.
    // Rounds-weighted mean is (60 + 30 + 30) / 3 = 40, not (60 + 30) / 2 = 45.
    const shots = [
      ...x01Darts('x1', 'Ann', 3, 20, '2026-01-01T10:00:00.000Z'),
      ...x01Darts('x2', 'Ann', 6, 10, '2026-01-02T10:00:00.000Z'),
    ];
    expect(computePlayerDashboard('Ann', shots, []).x01?.headline).toBe(40);
  });

  it('computes career MPR over total rounds', () => {
    // 4 darts (2 rounds) at 2 marks + 2 darts (1 round) at 3 marks = 14 marks / 3 rounds.
    const shots = [
      ...cricketDarts('c1', 'Ann', 4, 2, '2026-01-01T10:00:00.000Z'),
      ...cricketDarts('c2', 'Ann', 2, 3, '2026-01-02T10:00:00.000Z'),
    ];
    expect(computePlayerDashboard('Ann', shots, []).cricket?.headline).toBe(4.67);
  });

  it('counts games that predate shot tracking toward the record', () => {
    const summaries = [
      summary('old', 'cricket', [{ players: ['Ann'], isWinner: true }, { players: ['Bob'], isWinner: false }]),
    ];
    const d = computePlayerDashboard('Ann', [], summaries);
    expect(d.games).toBe(1);
    expect(d.wins).toBe(1);
    expect(d.winPct).toBe(1);
    expect(d.darts).toBe(0);
    expect(d.cricket).toBeNull(); // no shots, so no skill metrics
  });

  it('does not double-count a game that has both shots and a summary', () => {
    const shots = cricketDarts('g1', 'Ann', 3, 1);
    const summaries = [
      summary('g1', 'cricket', [{ players: ['Ann'], isWinner: true }, { players: ['Bob'], isWinner: false }]),
    ];
    expect(computePlayerDashboard('Ann', shots, summaries).games).toBe(1);
  });

  it('ignores solo games when computing win rate', () => {
    const summaries = [
      summary('solo', 'cricket', [{ players: ['Ann'], isWinner: true }]),
    ];
    const d = computePlayerDashboard('Ann', [], summaries);
    expect(d.winPct).toBeNull();
    expect(d.wins).toBe(0);
  });

  it('reports recent form against earlier games', () => {
    // Six cricket games, the last five stronger than the first.
    const shots = [
      ...cricketDarts('g1', 'Ann', 3, 1, '2026-01-01T10:00:00.000Z'),
      ...cricketDarts('g2', 'Ann', 3, 2, '2026-01-02T10:00:00.000Z'),
      ...cricketDarts('g3', 'Ann', 3, 2, '2026-01-03T10:00:00.000Z'),
      ...cricketDarts('g4', 'Ann', 3, 2, '2026-01-04T10:00:00.000Z'),
      ...cricketDarts('g5', 'Ann', 3, 2, '2026-01-05T10:00:00.000Z'),
      ...cricketDarts('g6', 'Ann', 3, 2, '2026-01-06T10:00:00.000Z'),
    ];
    const cricket = computePlayerDashboard('Ann', shots, []).cricket!;
    expect(cricket.trend).toEqual([3, 6, 6, 6, 6, 6]);
    expect(cricket.priorAvg).toBe(3);
    expect(cricket.recentAvg).toBe(6);
    expect(cricket.delta).toBe(3);
  });

  it('leaves the form delta null until there are games on both sides', () => {
    const cricket = computePlayerDashboard('Ann', cricketDarts('g1', 'Ann', 3, 1), []).cricket!;
    expect(cricket.recentAvg).toBe(3);
    expect(cricket.priorAvg).toBeNull();
    expect(cricket.delta).toBeNull();
  });

  it('handles a player with no data at all', () => {
    const d = computePlayerDashboard('Ghost', [], []);
    expect(d.games).toBe(0);
    expect(d.darts).toBe(0);
    expect(d.winPct).toBeNull();
    expect(d.hitPct).toBe(0);
    expect(d.cricket).toBeNull();
    expect(d.x01).toBeNull();
    expect(d.heatmap).toEqual([]);
    expect(d.lastPlayed).toBeNull();
  });
});

describe('computeHeatmap', () => {
  it('buckets by target and multiplier, busiest first, and drops misses', () => {
    const shots = [
      shot({ gameId: 'g1', playerName: 'Ann', target: '20', multiplier: 3 }),
      shot({ gameId: 'g1', playerName: 'Ann', target: '20', multiplier: 3 }),
      shot({ gameId: 'g1', playerName: 'Ann', target: '20', multiplier: 1 }),
      shot({ gameId: 'g1', playerName: 'Ann', target: 'miss', multiplier: 1 }),
    ];
    expect(computeHeatmap(shots)).toEqual([
      { target: '20', multiplier: 3, count: 2 },
      { target: '20', multiplier: 1, count: 1 },
    ]);
  });

  it('filters to one player when a name is given', () => {
    const shots = [
      shot({ gameId: 'g1', playerName: 'Ann', target: '19', multiplier: 1 }),
      shot({ gameId: 'g1', playerName: 'Bob', target: '19', multiplier: 1 }),
    ];
    expect(computeHeatmap(shots, 'Ann')).toEqual([{ target: '19', multiplier: 1, count: 1 }]);
  });
});

describe('formatTargetLabel', () => {
  it('formats singles, doubles, triples and bulls', () => {
    expect(formatTargetLabel('20', 1)).toBe('S20');
    expect(formatTargetLabel('20', 2)).toBe('D20');
    expect(formatTargetLabel('20', 3)).toBe('T20');
    expect(formatTargetLabel('B', 1)).toBe('SB');
    expect(formatTargetLabel('B', 2)).toBe('DB');
    expect(formatTargetLabel('miss', 1)).toBe('Miss');
  });
});

describe('computeLeaderboards', () => {
  function dashboardsFor(cricketGamesPerPlayer: Record<string, number>, marks: Record<string, number>) {
    return Object.keys(cricketGamesPerPlayer).map(name => {
      const shots = Array.from({ length: cricketGamesPerPlayer[name] }, (_, i) =>
        cricketDarts(`${name}-g${i}`, name, 3, marks[name], `2026-01-0${i + 1}T10:00:00.000Z`),
      ).flat();
      return computePlayerDashboard(name, shots, []);
    });
  }

  it('ranks qualified players and sidelines those below the minimum', () => {
    const dashboards = dashboardsFor(
      { Ann: MIN_GAMES_TO_QUALIFY, Bob: MIN_GAMES_TO_QUALIFY, Cal: MIN_GAMES_TO_QUALIFY - 1 },
      { Ann: 2, Bob: 3, Cal: 5 },
    );
    const board = computeLeaderboards(dashboards).boards.find(b => b.key === 'cricketMpr')!;
    expect(board.rows.map(r => r.player)).toEqual(['Bob', 'Ann']);
    expect(board.unqualified.map(r => r.player)).toEqual(['Cal']);
  });

  it('applies no minimum to the win-rate board', () => {
    const summaries = [
      summary('g1', 'cricket', [{ players: ['Ann'], isWinner: true }, { players: ['Bob'], isWinner: false }]),
    ];
    const dashboards = ['Ann', 'Bob'].map(n => computePlayerDashboard(n, [], summaries));
    const board = computeLeaderboards(dashboards).boards.find(b => b.key === 'winRate')!;
    expect(board.rows.map(r => r.player)).toEqual(['Ann', 'Bob']);
    expect(board.rows[0].display).toBe('100%');
    expect(board.rows[0].detail).toBe('1-0');
    expect(board.unqualified).toEqual([]);
  });

  it('leaves players off boards they have no data for', () => {
    const dashboards = [computePlayerDashboard('Ann', cricketDarts('g1', 'Ann', 3, 1), [])];
    const board = computeLeaderboards(dashboards).boards.find(b => b.key === 'x01Average')!;
    expect(board.rows).toEqual([]);
    expect(board.unqualified).toEqual([]);
  });

  it('breaks ties by name so ordering is stable', () => {
    const dashboards = dashboardsFor(
      { Zoe: MIN_GAMES_TO_QUALIFY, Ann: MIN_GAMES_TO_QUALIFY },
      { Zoe: 2, Ann: 2 },
    );
    const board = computeLeaderboards(dashboards).boards.find(b => b.key === 'cricketMpr')!;
    expect(board.rows.map(r => r.player)).toEqual(['Ann', 'Zoe']);
  });

  it('counts each game once across all players in the totals', () => {
    const shots = [...cricketDarts('shared', 'Ann', 3, 1), ...cricketDarts('shared', 'Bob', 3, 1)];
    const dashboards = ['Ann', 'Bob'].map(n => computePlayerDashboard(n, shots, []));
    expect(computeLeaderboards(dashboards).totals).toEqual({ players: 2, games: 1, darts: 6 });
  });

  it('respects a custom minimum', () => {
    const dashboards = dashboardsFor({ Ann: 1 }, { Ann: 2 });
    const board = computeLeaderboards(dashboards, { minGames: 1 }).boards.find(b => b.key === 'cricketMpr')!;
    expect(board.rows.map(r => r.player)).toEqual(['Ann']);
  });

  it('returns empty boards for an empty roster', () => {
    const { boards, totals } = computeLeaderboards([]);
    expect(boards.every(b => b.rows.length === 0 && b.unqualified.length === 0)).toBe(true);
    expect(totals).toEqual({ players: 0, games: 0, darts: 0 });
  });
});

describe('computeHeadToHead', () => {
  it('counts only games where the two were on opposing teams', () => {
    const summaries = [
      summary('g1', 'cricket', [{ players: ['Ann'], isWinner: true }, { players: ['Bob'], isWinner: false }]),
      summary('g2', 'cricket', [{ players: ['Ann'], isWinner: false }, { players: ['Bob'], isWinner: true }]),
      summary('g3', 'cricket', [{ players: ['Ann'], isWinner: true }, { players: ['Cal'], isWinner: false }]),
      // Same team: not a head-to-head.
      summary('g4', 'cricket', [{ players: ['Ann', 'Bob'], isWinner: true }, { players: ['Cal'], isWinner: false }]),
    ];
    expect(computeHeadToHead('Ann', 'Bob', summaries)).toEqual({ a: 'Ann', b: 'Bob', aWins: 1, bWins: 1, games: 2 });
  });

  it('is empty when they have never met', () => {
    expect(computeHeadToHead('Ann', 'Zoe', [])).toEqual({ a: 'Ann', b: 'Zoe', aWins: 0, bWins: 0, games: 0 });
  });
});

describe('computeComparison', () => {
  it('marks the leader per metric and respects lower-is-better', () => {
    const annShots = [
      ...x01Darts('x1', 'Ann', 3, 20, '2026-01-01T10:00:00.000Z'),
      shot({ gameId: 'x1', playerName: 'Ann', dartSeq: 3, gameMode: 'x01', pointsScored: 0, isBust: true, marksApplied: null }),
    ];
    // Ann: rounds of 60 and 0 (the bust) = 30 average. Bob: a single round of 15.
    const bobShots = x01Darts('x2', 'Bob', 3, 5, '2026-01-01T10:00:00.000Z');
    const dashboards = [
      computePlayerDashboard('Ann', annShots, []),
      computePlayerDashboard('Bob', bobShots, []),
    ];
    const x01 = computeComparison(dashboards, []).sections.find(s => s.key === 'x01')!;

    const avg = x01.metrics.find(m => m.key === 'avg')!;
    expect(avg.bestIndex).toBe(0); // Ann averages more
    // Ann busted once in four darts; Bob never busted, so Bob leads bust rate.
    const bust = x01.metrics.find(m => m.key === 'bust')!;
    expect(bust.higherIsBetter).toBe(false);
    expect(bust.bestIndex).toBe(1);
  });

  it('reports no leader on a tie', () => {
    const dashboards = ['Ann', 'Bob'].map(n =>
      computePlayerDashboard(n, cricketDarts(`${n}-g1`, n, 3, 2), []),
    );
    const cricket = computeComparison(dashboards, []).sections.find(s => s.key === 'cricket')!;
    expect(cricket.metrics.find(m => m.key === 'mpr')!.bestIndex).toBeNull();
  });

  it('shows a dash for players with no data for a metric', () => {
    const dashboards = [
      computePlayerDashboard('Ann', cricketDarts('g1', 'Ann', 3, 2), []),
      computePlayerDashboard('Bob', [], []),
    ];
    const cricket = computeComparison(dashboards, []).sections.find(s => s.key === 'cricket')!;
    const mpr = cricket.metrics.find(m => m.key === 'mpr')!;
    expect(mpr.displays).toEqual(['6.00', '—']);
    expect(mpr.bestIndex).toBe(0);
  });

  it('drops a game-type section nobody has played, and always keeps overall', () => {
    const dashboards = [computePlayerDashboard('Ann', cricketDarts('g1', 'Ann', 3, 2), [])];
    const keys = computeComparison(dashboards, []).sections.map(s => s.key);
    expect(keys).toContain('overall');
    expect(keys).toContain('cricket');
    expect(keys).not.toContain('x01');
  });

  it('carries one trend series per player who played that type', () => {
    const dashboards = [
      computePlayerDashboard('Ann', [
        ...cricketDarts('g1', 'Ann', 3, 1, '2026-01-01T10:00:00.000Z'),
        ...cricketDarts('g2', 'Ann', 3, 2, '2026-01-02T10:00:00.000Z'),
      ], []),
      computePlayerDashboard('Bob', cricketDarts('g3', 'Bob', 3, 3, '2026-01-01T10:00:00.000Z'), []),
    ];
    const cricket = computeComparison(dashboards, []).sections.find(s => s.key === 'cricket')!;
    expect(cricket.series).toEqual([
      { player: 'Ann', points: [3, 6] },
      { player: 'Bob', points: [9] },
    ]);
  });

  it('includes every pairing that has met', () => {
    const summaries = [
      summary('g1', 'cricket', [{ players: ['Ann'], isWinner: true }, { players: ['Bob'], isWinner: false }]),
      summary('g2', 'cricket', [{ players: ['Bob'], isWinner: true }, { players: ['Cal'], isWinner: false }]),
    ];
    const dashboards = ['Ann', 'Bob', 'Cal'].map(n => computePlayerDashboard(n, [], summaries));
    const h2h = computeComparison(dashboards, summaries).headToHead;
    expect(h2h.map(h => `${h.a}v${h.b}`)).toEqual(['AnnvBob', 'BobvCal']);
  });
});
