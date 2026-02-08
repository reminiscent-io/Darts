import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const games = pgTable("games", {
  id: varchar("id", { length: 64 }).primaryKey(),
  status: text("status").notNull().default("in_progress"),
  gameState: jsonb("game_state").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const gameSummaries = pgTable("game_summaries", {
  id: varchar("id", { length: 64 }).primaryKey(),
  team1Name: text("team1_name").notNull(),
  team2Name: text("team2_name").notNull(),
  team1Players: jsonb("team1_players").notNull().$type<string[]>(),
  team2Players: jsonb("team2_players").notNull().$type<string[]>(),
  team1Score: integer("team1_score").notNull().default(0),
  team2Score: integer("team2_score").notNull().default(0),
  winnerName: text("winner_name").notNull(),
  winnerTeamIndex: integer("winner_team_index").notNull(),
  totalDarts: integer("total_darts").notNull().default(0),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
});

export const playerNames = pgTable("player_names", {
  id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
});

export const insertGameSchema = createInsertSchema(games).omit({ createdAt: true, updatedAt: true });
export const insertGameSummarySchema = createInsertSchema(gameSummaries).omit({ completedAt: true });
export const insertPlayerNameSchema = createInsertSchema(playerNames).omit({ id: true });

export type InsertGame = z.infer<typeof insertGameSchema>;
export type SelectGame = typeof games.$inferSelect;
export type InsertGameSummary = z.infer<typeof insertGameSummarySchema>;
export type SelectGameSummary = typeof gameSummaries.$inferSelect;
export type InsertPlayerName = z.infer<typeof insertPlayerNameSchema>;
export type SelectPlayerName = typeof playerNames.$inferSelect;
