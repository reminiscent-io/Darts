CREATE TABLE "game_summaries" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"team1_name" text NOT NULL,
	"team2_name" text NOT NULL,
	"team1_players" jsonb NOT NULL,
	"team2_players" jsonb NOT NULL,
	"team1_score" integer DEFAULT 0 NOT NULL,
	"team2_score" integer DEFAULT 0 NOT NULL,
	"winner_name" text NOT NULL,
	"winner_team_index" integer NOT NULL,
	"total_darts" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"game_state" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_names" (
	"id" varchar(64) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "player_names_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "shots" (
	"id" varchar(64) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" varchar(64) NOT NULL,
	"dart_seq" integer NOT NULL,
	"player_name" text NOT NULL,
	"team_name" text NOT NULL,
	"game_mode" text NOT NULL,
	"target" text NOT NULL,
	"multiplier" integer NOT NULL,
	"points_scored" integer NOT NULL,
	"marks_applied" integer,
	"is_bust" boolean,
	"thrown_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "shots_game_seq_idx" ON "shots" USING btree ("game_id","dart_seq");--> statement-breakpoint
CREATE INDEX "shots_player_name_idx" ON "shots" USING btree ("player_name","thrown_at");