import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, timestamp, boolean, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export interface GameSummaryTeam {
  name: string;
  players: string[];
  score: number;
  isWinner: boolean;
}

/** The completed-game record exchanged over `/api/history`. */
export interface GameSummaryRecord {
  id: string;
  gameType: "cricket" | "x01";
  teams: GameSummaryTeam[];
  totalDarts: number;
  completedAt: string;
  startingScore?: number;
}

export const gameSummaryTeamSchema = z.object({
  name: z.string(),
  players: z.array(z.string()),
  score: z.number(),
  isWinner: z.boolean(),
});

export const gameSummaryRecordSchema = z.object({
  id: z.string().min(1).max(64),
  gameType: z.enum(["cricket", "x01"]),
  teams: z.array(gameSummaryTeamSchema).min(1),
  totalDarts: z.number().int().nonnegative(),
  completedAt: z.string(),
  startingScore: z.number().int().positive().optional(),
});

export const games = pgTable("games", {
  id: varchar("id", { length: 64 }).primaryKey(),
  status: text("status").notNull().default("in_progress"),
  gameState: jsonb("game_state").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// A completed game, as the client records it: any number of teams, either game
// type. `teams` is the canonical shape; the team1/team2 columns below predate
// X01 and multi-team games and are kept (nullable, best-effort) so rows written
// by older builds still read back.
export const gameSummaries = pgTable("game_summaries", {
  id: varchar("id", { length: 64 }).primaryKey(),
  gameType: text("game_type"),
  teams: jsonb("teams").$type<GameSummaryTeam[]>(),
  startingScore: integer("starting_score"),
  team1Name: text("team1_name"),
  team2Name: text("team2_name"),
  team1Players: jsonb("team1_players").$type<string[]>(),
  team2Players: jsonb("team2_players").$type<string[]>(),
  team1Score: integer("team1_score").default(0),
  team2Score: integer("team2_score").default(0),
  winnerName: text("winner_name"),
  winnerTeamIndex: integer("winner_team_index"),
  totalDarts: integer("total_darts").notNull().default(0),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
});

export const playerNames = pgTable("player_names", {
  id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
});

export const shots = pgTable(
  "shots",
  {
    id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()`),
    gameId: varchar("game_id", { length: 64 }).notNull(),
    dartSeq: integer("dart_seq").notNull(),
    playerName: text("player_name").notNull(),
    teamName: text("team_name").notNull(),
    gameMode: text("game_mode").notNull(),
    target: text("target").notNull(),
    multiplier: integer("multiplier").notNull(),
    pointsScored: integer("points_scored").notNull(),
    marksApplied: integer("marks_applied"),
    isBust: boolean("is_bust"),
    thrownAt: timestamp("thrown_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("shots_game_seq_idx").on(t.gameId, t.dartSeq),
    index("shots_player_name_idx").on(t.playerName, t.thrownAt),
  ],
);

export const insertGameSchema = createInsertSchema(games).omit({ createdAt: true, updatedAt: true });
export const insertGameSummarySchema = createInsertSchema(gameSummaries).omit({ completedAt: true });
export const insertPlayerNameSchema = createInsertSchema(playerNames).omit({ id: true });
export const insertShotSchema = createInsertSchema(shots).omit({ id: true });

export type InsertGame = z.infer<typeof insertGameSchema>;
export type SelectGame = typeof games.$inferSelect;
export type InsertGameSummary = z.infer<typeof insertGameSummarySchema>;
export type SelectGameSummary = typeof gameSummaries.$inferSelect;
export type InsertPlayerName = z.infer<typeof insertPlayerNameSchema>;
export type SelectPlayerName = typeof playerNames.$inferSelect;
export type InsertShot = z.infer<typeof insertShotSchema>;
export type SelectShot = typeof shots.$inferSelect;
