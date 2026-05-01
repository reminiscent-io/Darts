import { Game, GameSummary, CricketGame, CricketTeam, Player, DartEntry, PlayerRef, CricketNumber, CRICKET_NUMBERS, Multiplier } from './types';

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

export function getNumberValue(target: CricketNumber): number {
  return target === 'B' ? 25 : target;
}

export function createCricketGame(
  team1Name: string,
  team1Players: string[],
  team2Name: string,
  team2Players: string[],
  firstTeamIndex: number = 0
): CricketGame {
  const team1Id = generateId();
  const team2Id = generateId();

  const team1: CricketTeam = {
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

  const team2: CricketTeam = {
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

  const teams: CricketTeam[] = firstTeamIndex === 0 ? [team1, team2] : [team2, team1];
  const turnOrder = buildTurnOrder(teams);

  return {
    gameType: 'cricket',
    id: generateId(),
    mode: 'team',
    teams,
    currentTurnIndex: 0,
    turnOrder,
    dartHistory: [],
    currentTurnDarts: [],
    status: 'in_progress',
    createdAt: new Date().toISOString(),
  };
}

export function createSoloCricketGame(playerName: string): CricketGame {
  const teamId = generateId();
  const team: CricketTeam = {
    id: teamId,
    name: playerName.trim() || 'Player 1',
    players: [{
      id: generateId(),
      name: playerName.trim() || 'Player 1',
      teamId,
    }],
    marks: Object.fromEntries(CRICKET_NUMBERS.map(n => [String(n), 0])),
    points: 0,
  };

  return {
    gameType: 'cricket',
    id: generateId(),
    mode: 'solo',
    teams: [team],
    currentTurnIndex: 0,
    turnOrder: buildTurnOrder([team]),
    dartHistory: [],
    currentTurnDarts: [],
    status: 'in_progress',
    createdAt: new Date().toISOString(),
  };
}

export function buildTurnOrder(teams: Array<{ id: string; players: Player[] }>): PlayerRef[] {
  const order: PlayerRef[] = [];
  const maxPlayers = Math.max(...teams.map(t => t.players.length));
  const totalRounds = maxPlayers;

  for (let round = 0; round < totalRounds; round++) {
    for (let teamIdx = 0; teamIdx < teams.length; teamIdx++) {
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

export function getCurrentPlayer(game: Game): { player: Player; teamIndex: number } {
  const ref = game.turnOrder[game.currentTurnIndex % game.turnOrder.length];
  const teamIndex = ref.teamIndex;
  const team = game.teams[teamIndex];
  const player = team.players.find(p => p.id === ref.playerId)!;
  return { player, teamIndex };
}

export function getNextPlayer(game: Game): { player: Player; teamIndex: number } {
  const nextIndex = (game.currentTurnIndex + 1) % game.turnOrder.length;
  const ref = game.turnOrder[nextIndex];
  const teamIndex = ref.teamIndex;
  const team = game.teams[teamIndex];
  const player = team.players.find(p => p.id === ref.playerId)!;
  return { player, teamIndex };
}

// --- Cricket-specific logic ---

export function recordCricketDart(
  game: CricketGame,
  target: CricketNumber | 'miss',
  multiplier: Multiplier
): { game: CricketGame; dart: DartEntry; isWin: boolean } {
  const { player, teamIndex } = getCurrentPlayer(game);
  const team = game.teams[teamIndex];
  const opponentTeam = game.teams[1 - teamIndex];

  let marksApplied = 0;
  let pointsScored = 0;

  if (target !== 'miss') {
    const key = String(target);
    const currentMarks = team.marks[key] || 0;
    const opponentMarks = opponentTeam ? (opponentTeam.marks[key] || 0) : 0;

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

  const newTeams: CricketTeam[] = game.teams.map(t => ({ ...t }));

  if (target !== 'miss') {
    const activeTeam = newTeams[teamIndex];
    const key = String(target);
    activeTeam.marks = { ...activeTeam.marks };
    activeTeam.marks[key] = (activeTeam.marks[key] || 0) + marksApplied;
    activeTeam.points = activeTeam.points + pointsScored;
  }

  const newCurrentTurnDarts = [...game.currentTurnDarts, dart];
  const newDartHistory = [...game.dartHistory, dart];

  const newGame: CricketGame = {
    ...game,
    teams: newTeams,
    currentTurnDarts: newCurrentTurnDarts,
    dartHistory: newDartHistory,
  };

  const isWin = checkCricketWinCondition(newGame, teamIndex);

  return { game: newGame, dart, isWin };
}

export function checkCricketWinCondition(game: CricketGame, teamIndex: number): boolean {
  const team = game.teams[teamIndex];
  const opponent = game.teams[1 - teamIndex];

  const allClosed = CRICKET_NUMBERS.every(n => (team.marks[String(n)] || 0) >= 3);
  if (!allClosed) return false;

  if (!opponent) return true;

  return team.points >= opponent.points;
}

export function advanceTurn(game: Game): Game {
  return {
    ...game,
    currentTurnIndex: (game.currentTurnIndex + 1) % game.turnOrder.length,
    currentTurnDarts: [],
  } as Game;
}

export function undoLastCricketDart(game: CricketGame): { game: CricketGame; crossedTurnBoundary: boolean } {
  if (game.currentTurnDarts.length > 0) {
    const lastDart = game.currentTurnDarts[game.currentTurnDarts.length - 1];
    const revertedGame = revertCricketDart(game, lastDart);
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
  const revertedGame = revertCricketDart(game, lastDart);

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

function revertCricketDart(game: CricketGame, dart: DartEntry): CricketGame {
  const newTeams: CricketTeam[] = game.teams.map(t => ({ ...t }));

  if (dart.target !== 'miss') {
    const teamIndex = newTeams.findIndex(t => t.id === dart.teamId);
    if (teamIndex >= 0) {
      const team = newTeams[teamIndex];
      const key = String(dart.target);
      team.marks = { ...team.marks };
      team.marks[key] = Math.max(0, (team.marks[key] || 0) - (dart.marksApplied || 0));
      team.points = Math.max(0, team.points - dart.pointsScored);
    }
  }

  return { ...game, teams: newTeams };
}

export function removeCricketDartAtIndex(game: CricketGame, dartIndex: number): CricketGame {
  const dart = game.currentTurnDarts[dartIndex];
  if (!dart) return game;

  const revertedGame = revertCricketDart(game, dart);

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

export function isNumberDead(game: CricketGame, num: CricketNumber): boolean {
  const key = String(num);
  if (game.teams.length < 2) return false;
  return (game.teams[0].marks[key] || 0) >= 3 && (game.teams[1].marks[key] || 0) >= 3;
}

export function isNumberClosedByTeam(team: CricketTeam, num: CricketNumber): boolean {
  return (team.marks[String(num)] || 0) >= 3;
}

export function getCricketPlayerStats(game: CricketGame, playerId: string) {
  const playerDarts = game.dartHistory.filter(d => d.playerId === playerId);
  const totalMarks = playerDarts.reduce((sum, d) => sum + (d.marksApplied || 0), 0);
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
  } as Game;
}

export function renameTeam(game: Game, teamId: string, name: string): Game {
  const newTeams = game.teams.map(t =>
    t.id === teamId ? { ...t, name } : t
  );
  return { ...game, teams: newTeams } as Game;
}

export function renamePlayer(game: Game, playerId: string, name: string): Game {
  const newTeams = game.teams.map(t => {
    const playerIdx = t.players.findIndex(p => p.id === playerId);
    if (playerIdx === -1) return t;
    const newPlayers = t.players.map((p, i) =>
      i === playerIdx ? { ...p, name } : p
    );
    // Solo cricket convention: team.name mirrors the single player's name.
    const isSoloTeam = t.players.length === 1 && t.name === t.players[0].name;
    return {
      ...t,
      players: newPlayers,
      ...(isSoloTeam ? { name } : {}),
    };
  });
  return { ...game, teams: newTeams } as Game;
}

export function reorderUpcomingTurns(game: Game, newUpcoming: PlayerRef[]): Game {
  const len = game.turnOrder.length;
  if (newUpcoming.length !== len - 1) return game;

  const newTurnOrder = [...game.turnOrder];
  for (let i = 0; i < newUpcoming.length; i++) {
    const pos = (game.currentTurnIndex + 1 + i) % len;
    newTurnOrder[pos] = newUpcoming[i];
  }
  return { ...game, turnOrder: newTurnOrder } as Game;
}

// --- Storage ---

const MAX_HISTORY = 50;

const STORAGE_KEYS = {
  game: 'darts-game',
  history: 'darts-history',
  players: 'darts-players',
};

const OLD_STORAGE_KEYS = {
  game: 'cricket-darts-game',
  history: 'cricket-darts-history',
  players: 'cricket-darts-players',
};

export function migrateStorage(): void {
  // Migrate saved game
  const oldGame = localStorage.getItem(OLD_STORAGE_KEYS.game);
  if (oldGame && !localStorage.getItem(STORAGE_KEYS.game)) {
    try {
      const parsed = JSON.parse(oldGame);
      parsed.gameType = 'cricket';
      localStorage.setItem(STORAGE_KEYS.game, JSON.stringify(parsed));
      localStorage.removeItem(OLD_STORAGE_KEYS.game);
    } catch { /* ignore */ }
  }

  // Migrate history
  const oldHistory = localStorage.getItem(OLD_STORAGE_KEYS.history);
  if (oldHistory && !localStorage.getItem(STORAGE_KEYS.history)) {
    try {
      const parsed = JSON.parse(oldHistory) as Array<Record<string, unknown>>;
      const migrated: GameSummary[] = parsed.map(old => ({
        id: (old.id as string) || generateId(),
        gameType: 'cricket' as const,
        teams: [
          {
            name: (old.team1Name as string) || 'Team 1',
            players: (old.team1Players as string[]) || [],
            score: (old.team1Score as number) || 0,
            isWinner: (old.winnerTeamIndex as number) === 0,
          },
          {
            name: (old.team2Name as string) || 'Team 2',
            players: (old.team2Players as string[]) || [],
            score: (old.team2Score as number) || 0,
            isWinner: (old.winnerTeamIndex as number) === 1,
          },
        ],
        totalDarts: (old.totalDarts as number) || 0,
        completedAt: (old.completedAt as string) || new Date().toISOString(),
      }));
      localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(migrated));
      localStorage.removeItem(OLD_STORAGE_KEYS.history);
    } catch { /* ignore */ }
  }

  // Migrate players
  const oldPlayers = localStorage.getItem(OLD_STORAGE_KEYS.players);
  if (oldPlayers && !localStorage.getItem(STORAGE_KEYS.players)) {
    localStorage.setItem(STORAGE_KEYS.players, oldPlayers);
    localStorage.removeItem(OLD_STORAGE_KEYS.players);
  }
}

export function saveGame(game: Game): void {
  localStorage.setItem(STORAGE_KEYS.game, JSON.stringify(game));
  saveGameToDb(game).catch(() => {});
}

async function saveGameToDb(game: Game): Promise<void> {
  try {
    await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: game.id, status: game.status, gameState: game }),
    });
  } catch {}
}

export function loadGame(): Game | null {
  const data = localStorage.getItem(STORAGE_KEYS.game);
  if (!data) return null;
  try {
    const parsed = JSON.parse(data) as Game;
    // Ensure gameType exists (fallback for old data)
    if (!parsed.gameType) {
      (parsed as Record<string, unknown>).gameType = 'cricket';
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function loadGameFromDb(): Promise<Game | null> {
  try {
    const res = await fetch('/api/games/active');
    if (!res.ok) return null;
    const data = await res.json();
    if (!data) return null;
    localStorage.setItem(STORAGE_KEYS.game, JSON.stringify(data));
    return data as Game;
  } catch {
    return null;
  }
}

export async function loadGameById(gameId: string): Promise<Game | null> {
  try {
    const res = await fetch(`/api/games/${gameId}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data) return null;
    return data as Game;
  } catch {
    return null;
  }
}

export function clearSavedGame(): void {
  const game = loadGame();
  localStorage.removeItem(STORAGE_KEYS.game);
  if (game) {
    fetch(`/api/games/${game.id}`, { method: 'DELETE' }).catch(() => {});
  }
}

// --- Game History ---

export function saveGameToHistory(game: Game): void {
  const winnerIndex = game.teams.findIndex(t => t.id === game.winnerId);

  const summary: GameSummary = {
    id: game.id,
    gameType: game.gameType,
    teams: game.teams.map((t, idx) => ({
      name: t.name,
      players: t.players.map(p => p.name),
      score: game.gameType === 'cricket'
        ? (t as CricketTeam).points
        : (game as { startingScore: number }).startingScore - (t as { remainingScore: number }).remainingScore,
      isWinner: idx === winnerIndex,
    })),
    totalDarts: game.dartHistory.length,
    completedAt: new Date().toISOString(),
    ...(game.gameType === 'x01' ? { startingScore: (game as { startingScore: number }).startingScore } : {}),
  };

  const history = loadGameHistory();
  history.unshift(summary);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
  fetch('/api/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(summary),
  }).catch(() => {});
}

export function loadGameHistory(): GameSummary[] {
  const data = localStorage.getItem(STORAGE_KEYS.history);
  if (!data) return [];
  try {
    return JSON.parse(data) as GameSummary[];
  } catch {
    return [];
  }
}

export async function loadGameHistoryFromDb(): Promise<GameSummary[]> {
  try {
    const res = await fetch('/api/history');
    if (!res.ok) return [];
    const data = await res.json();
    const summaries = (data as GameSummary[]).map((s: GameSummary) => ({
      ...s,
      completedAt: typeof s.completedAt === 'string' ? s.completedAt : new Date(s.completedAt).toISOString(),
    }));
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(summaries));
    return summaries;
  } catch {
    return loadGameHistory();
  }
}

export function clearGameHistory(): void {
  localStorage.removeItem(STORAGE_KEYS.history);
  fetch('/api/history', { method: 'DELETE' }).catch(() => {});
}

// --- Player Name Memory ---

export function savePlayerNames(names: string[]): void {
  const existing = loadPlayerNames();
  const merged = new Set(existing);
  for (const name of names) {
    const trimmed = name.trim();
    if (trimmed && !/^Player \d+$/.test(trimmed)) {
      merged.add(trimmed);
    }
  }
  localStorage.setItem(STORAGE_KEYS.players, JSON.stringify(Array.from(merged).sort((a, b) => a.localeCompare(b))));
  fetch('/api/players', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ names }),
  }).catch(() => {});
}

export function loadPlayerNames(): string[] {
  const data = localStorage.getItem(STORAGE_KEYS.players);
  if (!data) return [];
  try {
    return JSON.parse(data) as string[];
  } catch {
    return [];
  }
}

export async function loadPlayerNamesFromDb(): Promise<string[]> {
  try {
    const res = await fetch('/api/players');
    if (!res.ok) return [];
    const names = await res.json() as string[];
    localStorage.setItem(STORAGE_KEYS.players, JSON.stringify(names));
    return names;
  } catch {
    return loadPlayerNames();
  }
}
