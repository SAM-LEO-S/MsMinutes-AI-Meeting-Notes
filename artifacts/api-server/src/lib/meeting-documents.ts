import PDFDocument from "pdfkit";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type { Meeting } from "@workspace/db";

function formattedDate(value: Date): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(value);
}

function timestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function addPdfHeading(document: PDFKit.PDFDocument, text: string): void {
  document.moveDown(0.8);
  document.font("Helvetica-Bold").fontSize(13).fillColor("#3730a3").text(text);
  document.moveDown(0.35);
  document.font("Helvetica").fontSize(10).fillColor("#263047");
}

export function createMeetingPdf(meeting: Meeting): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: "A4", margin: 54, bufferPages: true });
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));

    document.font("Helvetica-Bold").fontSize(22).fillColor("#202749").text(meeting.title);
    document.moveDown(0.45);
    document.font("Helvetica").fontSize(9).fillColor("#64708a")
      .text(`${formattedDate(meeting.createdAt)}  ·  ${Math.floor(meeting.durationSeconds / 60)} min`);
    addPdfHeading(document, "Meeting summary");
    document.fontSize(10).fillColor("#263047").text(meeting.intelligence.summary, { lineGap: 3 });

    addPdfHeading(document, "Decisions");
    if (meeting.intelligence.decisions.length === 0) {
      document.text("No decisions identified.");
    } else {
      for (const item of meeting.intelligence.decisions) {
        document.font("Helvetica-Bold").text(`• ${item.decision}`, { continued: false });
        document.font("Helvetica").fontSize(9).fillColor("#64708a")
          .text([item.speaker, item.context].filter(Boolean).join(" · "));
        document.moveDown(0.35);
      }
    }

    addPdfHeading(document, "Action items");
    if (meeting.intelligence.actionItems.length === 0) {
      document.text("No action items identified.");
    } else {
      for (const item of meeting.intelligence.actionItems) {
        document.font("Helvetica-Bold").text(`• ${item.action}`);
        document.font("Helvetica").fontSize(9).fillColor("#64708a")
          .text([item.assignee, item.deadline, `${item.priority} priority`].filter(Boolean).join(" · "));
        document.moveDown(0.35);
      }
    }

    addPdfHeading(document, "Risks and questions");
    if (meeting.intelligence.risks.length === 0 && meeting.intelligence.questions.length === 0) {
      document.text("No risks or open questions identified.");
    }
    for (const item of meeting.intelligence.risks) {
      document.font("Helvetica-Bold").text(`Risk: ${item.risk}`);
      document.font("Helvetica").fontSize(9).fillColor("#64708a")
        .text([item.speaker, `${item.severity} severity`].filter(Boolean).join(" · "));
      document.moveDown(0.3);
    }
    for (const item of meeting.intelligence.questions) {
      document.font("Helvetica-Bold").text(`Question: ${item.question}`);
      document.font("Helvetica").fontSize(9).fillColor("#64708a")
        .text(item.answered ? `Answered${item.answerSummary ? ` · ${item.answerSummary}` : ""}` : "Open");
      document.moveDown(0.3);
    }

    addPdfHeading(document, "Transcript · English translation");
    for (const segment of meeting.transcript) {
      document.font("Helvetica-Bold").fontSize(9).fillColor("#3730a3")
        .text(`${segment.speaker}  ·  ${timestamp(segment.startTime)}`);
      document.font("Helvetica").fontSize(10).fillColor("#263047")
        .text(segment.translatedText, { lineGap: 2 });
      document.moveDown(0.45);
    }
    document.fontSize(8).fillColor("#64708a")
      .text("The Word export includes both the original transcript and English translation.");
    document.end();
  });
}

type ParagraphOptions = Extract<ConstructorParameters<typeof Paragraph>[0], object>;

function paragraph(text: string, options: ParagraphOptions = {}): Paragraph {
  return new Paragraph({ text, ...options });
}

export async function createMeetingDocx(meeting: Meeting): Promise<Buffer> {
  const children: Paragraph[] = [
    paragraph(meeting.title, { heading: HeadingLevel.TITLE }),
    paragraph(`${formattedDate(meeting.createdAt)} · ${Math.floor(meeting.durationSeconds / 60)} min`, {
      alignment: AlignmentType.LEFT,
      spacing: { after: 220 },
    }),
    paragraph("Meeting summary", { heading: HeadingLevel.HEADING_1 }),
    paragraph(meeting.intelligence.summary),
    paragraph("Decisions", { heading: HeadingLevel.HEADING_1 }),
  ];

  if (meeting.intelligence.decisions.length === 0) {
    children.push(paragraph("No decisions identified."));
  }
  for (const item of meeting.intelligence.decisions) {
    children.push(paragraph(item.decision, { bullet: { level: 0 } }));
    children.push(paragraph([item.speaker, item.context].filter(Boolean).join(" · ")));
  }

  children.push(paragraph("Action items", { heading: HeadingLevel.HEADING_1 }));
  if (meeting.intelligence.actionItems.length === 0) {
    children.push(paragraph("No action items identified."));
  }
  for (const item of meeting.intelligence.actionItems) {
    children.push(paragraph(item.action, { bullet: { level: 0 } }));
    children.push(paragraph(
      [item.assignee, item.deadline, `${item.priority} priority`].filter(Boolean).join(" · "),
    ));
  }

  children.push(paragraph("Risks", { heading: HeadingLevel.HEADING_1 }));
  if (meeting.intelligence.risks.length === 0) {
    children.push(paragraph("No risks identified."));
  }
  for (const item of meeting.intelligence.risks) {
    children.push(paragraph(item.risk, { bullet: { level: 0 } }));
    children.push(paragraph([item.speaker, `${item.severity} severity`].filter(Boolean).join(" · ")));
  }

  children.push(paragraph("Questions", { heading: HeadingLevel.HEADING_1 }));
  if (meeting.intelligence.questions.length === 0) {
    children.push(paragraph("No questions identified."));
  }
  for (const item of meeting.intelligence.questions) {
    children.push(paragraph(item.question, { bullet: { level: 0 } }));
    children.push(paragraph(
      `${item.answered ? "Answered" : "Open"}${item.answerSummary ? ` · ${item.answerSummary}` : ""}`,
    ));
  }

  children.push(paragraph("Transcript", { heading: HeadingLevel.HEADING_1 }));
  for (const segment of meeting.transcript) {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `${segment.speaker} · ${timestamp(segment.startTime)}`, bold: true }),
      ],
      spacing: { before: 180, after: 80 },
    }));
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `Original (${segment.language}): `, bold: true }),
        new TextRun(segment.originalText),
      ],
      spacing: { after: 80 },
    }));
    children.push(new Paragraph({
      children: [
        new TextRun({ text: "English translation: ", bold: true }),
        new TextRun(segment.translatedText),
      ],
      spacing: { after: 120 },
    }));
  }

  return Packer.toBuffer(new Document({
    sections: [{ properties: {}, children }],
  }));
}
