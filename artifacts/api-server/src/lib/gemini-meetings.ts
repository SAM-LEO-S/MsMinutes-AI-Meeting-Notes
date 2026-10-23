// import { GoogleGenAI } from "@google/genai";
// import type { MeetingIntelligence, TranscriptSegment } from "@workspace/db";
// import { parseBuffer } from "music-metadata";

// /**
//  * Gemini-native meeting pipeline — TypeScript port of meeting_recorder_1.py.
//  *
//  * Differences from the Python reference are deliberate and listed here:
//  *  - Audio is sent exactly as received (no byte-level normalize/trim: the
//  *    upload is an ENCODED file, not raw PCM, so editing its bytes corrupts it).
//  *  - No maxOutputTokens cap (Python has none); truncation is detected instead.
//  *  - Models are tried in order and a model whose DAILY quota is exhausted is
//  *    skipped until its quota resets, instead of burning a call on it each time.
//  *  - Retries are short; falling through to the next model is the real recovery.
//  *
//  * Model order is configurable without code changes:
//  *   GEMINI_AUDIO_MODELS=gemini-3.8-flash,gemini-3.1-flash-lite,gemini-3.5-flash-lite
//  *   GEMINI_ANALYSIS_MODELS=gemini-3.1-flash-lite,gemini-3.5-flash-lite,gemini-3.8-flash
//  */

// function parseModelList(value: string | undefined, fallback: string): string[] {
//   return (value ?? fallback)
//     .split(",")
//     .map((model) => model.trim())
//     .filter(Boolean);
// }

// // Audio step: quality first (this is the Tamil/English + speaker-separation step).
// const AUDIO_MODELS = parseModelList(
//   process.env.GEMINI_AUDIO_MODELS,
//   "gemini-3.8-flash,gemini-3.1-flash-lite,gemini-3.5-flash-lite",
// );
// // Text-only step: spend the small 3.8 daily quota last.
// const ANALYSIS_MODELS = parseModelList(
//   process.env.GEMINI_ANALYSIS_MODELS,
//   "gemini-3.1-flash-lite,gemini-3.5-flash-lite,gemini-3.8-flash",
// );

// const MAX_RETRIES = 3;
// const MAX_BACKOFF_MS = 8000;
// const TEMPERATURE = 0.2; // same as the Python reference
// const FILE_PROCESSING_TIMEOUT_MS = 15 * 60 * 1000;

// export type MeetingProgress = {
//   stage: string;
//   progress: number;
//   message: string;
// };

// export type MeetingAnalysis = {
//   transcript: TranscriptSegment[];
//   intelligence: MeetingIntelligence;
//   durationSeconds: number;
// };

// type JsonRecord = Record<string, unknown>;
// type GeminiFile = Awaited<ReturnType<GoogleGenAI["files"]["upload"]>>;

// // ---------------------------------------------------------------------------
// // MIME type utilities
// // ---------------------------------------------------------------------------

// const MIME_ALIASES: Record<string, string> = {
//   "audio/x-wav": "audio/wav",
//   "audio/wave": "audio/wav",
//   "audio/mpeg": "audio/mp3",
//   "audio/x-m4a": "audio/mp4",
//   "audio/m4a": "audio/mp4",
// };

// function cleanMimeType(rawMime: string): string {
//   // Strip codec parameters such as ";codecs=opus", normalize common aliases.
//   const base = (rawMime ?? "").split(";")[0].trim().toLowerCase();
//   if (!base || base === "application/octet-stream") return "audio/webm"; // browser recordings
//   return MIME_ALIASES[base] ?? base;
// }

// function formatClock(totalSeconds: number): string {
//   const minutes = Math.floor(totalSeconds / 60);
//   const seconds = Math.round(totalSeconds % 60);
//   return `${minutes}:${String(seconds).padStart(2, "0")}`;
// }

// // ---------------------------------------------------------------------------
// // Prompt (same wording as the Python reference)
// // ---------------------------------------------------------------------------

// function buildTranscriptionPrompt(exactDurationSeconds?: number): string {
//   const durationLine =
//     exactDurationSeconds && exactDurationSeconds > 0
//       ? `\nThe recording is exactly ${formatClock(exactDurationSeconds)} (${exactDurationSeconds} seconds) long. No start_time or end_time may exceed it.\n`
//       : "";

//   return `You are analyzing audio from a business meeting that may mix Tamil and English, including code-switched sentences (Tamil and English mixed within the same sentence).

// Your job:
// 1. Identify each distinct speaker in the audio.
// 2. If a speaker says their own name (e.g., "My name is Sam", "Hi, I'm Vignesh", "இது சாம் பேசுறேன்"), use that stated name as their label for the ENTIRE recording. If a speaker never states their name, label them "Speaker 1", "Speaker 2", etc. (in order of first appearance). Never guess a name that wasn't actually said.
// 3. Split the audio into segments by speaker turn.
// 4. For each segment, provide the ORIGINAL text exactly as spoken (preserving the Tamil/English mix as spoken, in correct script for each language).
// 5. For each segment, also provide an ENGLISH TRANSLATION that preserves meaning, intent, and context — NOT a word-by-word translation. Keep names, numbers, dates, and technical terms accurate. If a segment is already in English, repeat it unchanged as the translation.
// ${durationLine}
// Return ONLY a JSON array, no other text, in this exact format:
// [
//   {
//     "speaker": "Sam",
//     "start_time": "0:00",
//     "end_time": "0:04",
//     "original_text": "...",
//     "translated_text": "...",
//     "language": "ta"
//   }
// ]

// "language" should be "ta" (Tamil), "en" (English), or "mixed" (code-switched).`;
// }

// function buildIntelligencePrompt(transcriptForAnalysis: string, speakers: string[]): string {
//   return `You are an expert meeting intelligence analyst. Analyze this meeting transcript and extract structured information.

// MEETING TRANSCRIPT:
// ${transcriptForAnalysis}

// SPEAKERS IN MEETING: ${speakers.join(", ") || "None"}

// Extract the following information in a structured JSON format:
// {
//     "decisions": [
//         {"decision": "...", "speaker": "...", "context": "...", "confidence": 0.0}
//     ],
//     "action_items": [
//         {"action": "...", "assignee": "...", "deadline": "...", "priority": "high/medium/low", "confidence": 0.0}
//     ],
//     "risks": [
//         {"risk": "...", "speaker": "...", "severity": "high/medium/low", "confidence": 0.0}
//     ],
//     "questions": [
//         {"question": "...", "speaker": "...", "answered": true, "answer_summary": "...", "confidence": 0.0}
//     ],
//     "summary": "Brief 2-3 sentence summary of the entire meeting"
// }

// For "confidence" (0.0 to 1.0), rate how explicitly the transcript supports this extraction:
// - 0.9-1.0: Explicitly and unambiguously stated
// - 0.6-0.8: Reasonably clear but with some inference
// - Below 0.6: Implied, uncertain, or phrased as a possibility/suggestion rather than a firm statement

// Rules:
// - Only extract information actually mentioned in the transcript
// - Be conservative: if unsure, use a LOW confidence score rather than omitting or inflating it
// - Use the exact speaker names from the transcript

// Return ONLY the JSON, no additional text.`;
// }

// // ---------------------------------------------------------------------------
// // Client + JSON helpers
// // ---------------------------------------------------------------------------

// function getClient(): GoogleGenAI {
//   const apiKey = process.env.GEMINI_API_KEY;
//   if (!apiKey) {
//     throw new Error("Gemini API key is missing from environment variables.");
//   }
//   return new GoogleGenAI({
//     apiKey,
//     httpOptions: {
//       timeout: 120000,
//     },
//   });
// }

// function safeParseJson<T>(rawText: string): T {
//   let cleaned = rawText.trim();
//   if (cleaned.startsWith("```")) {
//     cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
//   }

//   try {
//     return JSON.parse(cleaned) as T;
//   } catch {
//     console.warn("⚠️ JSON parse failed. Attempting structural auto-repair...");
//   }

//   let repaired = cleaned;

//   const quoteCount = (repaired.match(/"/g) || []).length;
//   if (quoteCount % 2 !== 0) {
//     repaired += '"';
//   }

//   repaired = repaired.replace(/,\s*"[^"]*"?\s*:?\s*"?$/, "");
//   repaired = repaired.replace(/,\s*$/, "");

//   const openBrackets = (repaired.match(/\[/g) || []).length;
//   const closeBrackets = (repaired.match(/\]/g) || []).length;
//   const openBraces = (repaired.match(/\{/g) || []).length;
//   const closeBraces = (repaired.match(/\}/g) || []).length;

//   for (let i = 0; i < openBraces - closeBraces; i++) repaired += "}";
//   for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += "]";

//   try {
//     return JSON.parse(repaired) as T;
//   } catch {
//     console.error("Auto-repair failed. Raw text tail:", cleaned.slice(-300));
//     throw new Error("The AI service output was unreadable or incomplete. Please try again.");
//   }
// }

// // ---------------------------------------------------------------------------
// // Errors, quota detection, retry
// // ---------------------------------------------------------------------------

// function errorText(error: unknown): string {
//   if (!error || typeof error !== "object") return String(error ?? "");
//   const e = error as { message?: string; cause?: { message?: string } };
//   return `${e.message ?? ""} ${e.cause?.message ?? ""}`;
// }

// function errorStatus(error: unknown): number | undefined {
//   if (!error || typeof error !== "object") return undefined;
//   const e = error as { status?: number; statusCode?: number };
//   return e.status ?? e.statusCode;
// }

// /** Seconds Google says to wait, from either the JSON body or the human message. */
// function retryDelaySeconds(text: string): number | null {
//   const json = text.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
//   if (json) return Number(json[1]);
//   const human = text.match(/retry in (?:(\d+)h)?(?:(\d+)m)?(\d+(?:\.\d+)?)s/i);
//   if (human) {
//     return Number(human[1] ?? 0) * 3600 + Number(human[2] ?? 0) * 60 + Number(human[3]);
//   }
//   return null;
// }

// export function isDailyQuota(error: unknown): boolean {
//   const text = errorText(error);
//   if (/PerDay/i.test(text)) return true;
//   return (retryDelaySeconds(text) ?? 0) > 300; // a wait over 5 min means a daily cap
// }

// function isRetryable(error: unknown): boolean {
//   if (!error || typeof error !== "object") return false;
//   if (errorStatus(error) === 429) return false; // quota: move to the next model instead
//   const status = errorStatus(error);
//   if (status === 500 || status === 502 || status === 503 || status === 504) return true;
//   return /overloaded|temporar|unavailable|timeout|fetch failed|UND_ERR_CONNECT_TIMEOUT/i.test(
//     errorText(error),
//   );
// }

// async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
//   for (let attempt = 0; ; attempt += 1) {
//     try {
//       return await operation();
//     } catch (error) {
//       if (attempt >= MAX_RETRIES - 1 || !isRetryable(error)) throw error;
//       const waitTime = Math.min(2 ** attempt * 1000, MAX_BACKOFF_MS) + Math.random() * 1000;
//       console.warn(`Gemini call failed (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${waitTime.toFixed(0)}ms...`);
//       await new Promise((resolve) => setTimeout(resolve, waitTime));
//     }
//   }
// }

// // Models whose DAILY free quota is used up, mapped to when to try them again.
// const exhaustedUntil = new Map<string, number>();

// function isExhausted(model: string): boolean {
//   const until = exhaustedUntil.get(model);
//   if (!until) return false;
//   if (Date.now() >= until) {
//     exhaustedUntil.delete(model);
//     return false;
//   }
//   return true;
// }

// function markExhausted(model: string, error: unknown): void {
//   const delay = retryDelaySeconds(errorText(error));
//   const ms = Math.min((delay ?? 3600) * 1000, 24 * 60 * 60 * 1000);
//   exhaustedUntil.set(model, Date.now() + ms);
//   console.warn(`Model ${model} hit its daily quota; skipping it for ${Math.round(ms / 60000)} min.`);
// }

// async function runWithModels<T>(
//   models: string[],
//   label: string,
//   attempt: (model: string) => Promise<T>,
// ): Promise<{ result: T; model: string }> {
//   let lastError: unknown = null;
//   let tried = 0;

//   for (const model of models) {
//     if (isExhausted(model)) continue;
//     tried += 1;
//     try {
//       return { result: await attempt(model), model };
//     } catch (error) {
//       lastError = error;
//       if (isDailyQuota(error)) markExhausted(model, error);
//       console.error(`${label}: ${model} failed (status ${errorStatus(error) ?? "n/a"}): ${errorText(error).slice(0, 300)}`);
//     }
//   }

//   if (tried === 0) {
//     throw new Error("The free Gemini quota is used up on every configured model. It resets around midnight Pacific time.");
//   }
//   throw lastError ?? new Error("All AI models failed.");
// }

// let requestQueue: Promise<void> = Promise.resolve();
// function withGeminiRateLimit<T>(operation: () => Promise<T>): Promise<T> {
//   const result = requestQueue.then(operation, operation);
//   requestQueue = result.then(() => undefined, () => undefined);
//   return result;
// }

// // ---------------------------------------------------------------------------
// // Normalizers
// // ---------------------------------------------------------------------------

// function asRecord(value: unknown): JsonRecord {
//   if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
//   return value as JsonRecord;
// }

// function readString(record: JsonRecord, snakeCase: string, camelCase = snakeCase): string {
//   const value = record[snakeCase] ?? record[camelCase];
//   return typeof value === "string" ? value.trim() : "";
// }

// function readNullableString(record: JsonRecord, snakeCase: string, camelCase = snakeCase): string | null {
//   const value = record[snakeCase] ?? record[camelCase];
//   if (value == null || value === "") return null;
//   return typeof value === "string" ? value.trim() : null;
// }

// function readConfidence(record: JsonRecord, fallback = 0.5): number {
//   const confidence = record.confidence;
//   if (typeof confidence !== "number" || !Number.isFinite(confidence)) return fallback;
//   return Math.max(0, Math.min(1, confidence));
// }

// function readTimestamp(value: unknown): number {
//   if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
//   if (typeof value === "string") {
//     const parts = value.trim().split(":").map(Number);
//     if (!parts.every((part) => Number.isFinite(part) && part >= 0)) return 0;
//     if (parts.length === 1) return parts[0];
//     if (parts.length === 2) return parts[0] * 60 + parts[1];
//     if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
//   }
//   return 0;
// }

// function normalizeTranscript(value: unknown, maxSeconds?: number): TranscriptSegment[] {
//   if (!Array.isArray(value)) throw new Error("Transcript payload is not an array.");

//   const clamp = (seconds: number) => (maxSeconds ? Math.min(seconds, maxSeconds) : seconds);
//   const segments: TranscriptSegment[] = [];

//   for (const item of value) {
//     const segment = asRecord(item);
//     const originalText = readString(segment, "original_text", "originalText");
//     const translatedText = readString(segment, "translated_text", "translatedText");

//     if (!originalText && !translatedText) continue;

//     const rawLang = String(segment.language ?? "").toLowerCase();
//     const language: "ta" | "en" | "mixed" =
//       rawLang === "ta" || rawLang === "en" || rawLang === "mixed" ? rawLang : "mixed";

//     const startTime = clamp(readTimestamp(segment.start_time ?? segment.startTime));
//     const endTime = clamp(readTimestamp(segment.end_time ?? segment.endTime));

//     segments.push({
//       speaker: readString(segment, "speaker") || "Speaker 1",
//       startTime,
//       endTime: Math.max(startTime, endTime),
//       originalText: originalText || translatedText,
//       translatedText: translatedText || originalText,
//       language,
//       // The transcript prompt does not ask for per-segment confidence.
//       confidence: readConfidence(segment, 0.9),
//     });
//   }

//   if (segments.length === 0) {
//     throw new Error("No valid transcript segments could be parsed.");
//   }

//   return segments;
// }

// function normalizeIntelligence(value: unknown): MeetingIntelligence {
//   const source = asRecord(value);
//   const summary = readString(source, "summary") || "Executive meeting summary unavailable.";
//   const array = (key: string, alternate: string): unknown[] => {
//     const items = source[key] ?? source[alternate];
//     return Array.isArray(items) ? items : [];
//   };

//   const decisions = array("decisions", "decisions")
//     .map((item) => {
//       const entry = asRecord(item);
//       return {
//         decision: readString(entry, "decision"),
//         speaker: readNullableString(entry, "speaker"),
//         context: readString(entry, "context"),
//         confidence: readConfidence(entry),
//       };
//     })
//     .filter((d) => d.decision.length > 0);

//   const actionItems = array("action_items", "actionItems")
//     .map((item) => {
//       const entry = asRecord(item);
//       const priority = entry.priority;
//       const validPriority: "high" | "medium" | "low" =
//         priority === "high" || priority === "medium" || priority === "low" ? priority : "medium";
//       return {
//         action: readString(entry, "action"),
//         assignee: readNullableString(entry, "assignee"),
//         deadline: readNullableString(entry, "deadline"),
//         priority: validPriority,
//         confidence: readConfidence(entry),
//       };
//     })
//     .filter((a) => a.action.length > 0);

//   const risks = array("risks", "risks")
//     .map((item) => {
//       const entry = asRecord(item);
//       const severity = entry.severity;
//       const validSeverity: "high" | "medium" | "low" =
//         severity === "high" || severity === "medium" || severity === "low" ? severity : "medium";
//       return {
//         risk: readString(entry, "risk"),
//         speaker: readNullableString(entry, "speaker"),
//         severity: validSeverity,
//         confidence: readConfidence(entry),
//       };
//     })
//     .filter((r) => r.risk.length > 0);

//   const questions = array("questions", "questions")
//     .map((item) => {
//       const entry = asRecord(item);
//       return {
//         question: readString(entry, "question"),
//         speaker: readNullableString(entry, "speaker"),
//         answered: Boolean(entry.answered),
//         answerSummary: readNullableString(entry, "answer_summary", "answerSummary"),
//         confidence: readConfidence(entry),
//       };
//     })
//     .filter((q) => q.question.length > 0);

//   return { summary, decisions, actionItems, risks, questions };
// }

// // ---------------------------------------------------------------------------
// // File upload
// // ---------------------------------------------------------------------------

// async function waitForFileReady(client: GoogleGenAI, uploaded: GeminiFile): Promise<GeminiFile> {
//   let current = uploaded;
//   const deadline = Date.now() + FILE_PROCESSING_TIMEOUT_MS;
//   while (current.state === "PROCESSING") {
//     if (Date.now() >= deadline) throw new Error("File processing timed out.");
//     await new Promise((resolve) => setTimeout(resolve, 2000));
//     if (!current.name) throw new Error("File name missing during status polling.");
//     current = await client.files.get({ name: current.name });
//   }
//   if (current.state === "FAILED") throw new Error("Gemini file encoding failed.");
//   return current;
// }

// function wasTruncated(response: { candidates?: Array<{ finishReason?: unknown }> }): boolean {
//   return String(response.candidates?.[0]?.finishReason ?? "") === "MAX_TOKENS";
// }

// // ---------------------------------------------------------------------------
// // Main entry point
// // ---------------------------------------------------------------------------

// export async function analyzeMeetingAudio(
//   audioBuffer: Buffer,
//   mimeType: string,
//   displayName: string,
//   onProgress: (progress: MeetingProgress) => void,
// ): Promise<MeetingAnalysis> {
//   return withGeminiRateLimit(async () => {
//     const client = getClient();
//     const cleanMime = cleanMimeType(mimeType);

//     // Duration from the file header (not from the model). Browser WebM often has none.
//     let headerDurationSeconds: number | undefined;
//     try {
//       const meta = await parseBuffer(audioBuffer, { mimeType: cleanMime });
//       if (meta.format.duration && meta.format.duration > 0) {
//         headerDurationSeconds = Math.round(meta.format.duration);
//         console.log(`🎵 Audio header duration: ${headerDurationSeconds}s`);
//       }
//     } catch (e) {
//       console.warn("⚠️ Could not read audio metadata:", e);
//     }

//     // Send the audio exactly as received.
//     onProgress({ stage: "Preparing audio", progress: 8, message: "Preparing audio" });
//     const bytes = new Uint8Array(audioBuffer.byteLength);
//     bytes.set(audioBuffer);
//     const audio = new Blob([bytes.buffer], { type: cleanMime });
//     let uploaded: GeminiFile | undefined;

//     try {
//       onProgress({ stage: "Preparing audio", progress: 18, message: "Uploading audio to Gemini Cloud" });
//       uploaded = await withRetry(() =>
//         client.files.upload({
//           file: audio,
//           config: { mimeType: cleanMime, displayName: displayName.slice(0, 160) },
//         }),
//       );

//       const readyFile = await waitForFileReady(client, uploaded);
//       const prompt = buildTranscriptionPrompt(headerDurationSeconds);

//       // 1) Transcription + speaker separation + translation
//       let transcriptRun: { result: TranscriptSegment[]; model: string };
//       try {
//         transcriptRun = await runWithModels(AUDIO_MODELS, "transcription", async (model) => {
//           onProgress({
//             stage: "Transcribing and separating speakers",
//             progress: 42,
//             message: `Processing with ${model}...`,
//           });

//           const response = await withRetry(() =>
//             client.models.generateContent({
//               model,
//               contents: [
//                 {
//                   role: "user",
//                   parts: [
//                     { fileData: { fileUri: readyFile.uri!, mimeType: readyFile.mimeType ?? cleanMime } },
//                     { text: prompt },
//                   ],
//                 },
//               ],
//               config: { temperature: TEMPERATURE, responseMimeType: "application/json" },
//             }),
//           );

//           if (wasTruncated(response)) {
//             throw new Error(`Transcript was cut off by the output limit on ${model}.`);
//           }

//           return normalizeTranscript(safeParseJson<unknown>(response.text ?? ""), headerDurationSeconds);
//         });
//       } catch (error) {
//         const status = errorStatus(error);
//         if (status === 503) {
//           throw new Error("Gemini service is currently overloaded. Please wait a few minutes and try again.");
//         }
//         if (status === 504) {
//           throw new Error("Gemini request timed out. The audio may be too long or the service is busy. Try with a shorter recording.");
//         }
//         throw error;
//       }

//       const transcript = transcriptRun.result;
//       console.log(`✅ Transcribed with ${transcriptRun.model}: ${transcript.length} segments`);

//       // 2) Meeting intelligence (same transcript text the Python reference sends)
//       onProgress({ stage: "Extracting meeting intelligence", progress: 72, message: "Generating summary and action items" });
//       const transcriptForAnalysis = transcript
//         .map((segment) => `[${segment.speaker}] ${segment.translatedText}`)
//         .join("\n");
//       const speakers = [...new Set(transcript.map((segment) => segment.speaker))];
//       const intelligencePrompt = buildIntelligencePrompt(transcriptForAnalysis, speakers);

//       let intelligence: MeetingIntelligence;
//       try {
//         const run = await runWithModels(ANALYSIS_MODELS, "intelligence", async (model) => {
//           const response = await withRetry(() =>
//             client.models.generateContent({
//               model,
//               contents: intelligencePrompt,
//               config: { temperature: TEMPERATURE, responseMimeType: "application/json" },
//             }),
//           );
//           if (wasTruncated(response)) {
//             throw new Error(`Intelligence output was cut off on ${model}.`);
//           }
//           return normalizeIntelligence(safeParseJson<unknown>(response.text ?? ""));
//         });
//         intelligence = run.result;
//       } catch (error) {
//         console.error("Intelligence extraction failed on all models:", errorText(error).slice(0, 300));
//         intelligence = {
//           summary: "Automatic intelligence extraction could not be completed.",
//           decisions: [],
//           actionItems: [],
//           risks: [],
//           questions: [],
//         };
//       }

//       const maxModelEndTime = transcript.reduce((max, s) => Math.max(max, s.endTime), 0);
//       const durationSeconds = headerDurationSeconds ?? Math.ceil(maxModelEndTime);

//       return { transcript, intelligence, durationSeconds };
//     } catch (processError) {
//       console.error("🔥 Meeting processing error:", errorText(processError).slice(0, 500));
//       throw processError;
//     } finally {
//       if (uploaded?.name) {
//         await client.files.delete({ name: uploaded.name }).catch(() => undefined);
//       }
//     }
//   });
// }

import { GoogleGenAI } from "@google/genai";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import os from "os";
import type { MeetingIntelligence, TranscriptSegment } from "@workspace/db";
import { parseBuffer } from "music-metadata";

const CHUNK_DURATION_SECONDS = 600; // 10-minute chunks to stay under 504 timeouts
const MAX_RETRIES_PER_MODEL = 2;
const TEMPERATURE = 0.2;

const AUDIO_MODELS = [
  "gemini-3.1-flash-lite", // Primary: Diarization & speed
  "gemini-3.5-flash-lite", // Secondary: Stability
  "gemini-3.8-flash",      // Tertiary: Quota capped fallback
] as const;

const ANALYSIS_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
] as const;

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

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key is missing from environment variables.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 300000, // 5-minute timeout window per API call
    },
  });
}

function safeParseJson<T>(rawText: string, contextName: string): T {
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    console.warn(`⚠️ [Context: ${contextName}] JSON parse failed. Attempting structural auto-repair...`);
  }

  let repaired = cleaned;
  const quoteCount = (repaired.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) repaired += '"';

  repaired = repaired.replace(/,\s*"[^"]*"?\s*:?\s*"?$/, "");
  repaired = repaired.replace(/,\s*$/, "");

   const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;
  const openBraces = (repaired.match(/\{/g) || []).length;
  const closeBraces = (repaired.match(/\}/g) || []).length;


  for (let i = 0; i < openBraces - closeBraces; i++) repaired += "}";
  for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += "]";

  try {
    return JSON.parse(repaired) as T;
  } catch {
    console.error(`❌ [Context: ${contextName}] Auto-repair failed. Tail:`, cleaned.slice(-300));
    throw new Error(`Failed to parse AI output for ${contextName}.`);
  }
}

// Compress and segment audio into 10-minute 16kHz mono MP3 chunks using ffmpeg
async function prepareAudioChunks(audioBuffer: Buffer, fileName: string): Promise<{ paths: string[]; tmpDir: string }> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "meeting-chunks-"));
  const inputPath = path.join(tmpDir, "input_audio.tmp");
  fs.writeFileSync(inputPath, audioBuffer);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-f segment",
        `-segment_time ${CHUNK_DURATION_SECONDS}`,
        "-c:a libmp3lame",
        "-ac 1",      // Mono channel
        "-ar 16000",  // 16kHz optimal sample rate for speech AI
        "-b:a 32k",   // Low bitrate to ensure fast upload
      ])
      .output(path.join(tmpDir, "chunk_%03d.mp3"))
      .on("end", () => {
        const files = fs
          .readdirSync(tmpDir)
          .filter((f) => f.startsWith("chunk_") && f.endsWith(".mp3"))
          .sort()
          .map((f) => path.join(tmpDir, f));
        resolve({ paths: files, tmpDir });
      })
      .on("error", (err) => {
        console.error(`❌ ffmpeg chunking error on '${fileName}':`, err);
        reject(err);
      })
      .run();
  });
}

function buildChunkPrompt(): string {
  return `You are analyzing a business meeting audio segment that mixes Tamil and English.

Rules:
1. Identify distinct speakers. Use stated names if spoken (e.g., "Hi, I'm Vignesh"), otherwise label Speaker 1, Speaker 2, etc.
2. Write English/technical terms in LATIN script (Apex, API, Salesforce, DMS) and Tamil in native script.
3. Provide "original_text" (exact spoken) and "translated_text" (English translation) for each turn.
4. Timestamps start at "0:00" for this segment.

Return STRICTLY a JSON array matching this format:
[
  {
    "speaker": "Speaker 1",
    "start_time": "0:00",
    "end_time": "0:05",
    "original_text": "இங்க Apex code எழுதணும்.",
    "translated_text": "We need to write Apex code here.",
    "language": "mixed"
  }
]`;
}

function parseTimestamp(ts: unknown): number {
  if (typeof ts === "number" && Number.isFinite(ts) && ts >= 0) return ts;
  if (typeof ts === "string") {
    const parts = ts.trim().split(":").map(Number);
    if (parts.length === 1 && !isNaN(parts[0])) return parts[0];
    if (parts.length === 2 && !parts.some(isNaN)) return parts[0] * 60 + parts[1];
    if (parts.length === 3 && !parts.some(isNaN)) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

function asRecord(value: unknown): JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function readString(record: JsonRecord, snakeCase: string, camelCase = snakeCase): string {
  const value = record[snakeCase] ?? record[camelCase];
  return typeof value === "string" ? value.trim() : "";
}

function readNullableString(record: JsonRecord, snakeCase: string, camelCase = snakeCase): string | null {
  const value = record[snakeCase] ?? record[camelCase];
  if (value == null || value === "") return null;
  return typeof value === "string" ? value.trim() : null;
}

function normalizeIntelligence(value: unknown): MeetingIntelligence {
  const source = asRecord(value);
  const summary = readString(source, "summary") || "Executive meeting summary unavailable.";
  const array = (key: string, alternate: string): unknown[] => {
    const items = source[key] ?? source[alternate];
    return Array.isArray(items) ? items : [];
  };

  const decisions = array("decisions", "decisions")
    .map((item) => {
      const entry = asRecord(item);
      return {
        decision: readString(entry, "decision"),
        speaker: readNullableString(entry, "speaker"),
        context: readString(entry, "context"),
        confidence: 0.9,
      };
    })
    .filter((d) => d.decision.length > 0);

  const actionItems = array("action_items", "actionItems")
    .map((item) => {
      const entry = asRecord(item);
      const priority = entry.priority;
      const validPriority: "high" | "medium" | "low" =
        priority === "high" || priority === "medium" || priority === "low" ? priority : "medium";
      return {
        action: readString(entry, "action"),
        assignee: readNullableString(entry, "assignee"),
        deadline: readNullableString(entry, "deadline"),
        priority: validPriority,
        confidence: 0.9,
      };
    })
    .filter((a) => a.action.length > 0);

  const risks = array("risks", "risks")
    .map((item) => {
      const entry = asRecord(item);
      const severity = entry.severity;
      const validSeverity: "high" | "medium" | "low" =
        severity === "high" || severity === "medium" || severity === "low" ? severity : "medium";
      return {
        risk: readString(entry, "risk"),
        speaker: readNullableString(entry, "speaker"),
        severity: validSeverity,
        confidence: 0.9,
      };
    })
    .filter((r) => r.risk.length > 0);

  const questions = array("questions", "questions")
    .map((item) => {
      const entry = asRecord(item);
      return {
        question: readString(entry, "question"),
        speaker: readNullableString(entry, "speaker"),
        answered: Boolean(entry.answered),
        answerSummary: readNullableString(entry, "answer_summary", "answerSummary"),
        confidence: 0.9,
      };
    })
    .filter((q) => q.question.length > 0);

  return { summary, decisions, actionItems, risks, questions };
}

// Retries a single model operation up to MAX_RETRIES_PER_MODEL times
async function withChunkRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES_PER_MODEL; attempt++) {
    try {
      return await operation();
    } catch (err: any) {
      lastError = err;
      const status = err?.status || err?.statusCode;
      if (status === 503 || status === 500 || status === 502 || status === 504) {
        console.warn(`⚠️ Transient ${status} error on attempt ${attempt + 1}. Retrying in 2s...`);
        await new Promise((r) => setTimeout(r, 2000));
      } else {
        throw err; // Non-retryable error
      }
    }
  }
  throw lastError;
}

// Rotates through AUDIO_MODELS stack if a model fails with 503/504
async function runChunkWithFallback(
  client: GoogleGenAI,
  fileUri: string,
  prompt: string,
  contextLabel: string,
): Promise<any[]> {
  let lastError: unknown;

  for (const model of AUDIO_MODELS) {
    try {
      const response = await withChunkRetry(() =>
        client.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [
                { fileData: { fileUri, mimeType: "audio/mp3" } },
                { text: prompt },
              ],
            },
          ],
          config: {
            temperature: TEMPERATURE,
            responseMimeType: "application/json",
          },
        }),
      );

      return safeParseJson<any[]>(response.text ?? "[]", `${contextLabel} (${model})`);
    } catch (err) {
      lastError = err;
      console.error(`🚨 Model ${model} failed for ${contextLabel}. Rotating to next fallback model...`);
    }
  }

  throw lastError || new Error(`All fallback models failed for ${contextLabel}`);
}

export async function analyzeMeetingAudio(
  audioBuffer: Buffer,
  mimeType: string,
  displayName: string,
  onProgress: (progress: MeetingProgress) => void,
): Promise<MeetingAnalysis> {
  const client = getClient();

  let headerDurationSeconds: number | undefined;
  try {
    const meta = await parseBuffer(audioBuffer);
    if (meta.format.duration && meta.format.duration > 0) {
      headerDurationSeconds = Math.round(meta.format.duration);
      console.log(`🎵 [File: ${displayName}] Audio header duration: ${headerDurationSeconds}s`);
    }
  } catch (e) {
    console.warn(`⚠️ [File: ${displayName}] Could not read duration from header:`, e);
  }

  onProgress({
    stage: "Preparing Audio",
    progress: 10,
    message: `Splitting and compressing '${displayName}' into 10-minute segments...`,
  });

  const { paths: chunkFiles, tmpDir } = await prepareAudioChunks(audioBuffer, displayName);
  const fullTranscript: TranscriptSegment[] = [];

  try {
    for (let i = 0; i < chunkFiles.length; i++) {
      const chunkPath = chunkFiles[i];
      const timeOffsetSeconds = i * CHUNK_DURATION_SECONDS;
      const progressPercent = Math.round(15 + ((i + 1) / chunkFiles.length) * 55);

      onProgress({
        stage: "Transcribing and Separating Speakers",
        progress: progressPercent,
        message: `Transcribing segment ${i + 1} of ${chunkFiles.length} for '${displayName}'...`,
      });

      const uploaded = await client.files.upload({
        file: new Blob([fs.readFileSync(chunkPath)], { type: "audio/mp3" }),
        config: { mimeType: "audio/mp3", displayName: `chunk_${i}_${displayName.slice(0, 100)}` },
      });

      let parsedSegments: any[] = [];
      try {
        if (!uploaded.uri) {
          throw new Error("Gemini uploaded the audio chunk without returning a file URI.");
        }
        // Uses fallback stack rotation
        parsedSegments = await runChunkWithFallback(
          client,
          uploaded.uri,
          buildChunkPrompt(),
          `Segment ${i + 1}/${chunkFiles.length} of ${displayName}`,
        );
      } finally {
        if (uploaded.name) {
          await client.files.delete({ name: uploaded.name }).catch(() => undefined);
        }
      }

      for (const seg of parsedSegments) {
        const originalText = seg.original_text || seg.originalText || seg.translated_text || "";
        const translatedText = seg.translated_text || seg.translatedText || originalText;

        if (!originalText && !translatedText) continue;

        const start = parseTimestamp(seg.start_time ?? seg.startTime) + timeOffsetSeconds;
        const end = parseTimestamp(seg.end_time ?? seg.endTime) + timeOffsetSeconds;

        fullTranscript.push({
          speaker: seg.speaker || "Speaker 1",
          startTime: start,
          endTime: Math.max(start, end),
          originalText,
          translatedText,
          language: seg.language === "ta" || seg.language === "en" ? seg.language : "mixed",
          confidence: 0.9,
        });
      }

      // Small pacing delay between chunks to respect RPM limits on Free Tier
      await new Promise((r) => setTimeout(r, 2000));
    }

    if (fullTranscript.length === 0) {
      throw new Error(`No transcript segments could be parsed for file '${displayName}'.`);
    }

    onProgress({
      stage: "Extracting Meeting Intelligence",
      progress: 80,
      message: "Generating summary and action items...",
    });

    const transcriptForAnalysis = fullTranscript
      .map((s) => `[${s.speaker}] ${s.translatedText}`)
      .join("\n");

    const speakers = [...new Set(fullTranscript.map((s) => s.speaker))];

    const intelligencePrompt = `You are an expert meeting analyst. Analyze this transcript.

TRANSCRIPT:
${transcriptForAnalysis}

SPEAKERS: ${speakers.join(", ") || "None"}

Return JSON matching this structure:
{
  "summary": "2-3 sentence executive summary",
  "decisions": [{"decision": "...", "speaker": "name or null", "context": "...", "confidence": 0.9}],
  "action_items": [{"action": "...", "assignee": "name or null", "deadline": "date or null", "priority": "high|medium|low", "confidence": 0.9}],
  "risks": [{"risk": "...", "speaker": "name or null", "severity": "high|medium|low", "confidence": 0.9}],
  "questions": [{"question": "...", "speaker": "name or null", "answered": true, "answer_summary": "summary or null", "confidence": 0.9}]
}`;

    let rawIntelligence: unknown = {};
    for (const model of ANALYSIS_MODELS) {
      try {
        const intelResponse = await client.models.generateContent({
          model,
          contents: intelligencePrompt,
          config: {
            temperature: TEMPERATURE,
            responseMimeType: "application/json",
          },
        });
        rawIntelligence = safeParseJson<unknown>(intelResponse.text ?? "{}", `Intelligence for ${displayName}`);
        break;
      } catch (intelErr) {
        console.error(`Model ${model} failed for intelligence extraction, trying next model...`);
      }
    }

    const intelligence = normalizeIntelligence(rawIntelligence);
    const maxModelEndTime = fullTranscript.reduce((max, s) => Math.max(max, s.endTime), 0);
    const durationSeconds = headerDurationSeconds ?? Math.ceil(maxModelEndTime);

    return { transcript: fullTranscript, intelligence, durationSeconds };
  } catch (processError: any) {
    console.error(`\n==================================================`);
    console.error(`🔥 ERROR PROCESSING AUDIO FILE: "${displayName}"`);
    console.error(`Message: ${processError?.message || processError}`);
    console.error(`Stack Trace:\n${processError?.stack || processError}`);
    console.error(`==================================================\n`);

    throw processError;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
