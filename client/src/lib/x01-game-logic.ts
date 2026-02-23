import { X01Game, X01Team, DartEntry, Player, Multiplier } from './types';
import { generateId, buildTurnOrder, getCurrentPlayer, formatDart as sharedFormatDart } from './game-logic';

export function getDartPointValue(target: number | 'B', multiplier: Multiplier): number {
  const base = target === 'B' ? 25 : target;
  return base * multiplier;
}

export function createX01Game(config: {
  startingScore: number;
  doubleOut: boolean;
  mode: 'team' | 'individual';
  // Team mode
  team1Name?: string;
  team1Players?: string[];
  team2Name?: string;
  team2Players?: string[];
  firstTeamIndex?: number;
  // Individual mode
  playerNames?: string[];
}): X01Game {
  let teams: X01Team[];

  if (config.mode === 'individual') {
    const names = config.playerNames || ['Player 1', 'Player 2'];
    teams = names.map((name, i) => {
      const teamId = generateId();
      return {
        id: teamId,
        name: name.trim() || `Player ${i + 1}`,
        players: [{
          id: generateId(),
          name: name.trim() || `Player ${i + 1}`,
          teamId,
        }],
        remainingScore: config.startingScore,
      };
    });
  } else {
    const team1Id = generateId();
    const team2Id = generateId();

    const t1Players = (config.team1Players || ['Player 1']).map((name, i) => ({
      id: generateId(),
      name: name || `Player ${i + 1}`,
      teamId: team1Id,
    }));

    const t2Players = (config.team2Players || ['Player 2']).map((name, i) => ({
      id: generateId(),
      name: name || `Player ${i + 1}`,
      teamId: team2Id,
    }));

    const t1: X01Team = {
      id: team1Id,
      name: config.team1Name || 'Team 1',
      players: t1Players,
      remainingScore: config.startingScore,
    };

    const t2: X01Team = {
      id: team2Id,
      name: config.team2Name || 'Team 2',
      players: t2Players,
      remainingScore: config.startingScore,
    };

    teams = config.firstTeamIndex === 1 ? [t2, t1] : [t1, t2];
  }

  const turnOrder = buildTurnOrder(teams);

  return {
    gameType: 'x01',
    id: generateId(),
    startingScore: config.startingScore,
    doubleOut: config.doubleOut,
    mode: config.mode,
    teams,
    currentTurnIndex: 0,
    turnOrder,
    dartHistory: [],
    currentTurnDarts: [],
    status: 'in_progress',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Get the team's score at the start of the current turn (before any currentTurnDarts).
 */
function getScoreAtTurnStart(game: X01Game, teamIndex: number): number {
  const team = game.teams[teamIndex];
  const turnDartsPoints = game.currentTurnDarts
    .filter(d => d.teamId === team.id && !d.isBust)
    .reduce((sum, d) => sum + d.pointsScored, 0);
  return team.remainingScore + turnDartsPoints;
}

export function recordX01Dart(
  game: X01Game,
  target: number | 'B' | 'miss',
  multiplier: Multiplier
): { game: X01Game; dart: DartEntry; isWin: boolean; isBust: boolean } {
  const { player, teamIndex } = getCurrentPlayer(game);
  const team = game.teams[teamIndex];

  let pointsScored = 0;
  let isBust = false;

  if (target !== 'miss') {
    pointsScored = getDartPointValue(target, multiplier);

    const newRemaining = team.remainingScore - pointsScored;

    if (newRemaining < 0) {
      // Bust: went below zero
      isBust = true;
    } else if (newRemaining === 1 && game.doubleOut) {
      // Bust: can't finish with double from 1
      isBust = true;
    } else if (newRemaining === 0 && game.doubleOut && multiplier !== 2) {
      // Bust: must finish on a double
      isBust = true;
    }
  }

  const dart: DartEntry = {
    id: generateId(),
    playerId: player.id,
    teamId: team.id,
    target,
    multiplier,
    pointsScored: isBust ? 0 : pointsScored,
    isBust,
    timestamp: new Date().toISOString(),
  };

  if (isBust) {
    // Revert ALL darts in current turn + this dart doesn't count
    const scoreAtTurnStart = getScoreAtTurnStart(game, teamIndex);

    const newTeams = game.teams.map((t, idx) =>
      idx === teamIndex ? { ...t, remainingScore: scoreAtTurnStart } : { ...t }
    ) as X01Team[];

    // Mark all current turn darts as bust too (for display)
    const bustedCurrentDarts = game.currentTurnDarts.map(d => ({ ...d, isBust: true, pointsScored: 0 }));

    const newGame: X01Game = {
      ...game,
      teams: newTeams,
      // Keep bust darts in history for reference, advance turn
      dartHistory: [...game.dartHistory.slice(0, game.dartHistory.length - game.currentTurnDarts.length), ...bustedCurrentDarts, dart],
      currentTurnDarts: [],
      currentTurnIndex: (game.currentTurnIndex + 1) % game.turnOrder.length,
    };

    return { game: newGame, dart, isWin: false, isBust: true };
  }

  // Normal dart
  const newTeams = game.teams.map((t, idx) =>
    idx === teamIndex
      ? { ...t, remainingScore: t.remainingScore - pointsScored }
      : { ...t }
  ) as X01Team[];

  const newGame: X01Game = {
    ...game,
    teams: newTeams,
    currentTurnDarts: [...game.currentTurnDarts, dart],
    dartHistory: [...game.dartHistory, dart],
  };

  const isWin = newTeams[teamIndex].remainingScore === 0;

  return { game: newGame, dart, isWin, isBust: false };
}

export function undoLastX01Dart(game: X01Game): { game: X01Game; crossedTurnBoundary: boolean } {
  if (game.currentTurnDarts.length > 0) {
    const lastDart = game.currentTurnDarts[game.currentTurnDarts.length - 1];
    const revertedGame = revertX01Dart(game, lastDart);
    return {
      game: {
        ...revertedGame,
        currentTurnDarts: revertedGame.currentTurnDarts.slice(0, -1),
        dartHistory: revertedGame.dartHistory.slice(0, -1),
      },
      crossedTurnBoundary: false,
    };
  }

  if (game.dartHistory.length === 0) {
    return { game, crossedTurnBoundary: false };
  }

  // Look back for previous player's turn darts
  const prevTurnIndex = (game.currentTurnIndex - 1 + game.turnOrder.length) % game.turnOrder.length;
  const prevRef = game.turnOrder[prevTurnIndex];

  // Find previous player's darts (skip bust darts at the end)
  const prevTurnDarts: DartEntry[] = [];
  for (let i = game.dartHistory.length - 1; i >= 0; i--) {
    const d = game.dartHistory[i];
    if (d.playerId === prevRef.playerId && d.teamId === prevRef.teamId) {
      prevTurnDarts.unshift(d);
    } else {
      break;
    }
  }

  if (prevTurnDarts.length === 0) {
    return { game, crossedTurnBoundary: false };
  }

  // If previous turn was a bust, undo the entire bust
  const wasBust = prevTurnDarts.some(d => d.isBust);
  if (wasBust) {
    // Remove all bust darts from history, restore score to before bust turn
    const historyWithoutBust = game.dartHistory.slice(0, game.dartHistory.length - prevTurnDarts.length);

    // Recalculate the team's score from the starting score minus all non-bust darts for that team
    const teamId = prevRef.teamId;
    const teamIdx = game.teams.findIndex(t => t.id === teamId);
    const nonBustDartsForTeam = historyWithoutBust.filter(d => d.teamId === teamId && !d.isBust);
    const totalScored = nonBustDartsForTeam.reduce((sum, d) => sum + d.pointsScored, 0);

    const newTeams = game.teams.map((t, idx) =>
      idx === teamIdx ? { ...t, remainingScore: game.startingScore - totalScored } : { ...t }
    ) as X01Team[];

    return {
      game: {
        ...game,
        teams: newTeams,
        currentTurnIndex: prevTurnIndex,
        currentTurnDarts: [],
        dartHistory: historyWithoutBust,
      },
      crossedTurnBoundary: true,
    };
  }

  // Normal undo across turn boundary
  const lastDart = prevTurnDarts[prevTurnDarts.length - 1];
  const revertedGame = revertX01Dart(game, lastDart);

  return {
    game: {
      ...revertedGame,
      currentTurnIndex: prevTurnIndex,
      currentTurnDarts: prevTurnDarts.slice(0, -1),
      dartHistory: revertedGame.dartHistory.slice(0, -1),
    },
    crossedTurnBoundary: true,
  };
}

function revertX01Dart(game: X01Game, dart: DartEntry): X01Game {
  if (dart.target === 'miss' || dart.isBust) return game;

  const teamIndex = game.teams.findIndex(t => t.id === dart.teamId);
  if (teamIndex < 0) return game;

  const newTeams = game.teams.map((t, idx) =>
    idx === teamIndex
      ? { ...t, remainingScore: t.remainingScore + dart.pointsScored }
      : { ...t }
  ) as X01Team[];

  return { ...game, teams: newTeams };
}

export function removeX01DartAtIndex(game: X01Game, dartIndex: number): X01Game {
  const dart = game.currentTurnDarts[dartIndex];
  if (!dart) return game;

  const revertedGame = revertX01Dart(game, dart);

  const newCurrentTurnDarts = [
    ...revertedGame.currentTurnDarts.slice(0, dartIndex),
    ...revertedGame.currentTurnDarts.slice(dartIndex + 1),
  ];

  const historyIndex = revertedGame.dartHistory.findIndex(d => d.id === dart.id);
  const newDartHistory = historyIndex >= 0
    ? [...revertedGame.dartHistory.slice(0, historyIndex), ...revertedGame.dartHistory.slice(historyIndex + 1)]
    : revertedGame.dartHistory;

  return {
    ...revertedGame,
    currentTurnDarts: newCurrentTurnDarts,
    dartHistory: newDartHistory,
  };
}

export { sharedFormatDart as formatX01Dart };

export function getX01PlayerStats(game: X01Game, playerId: string) {
  const playerDarts = game.dartHistory.filter(d => d.playerId === playerId && !d.isBust);
  const totalPoints = playerDarts.reduce((sum, d) => sum + d.pointsScored, 0);

  const allPlayerDarts = game.dartHistory.filter(d => d.playerId === playerId);
  const roundsPlayed = Math.ceil(allPlayerDarts.length / 3) || 1;

  // Three-dart averages
  const rounds: number[] = [];
  for (let i = 0; i < allPlayerDarts.length; i += 3) {
    const roundDarts = allPlayerDarts.slice(i, i + 3);
    const roundTotal = roundDarts.reduce((sum, d) => sum + (d.isBust ? 0 : d.pointsScored), 0);
    rounds.push(roundTotal);
  }

  const highestRound = rounds.length > 0 ? Math.max(...rounds) : 0;
  const threeDartAvg = rounds.length > 0
    ? rounds.reduce((a, b) => a + b, 0) / rounds.length
    : 0;

  const ppd = allPlayerDarts.length > 0 ? totalPoints / allPlayerDarts.length : 0;

  return {
    totalDarts: allPlayerDarts.length,
    totalPoints,
    roundsPlayed,
    ppd: Math.round(ppd * 100) / 100,
    threeDartAvg: Math.round(threeDartAvg * 100) / 100,
    highestRound,
  };
}

export function getCurrentTurnTotal(game: X01Game): number {
  return game.currentTurnDarts
    .filter(d => !d.isBust)
    .reduce((sum, d) => sum + d.pointsScored, 0);
}
