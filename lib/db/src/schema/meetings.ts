import { integer, jsonb, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

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
  title: varchar("title", { length: 160 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  summary: text("summary").notNull(),
  transcript: jsonb("transcript").$type<TranscriptSegment[]>().notNull(),
  intelligence: jsonb("intelligence").$type<MeetingIntelligence>().notNull(),
});

export type Meeting = typeof meetingsTable.$inferSelect;
export type InsertMeeting = typeof meetingsTable.$inferInsert;
