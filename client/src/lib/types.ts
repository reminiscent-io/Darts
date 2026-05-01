// --- Game Type ---
export type GameType = 'cricket' | 'x01';

// --- Shared ---
export type Multiplier = 1 | 2 | 3;

export interface Player {
  id: string;
  name: string;
  teamId: string;
}

export interface PlayerRef {
  playerId: string;
  teamId: string;
  teamIndex: number;
}

export type AppScreen = 'home' | 'setup' | 'game' | 'post-game' | 'history';

// --- DartEntry (unified, game-specific fields optional) ---
export interface DartEntry {
  id: string;
  playerId: string;
  teamId: string;
  target: number | 'B' | 'miss'; // 1-20 for X01, 15-20 for Cricket, 'B', or 'miss'
  multiplier: Multiplier;
  pointsScored: number;
  timestamp: string;
  // Cricket only
  marksApplied?: number;
  // X01 only
  isBust?: boolean;
}

// --- Cricket ---
export type CricketNumber = 20 | 19 | 18 | 17 | 16 | 15 | 'B';
export const CRICKET_NUMBERS: CricketNumber[] = [20, 19, 18, 17, 16, 15, 'B'];

export interface CricketTeam {
  id: string;
  name: string;
  players: Player[];
  marks: Record<string, number>;
  points: number;
}

export interface CricketGame {
  gameType: 'cricket';
  id: string;
  mode: 'team' | 'solo';
  teams: CricketTeam[];
  currentTurnIndex: number;
  turnOrder: PlayerRef[];
  dartHistory: DartEntry[];
  currentTurnDarts: DartEntry[];
  status: 'in_progress' | 'completed';
  winnerId?: string;
  createdAt: string;
}

// --- X01 ---
export interface X01Team {
  id: string;
  name: string;
  players: Player[];
  remainingScore: number;
}

export interface X01Game {
  gameType: 'x01';
  id: string;
  startingScore: number;
  doubleOut: boolean;
  mode: 'team' | 'individual';
  teams: X01Team[];
  currentTurnIndex: number;
  turnOrder: PlayerRef[];
  dartHistory: DartEntry[];
  currentTurnDarts: DartEntry[];
  status: 'in_progress' | 'completed';
  winnerId?: string;
  createdAt: string;
}

// --- Discriminated Union ---
export type Game = CricketGame | X01Game;

// --- Game Summary (for history) ---
export interface GameSummary {
  id: string;
  gameType: GameType;
  teams: Array<{
    name: string;
    players: string[];
    score: number;
    isWinner: boolean;
  }>;
  totalDarts: number;
  completedAt: string;
  startingScore?: number; // X01 only
}
