export type CricketNumber = 20 | 19 | 18 | 17 | 16 | 15 | 'B';

export const CRICKET_NUMBERS: CricketNumber[] = [20, 19, 18, 17, 16, 15, 'B'];

export interface Player {
  id: string;
  name: string;
  teamId: string;
}

export interface Team {
  id: string;
  name: string;
  players: Player[];
  marks: Record<string, number>;
  points: number;
}

export interface DartEntry {
  id: string;
  playerId: string;
  teamId: string;
  target: CricketNumber | 'miss';
  multiplier: 1 | 2 | 3;
  marksApplied: number;
  pointsScored: number;
  timestamp: string;
}

export interface PlayerRef {
  playerId: string;
  teamId: string;
  teamIndex: number;
}

export interface Game {
  id: string;
  teams: [Team, Team];
  currentTurnIndex: number;
  turnOrder: PlayerRef[];
  dartHistory: DartEntry[];
  currentTurnDarts: DartEntry[];
  status: 'in_progress' | 'completed';
  winnerId?: string;
  createdAt: string;
}

export type Multiplier = 1 | 2 | 3;

export type AppScreen = 'home' | 'setup' | 'game' | 'post-game' | 'history';

export interface GameSummary {
  id: string;
  team1Name: string;
  team2Name: string;
  team1Players: string[];
  team2Players: string[];
  team1Score: number;
  team2Score: number;
  winnerName: string;
  winnerTeamIndex: 0 | 1;
  totalDarts: number;
  completedAt: string;
}
