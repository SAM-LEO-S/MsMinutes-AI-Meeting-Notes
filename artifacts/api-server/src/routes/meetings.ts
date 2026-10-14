import {
  Router,
  type IRouter,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import multer from "multer";
import { desc, eq, ilike, or } from "drizzle-orm";
import { db, meetingsTable } from "@workspace/db";
import {
  CreateMeetingBody,
  CreateMeetingResponse,
  DeleteMeetingParams,
  ExportMeetingDocxParams,
  ExportMeetingPdfParams,
  GetDashboardResponse,
  GetMeetingParams,
  GetMeetingResponse,
  ListMeetingsQueryParams,
  ListMeetingsResponse,
  ListMeetingsResponseItem,
  ProcessMeetingBody,
  UpdateMeetingBody,
  UpdateMeetingParams,
  UpdateMeetingResponse,
} from "@workspace/api-zod";
import { extname } from "node:path";
import {
  analyzeMeetingAudio,
  type MeetingProgress,
} from "../lib/gemini-meetings";
import { createMeetingDocx, createMeetingPdf } from "../lib/meeting-documents";

const router: IRouter = Router();
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const confidenceReviewThreshold = 0.6;

const allowedAudioTypes = new Set([
  "audio/aac",
  "audio/flac",
  "audio/mp4",
  "audio/m4a",
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/opus",
  "audio/wav",
  "audio/webm",
  "audio/x-flac",
  "audio/x-m4a",
  "audio/x-wav",
]);

const allowedAudioExtensions = /\.(aac|flac|m4a|mp3|oga|ogg|opus|wav|webm)$/i;
const mimeByExtension: Record<string, string> = {
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".oga": "audio/ogg",
  ".ogg": "audio/ogg",
  ".opus": "audio/opus",
  ".wav": "audio/wav",
  ".webm": "audio/webm",
};
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (allowedAudioTypes.has(file.mimetype.toLowerCase()) || allowedAudioExtensions.test(file.originalname)) {
      callback(null, true);
      return;
    }
    callback(new Error("Choose an MP3, WAV, M4A, AAC, OGG, FLAC, or WebM audio file."));
  },
});

type MeetingRow = typeof meetingsTable.$inferSelect;
type SseEvent = MeetingProgress & {
  error?: string;
  meeting?: { id: number };
};

function meetingResponse(row: MeetingRow) {
  return GetMeetingResponse.parse({
    id: row.id,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    durationSeconds: row.durationSeconds,
    summary: row.summary,
    transcript: row.transcript,
    intelligence: row.intelligence,
  });
}

function needsReview(row: MeetingRow): boolean {
  const transcriptNeedsReview = row.transcript.some(
    (segment) => segment.confidence < confidenceReviewThreshold,
  );
  const intelligenceItems = [
    ...row.intelligence.decisions,
    ...row.intelligence.actionItems,
    ...row.intelligence.risks,
    ...row.intelligence.questions,
  ];
  return transcriptNeedsReview || intelligenceItems.some(
    (item) => item.confidence < confidenceReviewThreshold,
  );
}

function summaryResponse(row: MeetingRow) {
  const distinctSpeakers = new Set(row.transcript.map((segment) => segment.speaker));
  return ListMeetingsResponseItem.parse({
    id: row.id,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    durationSeconds: row.durationSeconds,
    summary: row.summary,
    speakerCount: distinctSpeakers.size,
    actionItemCount: row.intelligence.actionItems.length,
    decisionCount: row.intelligence.decisions.length,
    needsReview: needsReview(row),
  });
}

function parseMeetingId(params: unknown, schema: typeof GetMeetingParams | typeof UpdateMeetingParams | typeof DeleteMeetingParams | typeof ExportMeetingPdfParams | typeof ExportMeetingDocxParams) {
  return schema.safeParse(params);
}

function attachAudio(req: Request, res: Response, next: NextFunction): void {
  upload.single("audio")(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "Audio files must be 50 MB or smaller." });
      return;
    }
    const message = error instanceof Error
      ? error.message
      : "Choose a supported audio file.";
    res.status(400).json({ error: message });
  });
}

function sendProgress(
  res: Response,
  progress: SseEvent,
): void {
  if (!res.destroyed && !res.writableEnded) {
    res.write(`data: ${JSON.stringify(progress)}\n\n`);
  }
}

function friendlyProcessingError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("Gemini is not configured")) {
    return message;
  }
  if (/quota|rate.?limit/i.test(message)) {
    return "Gemini is busy or the API quota has been reached. Wait a moment, then try again.";
  }
  if (/api.?key|unauthoriz|permission|forbidden/i.test(message)) {
    return "Gemini could not authorize the request. Check the Gemini API key and API access in project secrets.";
  }
  if (message.startsWith("Gemini ") || message.startsWith("Choose ")) {
    return message;
  }
  return "Gemini could not process this audio. Please try again.";
}

function meetingFilename(title: string, extension: string): string {
  const safeTitle = title
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "meeting-minutes";
  return `${safeTitle}.${extension}`;
}

function normalizeAudioMimeType(mimeType: string, originalName: string): string {
  const normalizedMimeType = mimeType.split(";")[0]?.trim().toLowerCase();
  if (normalizedMimeType && allowedAudioTypes.has(normalizedMimeType)) {
    return normalizedMimeType;
  }
  const extension = extname(originalName).toLowerCase();
  return mimeByExtension[extension] || "audio/webm";
}

router.get("/meetings", async (req, res): Promise<void> => {
  const parsedQuery = ListMeetingsQueryParams.safeParse({ q: req.query.q });
  if (!parsedQuery.success) {
    res.status(400).json({ error: parsedQuery.error.message });
    return;
  }
  const query = parsedQuery.data.q?.trim();
  const rows = await db
    .select()
    .from(meetingsTable)
    .where(query ? or(
      ilike(meetingsTable.title, `%${query}%`),
      ilike(meetingsTable.summary, `%${query}%`),
    ) : undefined)
    .orderBy(desc(meetingsTable.createdAt))
    .limit(200);
  res.json(ListMeetingsResponse.parse(rows.map(summaryResponse)));
});

router.post("/meetings", async (req, res): Promise<void> => {
  const parsedBody = CreateMeetingBody.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: parsedBody.error.message });
    return;
  }
  const title = parsedBody.data.title.trim();
  if (!title) {
    res.status(400).json({ error: "A meeting title is required." });
    return;
  }
  const [row] = await db
    .insert(meetingsTable)
    .values({
      title,
      durationSeconds: parsedBody.data.durationSeconds,
      summary: parsedBody.data.intelligence.summary,
      transcript: parsedBody.data.transcript,
      intelligence: parsedBody.data.intelligence,
    })
    .returning();
  res.status(201).json(CreateMeetingResponse.parse(meetingResponse(row)));
});

router.get("/dashboard", async (_req, res): Promise<void> => {
  const rows = await db.select().from(meetingsTable);
  const totalSeconds = rows.reduce((sum, meeting) => sum + meeting.durationSeconds, 0);
  const overview = GetDashboardResponse.parse({
    totalMeetings: rows.length,
    totalMinutes: Math.floor(totalSeconds / 60),
    actionItems: rows.reduce((sum, meeting) => sum + meeting.intelligence.actionItems.length, 0),
    reviewCount: rows.filter(needsReview).length,
    recentMeetings: [...rows]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5)
      .map(summaryResponse),
  });
  res.json(overview);
});

router.get("/meetings/:id", async (req, res): Promise<void> => {
  const params = parseMeetingId(req.params, GetMeetingParams);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(meetingsTable)
    .where(eq(meetingsTable.id, params.data.id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Meeting not found." });
    return;
  }
  res.json(meetingResponse(row));
});

router.patch("/meetings/:id", async (req, res): Promise<void> => {
  const params = parseMeetingId(req.params, UpdateMeetingParams);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsedBody = UpdateMeetingBody.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: parsedBody.error.message });
    return;
  }
  const changes = parsedBody.data;
  const [row] = await db
    .update(meetingsTable)
    .set({
      ...(changes.title !== undefined ? { title: changes.title.trim() } : {}),
      ...(changes.transcript !== undefined ? { transcript: changes.transcript } : {}),
      ...(changes.intelligence !== undefined
        ? { intelligence: changes.intelligence, summary: changes.intelligence.summary }
        : {}),
    })
    .where(eq(meetingsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Meeting not found." });
    return;
  }
  res.json(UpdateMeetingResponse.parse(meetingResponse(row)));
});

router.delete("/meetings/:id", async (req, res): Promise<void> => {
  const params = parseMeetingId(req.params, DeleteMeetingParams);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const deleted = await db
    .delete(meetingsTable)
    .where(eq(meetingsTable.id, params.data.id))
    .returning({ id: meetingsTable.id });
  if (deleted.length === 0) {
    res.status(404).json({ error: "Meeting not found." });
    return;
  }
  res.status(204).end();
});

router.post("/meetings/process", attachAudio, async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "Choose an audio file before processing." });
    return;
  }
  const parsedBody = ProcessMeetingBody.omit({ audio: true }).safeParse({
    title: req.body.title,
  });
  if (!parsedBody.success) {
    res.status(400).json({ error: parsedBody.error.message });
    return;
  }

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  sendProgress(res, {
    stage: "Audio received",
    progress: 8,
    message: "Preparing a secure copy for analysis",
  });

  try {
    const analysis = await analyzeMeetingAudio(
      req.file.buffer,
      normalizeAudioMimeType(req.file.mimetype, req.file.originalname),
      req.file.originalname,
      (progress) => sendProgress(res, progress),
    );
    sendProgress(res, {
      stage: "Saving your minutes",
      progress: 92,
      message: "Adding the transcript and insights to meeting history",
    });
    const title = parsedBody.data.title?.trim() || `Meeting on ${new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date())}`;
    const [row] = await db
      .insert(meetingsTable)
      .values({
        title,
        durationSeconds: analysis.durationSeconds,
        summary: analysis.intelligence.summary,
        transcript: analysis.transcript,
        intelligence: analysis.intelligence,
      })
      .returning();
    const meeting = meetingResponse(row);
    sendProgress(res, {
      stage: "Minutes are ready",
      progress: 100,
      message: "Your meeting has been saved",
      meeting,
    });
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    req.log.warn({ errorName }, "Meeting processing failed");
    const message = friendlyProcessingError(error);
    sendProgress(res, {
      stage: "Processing stopped",
      progress: 0,
      message,
      error: message,
    });
    res.end();
  }
});

async function loadMeeting(id: number) {
  const [row] = await db
    .select()
    .from(meetingsTable)
    .where(eq(meetingsTable.id, id))
    .limit(1);
  return row;
}

router.get("/meetings/:id/export/pdf", async (req, res): Promise<void> => {
  const params = parseMeetingId(req.params, ExportMeetingPdfParams);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const meeting = await loadMeeting(params.data.id);
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found." });
    return;
  }
  const buffer = await createMeetingPdf(meeting);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${meetingFilename(meeting.title, "pdf")}"`);
  res.send(buffer);
});

router.get("/meetings/:id/export/docx", async (req, res): Promise<void> => {
  const params = parseMeetingId(req.params, ExportMeetingDocxParams);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const meeting = await loadMeeting(params.data.id);
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found." });
    return;
  }
  const buffer = await createMeetingDocx(meeting);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${meetingFilename(meeting.title, "docx")}"`);
  res.send(buffer);
});

export default router;
