ALTER TABLE "game_summaries" ALTER COLUMN "team1_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "game_summaries" ALTER COLUMN "team2_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "game_summaries" ALTER COLUMN "team1_players" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "game_summaries" ALTER COLUMN "team2_players" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "game_summaries" ALTER COLUMN "team1_score" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "game_summaries" ALTER COLUMN "team2_score" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "game_summaries" ALTER COLUMN "winner_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "game_summaries" ALTER COLUMN "winner_team_index" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "game_summaries" ADD COLUMN "game_type" text;--> statement-breakpoint
ALTER TABLE "game_summaries" ADD COLUMN "teams" jsonb;--> statement-breakpoint
ALTER TABLE "game_summaries" ADD COLUMN "starting_score" integer;