import { GoogleGenAI } from "@google/genai";
import type { MeetingIntelligence, TranscriptSegment } from "@workspace/db";

const MODEL = "gemini-3.8-flash";
const MAX_RETRIES = 6;
const FILE_PROCESSING_TIMEOUT_MS = 10 * 60 * 1000;

export type MeetingProgress = {
  stage: string;
  progress: number;
  message: string;
};

export type MeetingAnalysis = {
  transcript: TranscriptSegment[];
  intelligence: MeetingIntelligence;
  durationSeconds: number;
};

type JsonRecord = Record<string, unknown>;
type GeminiFile = Awaited<ReturnType<GoogleGenAI["files"]["upload"]>>;

const transcriptionPrompt = `Analyze this business meeting audio. It may include Tamil and English, including code-switched sentences.

Return only a JSON array. Identify each distinct speaker and use a name only when that speaker says their own name. Otherwise label people Speaker 1, Speaker 2, and so on by first appearance. Split into speaker turns. For every segment include:
- speaker: the stated name or neutral speaker label
- start_time: timestamp in seconds from the start of the recording
- end_time: timestamp in seconds from the start of the recording
- original_text: exactly what was spoken, preserving Tamil/English language mix and the correct writing system
- translated_text: clear English translation preserving intent, context, names, numbers, dates, and technical terms; repeat English unchanged when already English
- language: "ta", "en", or "mixed"
- confidence: a number from 0 to 1 representing transcription confidence

Use this exact structure:
[{"speaker":"Sam","start_time":0,"end_time":4,"original_text":"...","translated_text":"...","language":"mixed","confidence":0.92}]`;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini is not configured. Add the Gemini API key in project secrets.");
  }
  return new GoogleGenAI({ apiKey });
}

function isRetryable(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as { status?: number; statusCode?: number; message?: string };
  const status = candidate.status ?? candidate.statusCode;
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  return /overloaded|temporar|unavailable|timeout|rate.?limit/i.test(candidate.message ?? "");
}

async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= MAX_RETRIES - 1 || !isRetryable(error)) {
        throw error;
      }
      const backoffMs = Math.min(1000 * 2 ** attempt, 30000);
      const jitterMs = Math.floor(Math.random() * 1000);
      await new Promise((resolve) => setTimeout(resolve, backoffMs + jitterMs));
    }
  }
}

let requestQueue = Promise.resolve();

function withGeminiRateLimit<T>(operation: () => Promise<T>): Promise<T> {
  const result = requestQueue.then(operation, operation);
  requestQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function parseJson<T>(rawText: string): T {
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error("Gemini returned an unreadable response. Please retry this recording.");
  }
}

function asRecord(value: unknown, label: string): JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Gemini returned an invalid ${label}. Please retry this recording.`);
  }
  return value as JsonRecord;
}

function readString(record: JsonRecord, snakeCase: string, camelCase = snakeCase): string {
  const value = record[snakeCase] ?? record[camelCase];
  if (typeof value !== "string") {
    throw new Error("Gemini returned incomplete meeting details. Please retry this recording.");
  }
  return value.trim();
}

function readNullableString(record: JsonRecord, snakeCase: string, camelCase = snakeCase): string | null {
  const value = record[snakeCase] ?? record[camelCase];
  if (value == null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error("Gemini returned incomplete meeting details. Please retry this recording.");
  }
  return value.trim();
}

function readConfidence(record: JsonRecord): number {
  const confidence = record.confidence;
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) {
    throw new Error("Gemini omitted a confidence score. Please retry this recording.");
  }
  return Math.max(0, Math.min(1, confidence));
}

function readTimestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string") {
    const parts = value.trim().split(":").map(Number);
    if (parts.length === 1 && Number.isFinite(parts[0]) && parts[0] >= 0) {
      return parts[0];
    }
    if (parts.length === 2 && parts.every(Number.isFinite) && parts[0] >= 0 && parts[1] >= 0) {
      return parts[0] * 60 + parts[1];
    }
  }
  throw new Error("Gemini returned an invalid transcript timestamp. Please retry this recording.");
}

function normalizeTranscript(value: unknown): TranscriptSegment[] {
  if (!Array.isArray(value)) {
    throw new Error("Gemini did not return transcript segments. Please retry this recording.");
  }
  return value.map((item) => {
    const segment = asRecord(item, "transcript segment");
    const language = segment.language;
    if (language !== "ta" && language !== "en" && language !== "mixed") {
      throw new Error("Gemini returned an unsupported language label. Please retry this recording.");
    }
    const startTime = readTimestamp(segment.start_time ?? segment.startTime);
    const endTime = readTimestamp(segment.end_time ?? segment.endTime);
    if (endTime < startTime) {
      throw new Error("Gemini returned an invalid transcript time range. Please retry this recording.");
    }
    return {
      speaker: readString(segment, "speaker"),
      startTime,
      endTime,
      originalText: readString(segment, "original_text", "originalText"),
      translatedText: readString(segment, "translated_text", "translatedText"),
      language,
      confidence: readConfidence(segment),
    };
  });
}

function normalizeIntelligence(value: unknown): MeetingIntelligence {
  const source = asRecord(value, "meeting intelligence");
  const summary = readString(source, "summary");
  const array = (key: string, alternate: string): unknown[] => {
    const items = source[key] ?? source[alternate];
    if (!Array.isArray(items)) {
      throw new Error("Gemini returned incomplete meeting intelligence. Please retry this recording.");
    }
    return items;
  };

  const decisions = array("decisions", "decisions").map((item) => {
    const entry = asRecord(item, "decision");
    return {
      decision: readString(entry, "decision"),
      speaker: readNullableString(entry, "speaker"),
      context: readString(entry, "context"),
      confidence: readConfidence(entry),
    };
  });

  const actionItems = array("action_items", "actionItems").map((item) => {
    const entry = asRecord(item, "action item");
    const priority = entry.priority;
    if (priority !== "high" && priority !== "medium" && priority !== "low") {
      throw new Error("Gemini returned an invalid action priority. Please retry this recording.");
    }
    return {
      action: readString(entry, "action"),
      assignee: readNullableString(entry, "assignee"),
      deadline: readNullableString(entry, "deadline"),
      priority: priority as "high" | "medium" | "low",
      confidence: readConfidence(entry),
    };
  });

  const risks = array("risks", "risks").map((item) => {
    const entry = asRecord(item, "risk");
    const severity = entry.severity;
    if (severity !== "high" && severity !== "medium" && severity !== "low") {
      throw new Error("Gemini returned an invalid risk severity. Please retry this recording.");
    }
    return {
      risk: readString(entry, "risk"),
      speaker: readNullableString(entry, "speaker"),
      severity: severity as "high" | "medium" | "low",
      confidence: readConfidence(entry),
    };
  });

  const questions = array("questions", "questions").map((item) => {
    const entry = asRecord(item, "question");
    if (typeof entry.answered !== "boolean") {
      throw new Error("Gemini returned an invalid question status. Please retry this recording.");
    }
    return {
      question: readString(entry, "question"),
      speaker: readNullableString(entry, "speaker"),
      answered: entry.answered,
      answerSummary: readNullableString(entry, "answer_summary", "answerSummary"),
      confidence: readConfidence(entry),
    };
  });

  return { summary, decisions, actionItems, risks, questions };
}

async function waitForFileReady(
  client: GoogleGenAI,
  uploaded: GeminiFile,
): Promise<GeminiFile> {
  let current = uploaded;
  const deadline = Date.now() + FILE_PROCESSING_TIMEOUT_MS;
  while (current.state === "PROCESSING") {
    if (Date.now() >= deadline) {
      throw new Error("Gemini is taking too long to prepare this audio. Please try again.");
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
    if (!current.name) {
      throw new Error("Gemini could not identify the uploaded audio. Please try again.");
    }
    current = await client.files.get({ name: current.name });
  }
  if (current.state === "FAILED") {
    throw new Error("Gemini could not prepare this audio file. Try a different audio format.");
  }
  if (current.state !== "ACTIVE" || !current.uri) {
    throw new Error("Gemini did not make the audio available for transcription. Please retry.");
  }
  return current;
}

export async function analyzeMeetingAudio(
  audioBuffer: Buffer,
  mimeType: string,
  displayName: string,
  onProgress: (progress: MeetingProgress) => void,
): Promise<MeetingAnalysis> {
  return withGeminiRateLimit(async () => {
    const client = getClient();
    const bytes = new Uint8Array(audioBuffer.byteLength);
    bytes.set(audioBuffer);
    const audio = new Blob([bytes.buffer], { type: mimeType });
    let uploaded: GeminiFile | undefined;

    try {
      onProgress({ stage: "Preparing audio", progress: 18, message: "Sending a secure copy for analysis" });
      uploaded = await withRetry(() =>
        client.files.upload({
          file: audio,
          config: { mimeType, displayName: displayName.slice(0, 160) },
        }),
      );
      const readyFile = await waitForFileReady(client, uploaded);

      onProgress({ stage: "Transcribing and separating speakers", progress: 42, message: "Listening for each voice and language" });
      const transcription = await withRetry(() =>
        client.models.generateContent({
          model: MODEL,
          contents: [
            {
              role: "user",
              parts: [
                { fileData: { fileUri: readyFile.uri!, mimeType: readyFile.mimeType ?? mimeType } },
                { text: transcriptionPrompt },
              ],
            },
          ],
          config: { temperature: 0.2, responseMimeType: "application/json", maxOutputTokens: 8192 },
        }),
      );
      const transcript = normalizeTranscript(parseJson<unknown>(transcription.text ?? ""));

      onProgress({ stage: "Finding decisions and next steps", progress: 72, message: "Reviewing the conversation for key outcomes" });
      const transcriptForAnalysis = transcript
        .map((segment) => `[${segment.speaker}] ${segment.translatedText} (original: ${segment.originalText})`)
        .join("\n");
      const speakers = [...new Set(transcript.map((segment) => segment.speaker))];
      const intelligencePrompt = `You are an expert meeting intelligence analyst. Analyze only the information explicitly present in this transcript.

TRANSCRIPT:
${transcriptForAnalysis}

SPEAKERS: ${speakers.join(", ") || "None identified"}

Return only JSON with this structure:
{
  "summary": "Two or three sentence summary",
  "decisions": [{"decision": "...", "speaker": "name or null", "context": "...", "confidence": 0.0}],
  "action_items": [{"action": "...", "assignee": "name or null", "deadline": "date or null", "priority": "high|medium|low", "confidence": 0.0}],
  "risks": [{"risk": "...", "speaker": "name or null", "severity": "high|medium|low", "confidence": 0.0}],
  "questions": [{"question": "...", "speaker": "name or null", "answered": true, "answer_summary": "summary or null", "confidence": 0.0}]
}

Use empty arrays when none are present. Confidence must be from 0 to 1: 0.9-1.0 explicit, 0.6-0.8 reasonably clear, under 0.6 inferred or uncertain. Be conservative, do not guess speakers or details, and use the exact speaker labels above.`;
      const intelligenceResponse = await withRetry(() =>
        client.models.generateContent({
          model: MODEL,
          contents: intelligencePrompt,
          config: { temperature: 0.2, responseMimeType: "application/json", maxOutputTokens: 8192 },
        }),
      );
      const intelligence = normalizeIntelligence(parseJson<unknown>(intelligenceResponse.text ?? ""));
      const durationSeconds = Math.ceil(
        transcript.reduce((maximum, segment) => Math.max(maximum, segment.endTime), 0),
      );

      return { transcript, intelligence, durationSeconds };
    } finally {
      if (uploaded?.name) {
        await client.files.delete({ name: uploaded.name }).catch(() => undefined);
      }
    }
  });
}
