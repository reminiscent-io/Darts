import { eq, desc } from "drizzle-orm";
import { db } from "./db";
import {
  games, gameSummaries, playerNames,
  type InsertGame, type SelectGame,
  type InsertGameSummary, type SelectGameSummary,
  type SelectPlayerName,
} from "@shared/schema";

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
}

export const storage = new DatabaseStorage();
