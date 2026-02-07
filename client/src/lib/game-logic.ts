import { Game, Team, Player, DartEntry, PlayerRef, CricketNumber, CRICKET_NUMBERS, Multiplier } from './types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

export function getNumberValue(target: CricketNumber): number {
  return target === 'B' ? 25 : target;
}

export function createGame(
  team1Name: string,
  team1Players: string[],
  team2Name: string,
  team2Players: string[],
  firstTeamIndex: number = 0
): Game {
  const team1Id = generateId();
  const team2Id = generateId();

  const team1: Team = {
    id: team1Id,
    name: team1Name || 'Team 1',
    players: team1Players.map((name, i) => ({
      id: generateId(),
      name: name || `Player ${i + 1}`,
      teamId: team1Id,
    })),
    marks: Object.fromEntries(CRICKET_NUMBERS.map(n => [String(n), 0])),
    points: 0,
  };

  const team2: Team = {
    id: team2Id,
    name: team2Name || 'Team 2',
    players: team2Players.map((name, i) => ({
      id: generateId(),
      name: name || `Player ${i + 1}`,
      teamId: team2Id,
    })),
    marks: Object.fromEntries(CRICKET_NUMBERS.map(n => [String(n), 0])),
    points: 0,
  };

  const teams: [Team, Team] = firstTeamIndex === 0 ? [team1, team2] : [team2, team1];
  const turnOrder = buildTurnOrder(teams);

  return {
    id: generateId(),
    teams,
    currentTurnIndex: 0,
    turnOrder,
    dartHistory: [],
    currentTurnDarts: [],
    status: 'in_progress',
    createdAt: new Date().toISOString(),
  };
}

function buildTurnOrder(teams: [Team, Team]): PlayerRef[] {
  const order: PlayerRef[] = [];
  const maxPlayers = Math.max(teams[0].players.length, teams[1].players.length);
  const totalRounds = maxPlayers;

  for (let round = 0; round < totalRounds; round++) {
    for (let teamIdx = 0; teamIdx < 2; teamIdx++) {
      const team = teams[teamIdx];
      const playerIdx = round % team.players.length;
      order.push({
        playerId: team.players[playerIdx].id,
        teamId: team.id,
        teamIndex: teamIdx,
      });
    }
  }

  return order;
}

export function getCurrentPlayer(game: Game): { player: Player; team: Team; teamIndex: number } {
  const ref = game.turnOrder[game.currentTurnIndex % game.turnOrder.length];
  const teamIndex = ref.teamIndex;
  const team = game.teams[teamIndex];
  const player = team.players.find(p => p.id === ref.playerId)!;
  return { player, team, teamIndex };
}

export function getNextPlayer(game: Game): { player: Player; team: Team; teamIndex: number } {
  const nextIndex = (game.currentTurnIndex + 1) % game.turnOrder.length;
  const ref = game.turnOrder[nextIndex];
  const teamIndex = ref.teamIndex;
  const team = game.teams[teamIndex];
  const player = team.players.find(p => p.id === ref.playerId)!;
  return { player, team, teamIndex };
}

export function recordDart(
  game: Game,
  target: CricketNumber | 'miss',
  multiplier: Multiplier
): { game: Game; dart: DartEntry; isWin: boolean } {
  const { player, team, teamIndex } = getCurrentPlayer(game);
  const opponentTeam = game.teams[1 - teamIndex];

  let marksApplied = 0;
  let pointsScored = 0;

  if (target !== 'miss') {
    const key = String(target);
    const currentMarks = team.marks[key] || 0;
    const opponentMarks = opponentTeam.marks[key] || 0;

    const hitsThisDart = multiplier;
    const marksNeededToClose = Math.max(0, 3 - currentMarks);
    const marksToAdd = Math.min(hitsThisDart, marksNeededToClose);
    const overflowHits = hitsThisDart - marksToAdd;

    marksApplied = marksToAdd;

    if (currentMarks + marksToAdd >= 3 && opponentMarks < 3 && overflowHits > 0) {
      pointsScored = overflowHits * getNumberValue(target);
    } else if (currentMarks >= 3 && opponentMarks < 3) {
      pointsScored = hitsThisDart * getNumberValue(target);
      marksApplied = 0;
    }
  }

  const dart: DartEntry = {
    id: generateId(),
    playerId: player.id,
    teamId: team.id,
    target,
    multiplier,
    marksApplied,
    pointsScored,
    timestamp: new Date().toISOString(),
  };

  const newTeams: [Team, Team] = [
    { ...game.teams[0] },
    { ...game.teams[1] },
  ];

  if (target !== 'miss') {
    const activeTeam = newTeams[teamIndex];
    const key = String(target);
    activeTeam.marks = { ...activeTeam.marks };
    activeTeam.marks[key] = (activeTeam.marks[key] || 0) + marksApplied;
    activeTeam.points = activeTeam.points + pointsScored;
  }

  const newCurrentTurnDarts = [...game.currentTurnDarts, dart];
  const newDartHistory = [...game.dartHistory, dart];

  const newGame: Game = {
    ...game,
    teams: newTeams,
    currentTurnDarts: newCurrentTurnDarts,
    dartHistory: newDartHistory,
  };

  const isWin = checkWinCondition(newGame, teamIndex);

  return { game: newGame, dart, isWin };
}

export function checkWinCondition(game: Game, teamIndex: number): boolean {
  const team = game.teams[teamIndex];
  const opponent = game.teams[1 - teamIndex];

  const allClosed = CRICKET_NUMBERS.every(n => (team.marks[String(n)] || 0) >= 3);
  if (!allClosed) return false;

  return team.points >= opponent.points;
}

export function advanceTurn(game: Game): Game {
  return {
    ...game,
    currentTurnIndex: (game.currentTurnIndex + 1) % game.turnOrder.length,
    currentTurnDarts: [],
  };
}

export function undoLastDart(game: Game): { game: Game; crossedTurnBoundary: boolean } {
  if (game.currentTurnDarts.length > 0) {
    const lastDart = game.currentTurnDarts[game.currentTurnDarts.length - 1];
    const revertedGame = revertDart(game, lastDart);
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

  const prevTurnIndex = (game.currentTurnIndex - 1 + game.turnOrder.length) % game.turnOrder.length;
  const prevRef = game.turnOrder[prevTurnIndex];

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

  const lastDart = prevTurnDarts[prevTurnDarts.length - 1];
  const revertedGame = revertDart(game, lastDart);

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

function revertDart(game: Game, dart: DartEntry): Game {
  const newTeams: [Team, Team] = [
    { ...game.teams[0] },
    { ...game.teams[1] },
  ];

  if (dart.target !== 'miss') {
    const teamIndex = newTeams.findIndex(t => t.id === dart.teamId);
    if (teamIndex >= 0) {
      const team = newTeams[teamIndex];
      const key = String(dart.target);
      team.marks = { ...team.marks };
      team.marks[key] = Math.max(0, (team.marks[key] || 0) - dart.marksApplied);
      team.points = Math.max(0, team.points - dart.pointsScored);
    }
  }

  return { ...game, teams: newTeams };
}

export function removeDartAtIndex(game: Game, dartIndex: number): Game {
  const dart = game.currentTurnDarts[dartIndex];
  if (!dart) return game;

  const revertedGame = revertDart(game, dart);

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

export function formatDart(dart: DartEntry): string {
  if (dart.target === 'miss') return 'Miss';
  if (dart.target === 'B') {
    return dart.multiplier === 2 ? 'DB' : 'SB';
  }
  const prefix = dart.multiplier === 3 ? 'T' : dart.multiplier === 2 ? 'D' : 'S';
  return `${prefix}${dart.target}`;
}

export function isNumberDead(game: Game, num: CricketNumber): boolean {
  const key = String(num);
  return (game.teams[0].marks[key] || 0) >= 3 && (game.teams[1].marks[key] || 0) >= 3;
}

export function isNumberClosedByTeam(team: Team, num: CricketNumber): boolean {
  return (team.marks[String(num)] || 0) >= 3;
}

export function getPlayerStats(game: Game, playerId: string) {
  const playerDarts = game.dartHistory.filter(d => d.playerId === playerId);
  const totalMarks = playerDarts.reduce((sum, d) => sum + d.marksApplied, 0);
  const pointsContributed = playerDarts.reduce((sum, d) => sum + d.pointsScored, 0);

  const roundsPlayed = Math.ceil(playerDarts.length / 3) || 1;
  const mpr = totalMarks / roundsPlayed;

  return {
    totalDarts: playerDarts.length,
    totalMarks,
    pointsContributed,
    roundsPlayed,
    mpr: Math.round(mpr * 100) / 100,
  };
}

export function confirmWin(game: Game, teamId: string): Game {
  return {
    ...game,
    status: 'completed',
    winnerId: teamId,
  };
}

export function saveGame(game: Game): void {
  localStorage.setItem('cricket-darts-game', JSON.stringify(game));
}

export function loadGame(): Game | null {
  const data = localStorage.getItem('cricket-darts-game');
  if (!data) return null;
  try {
    return JSON.parse(data) as Game;
  } catch {
    return null;
  }
}

export function clearSavedGame(): void {
  localStorage.removeItem('cricket-darts-game');
}
