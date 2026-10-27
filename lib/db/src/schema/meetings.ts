import { integer, jsonb, pgPolicy, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export type TranscriptSegment = {
  speaker: string;
  startTime: number;
  endTime: number;
  originalText: string;
  translatedText: string;
  language: "ta" | "en" | "mixed";
  confidence: number;
};

export type MeetingDecision = {
  decision: string;
  speaker: string | null;
  context: string;
  confidence: number;
};

export type MeetingActionItem = {
  action: string;
  assignee: string | null;
  deadline: string | null;
  priority: "high" | "medium" | "low";
  confidence: number;
};

export type MeetingRisk = {
  risk: string;
  speaker: string | null;
  severity: "high" | "medium" | "low";
  confidence: number;
};

export type MeetingQuestion = {
  question: string;
  speaker: string | null;
  answered: boolean;
  answerSummary: string | null;
  confidence: number;
};

export type MeetingIntelligence = {
  summary: string;
  decisions: MeetingDecision[];
  actionItems: MeetingActionItem[];
  risks: MeetingRisk[];
  questions: MeetingQuestion[];
};

export const meetingsTable = pgTable("meetings", {
  id: serial("id").primaryKey(),
  // Nullable only to preserve existing meetings during the auth rollout.
  // New API-created meetings always receive the verified Supabase user ID.
  userId: varchar("user_id", { length: 255 }),
  title: varchar("title", { length: 160 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  summary: text("summary").notNull(),
  transcript: jsonb("transcript").$type<TranscriptSegment[]>().notNull(),
  intelligence: jsonb("intelligence").$type<MeetingIntelligence>().notNull(),
  audioUrl: text("audio_url"),
}, (table) => [
  pgPolicy("meetings_select_own", {
    for: "select",
    to: "authenticated",
    using: sql`(select auth.uid())::text = ${table.userId}`,
  }),
  pgPolicy("meetings_insert_own", {
    for: "insert",
    to: "authenticated",
    withCheck: sql`(select auth.uid())::text = ${table.userId}`,
  }),
  pgPolicy("meetings_update_own", {
    for: "update",
    to: "authenticated",
    using: sql`(select auth.uid())::text = ${table.userId}`,
    withCheck: sql`(select auth.uid())::text = ${table.userId}`,
  }),
  pgPolicy("meetings_delete_own", {
    for: "delete",
    to: "authenticated",
    using: sql`(select auth.uid())::text = ${table.userId}`,
  }),
]).enableRLS();

export type Meeting = typeof meetingsTable.$inferSelect;
export type InsertMeeting = typeof meetingsTable.$inferInsert;
