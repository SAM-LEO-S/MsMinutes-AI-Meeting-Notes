CREATE TABLE "meetings" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"summary" text NOT NULL,
	"transcript" jsonb NOT NULL,
	"intelligence" jsonb NOT NULL
);
