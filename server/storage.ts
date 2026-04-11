import { eq, desc } from "drizzle-orm";
import { db } from "./db";
import {
  games, gameSummaries, playerNames, shots,
  type InsertGame, type SelectGame,
  type InsertGameSummary, type SelectGameSummary,
  type InsertShot, type SelectShot,
} from "@shared/schema";

type DartRow = {
  id: string;
  playerId: string;
  teamId: string;
  target: number | "B" | "miss";
  multiplier: 1 | 2 | 3;
  pointsScored: number;
  timestamp: string;
  marksApplied?: number;
  isBust?: boolean;
};

type GameStateForShots = {
  id: string;
  gameType: "x01" | "cricket";
  teams: Array<{
    id: string;
    name: string;
    players: Array<{ id: string; name: string }>;
  }>;
  dartHistory: DartRow[];
};

function extractShotRows(gameState: GameStateForShots): InsertShot[] {
  const playerById = new Map<string, { name: string; teamId: string }>();
  const teamNameById = new Map<string, string>();
  for (const team of gameState.teams ?? []) {
    teamNameById.set(team.id, team.name);
    for (const p of team.players ?? []) {
      playerById.set(p.id, { name: p.name, teamId: team.id });
    }
  }
  const history = gameState.dartHistory ?? [];
  const rows: InsertShot[] = [];
  for (let i = 0; i < history.length; i++) {
    const d = history[i];
    const p = playerById.get(d.playerId);
    if (!p) continue;
    const teamName = teamNameById.get(p.teamId) ?? "";
    rows.push({
      gameId: gameState.id,
      dartSeq: i,
      playerName: p.name,
      teamName,
      gameMode: gameState.gameType,
      target: String(d.target),
      multiplier: d.multiplier,
      pointsScored: d.pointsScored,
      marksApplied: d.marksApplied ?? null,
      isBust: d.isBust ?? null,
      thrownAt: new Date(d.timestamp),
    });
  }
  return rows;
}

export interface IStorage {
  getGame(id: string): Promise<SelectGame | undefined>;
  getActiveGame(): Promise<SelectGame | undefined>;
  upsertGame(game: InsertGame): Promise<SelectGame>;
  deleteGame(id: string): Promise<void>;

  getGameSummaries(limit?: number): Promise<SelectGameSummary[]>;
  createGameSummary(summary: InsertGameSummary): Promise<SelectGameSummary>;
  clearGameSummaries(): Promise<void>;

  getPlayerNames(): Promise<string[]>;
  addPlayerNames(names: string[]): Promise<void>;

  persistShotsFromGameState(gameState: unknown): Promise<void>;
  getShotsForPlayer(playerName: string, limit?: number): Promise<SelectShot[]>;
}

export class DatabaseStorage implements IStorage {
  async getGame(id: string): Promise<SelectGame | undefined> {
    const [row] = await db.select().from(games).where(eq(games.id, id));
    return row;
  }

  async getActiveGame(): Promise<SelectGame | undefined> {
    const [row] = await db
      .select()
      .from(games)
      .where(eq(games.status, "in_progress"))
      .orderBy(desc(games.updatedAt))
      .limit(1);
    return row;
  }

  async upsertGame(game: InsertGame): Promise<SelectGame> {
    const [row] = await db
      .insert(games)
      .values({ ...game, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: games.id,
        set: {
          status: game.status,
          gameState: game.gameState,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async deleteGame(id: string): Promise<void> {
    await db.delete(games).where(eq(games.id, id));
  }

  async getGameSummaries(limit = 50): Promise<SelectGameSummary[]> {
    return db
      .select()
      .from(gameSummaries)
      .orderBy(desc(gameSummaries.completedAt))
      .limit(limit);
  }

  async createGameSummary(summary: InsertGameSummary): Promise<SelectGameSummary> {
    const [row] = await db
      .insert(gameSummaries)
      .values(summary)
      .onConflictDoUpdate({
        target: gameSummaries.id,
        set: summary,
      })
      .returning();
    return row;
  }

  async clearGameSummaries(): Promise<void> {
    await db.delete(gameSummaries);
  }

  async getPlayerNames(): Promise<string[]> {
    const rows = await db.select().from(playerNames);
    return rows.map((r: { name: string }) => r.name).sort();
  }

  async addPlayerNames(names: string[]): Promise<void> {
    const cleaned = names
      .map((n) => n.trim())
      .filter((n) => n && !/^Player \d+$/.test(n));
    const unique = Array.from(new Set(cleaned));
    if (unique.length === 0) return;
    await db
      .insert(playerNames)
      .values(unique.map((name) => ({ name })))
      .onConflictDoNothing();
  }

  async persistShotsFromGameState(gameState: unknown): Promise<void> {
    if (!gameState || typeof gameState !== "object") return;
    const rows = extractShotRows(gameState as GameStateForShots);
    if (rows.length === 0) return;
    await db.insert(shots).values(rows).onConflictDoNothing({
      target: [shots.gameId, shots.dartSeq],
    });
  }

  async getShotsForPlayer(playerName: string, limit = 500): Promise<SelectShot[]> {
    return db
      .select()
      .from(shots)
      .where(eq(shots.playerName, playerName))
      .orderBy(desc(shots.thrownAt))
      .limit(limit);
  }
}

export const storage = new DatabaseStorage();
