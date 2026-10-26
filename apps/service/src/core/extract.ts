import { readFile } from "node:fs/promises";
import type { SupportedExtension } from "@alreadycovered/shared";

export const MAX_SOURCE_FILE_BYTES = 25 * 1024 * 1024; // 25MB per file cap (PRD §8.2.A)
export const MAX_EXTRACTED_CHARS = 400_000; // guard against pathological documents

export type ExtractedSection = {
  heading?: string;
  pageStart?: number;
  pageEnd?: number;
  text: string;
};

export type ExtractionResult =
  | { ok: true; sections: ExtractedSection[]; warnings: string[] }
  | { ok: false; errorCode: "SOURCE_TEXT_NOT_AVAILABLE" | "SOURCE_TOO_LARGE" | "SOURCE_FILE_UNREADABLE"; message: string };

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdf(absolutePath: string): Promise<ExtractionResult> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = await readFile(absolutePath);
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(data),
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
  }).promise;

  const sections: ExtractedSection[] = [];
  let totalChars = 0;
  let pagesWithText = 0;

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = normalizeWhitespace(
      content.items.map((item) => ("str" in item ? item.str : "")).join(" "),
    );
    if (pageText.length > 0) {
      pagesWithText += 1;
      totalChars += pageText.length;
      sections.push({ pageStart: pageNumber, pageEnd: pageNumber, text: pageText });
    }
    if (totalChars > MAX_EXTRACTED_CHARS) break;
  }
  await doc.destroy();

  if (pagesWithText === 0) {
    return {
      ok: false,
      errorCode: "SOURCE_TEXT_NOT_AVAILABLE",
      message: "No readable text layer was found (the PDF may be scanned/image-only).",
    };
  }

  const warnings: string[] = [];
  if (pagesWithText < doc.numPages) {
    warnings.push(`${doc.numPages - pagesWithText} of ${doc.numPages} pages had no extractable text.`);
  }
  return { ok: true, sections, warnings };
}

async function extractDocx(absolutePath: string): Promise<ExtractionResult> {
  const mammoth = await import("mammoth");
  const buffer = await readFile(absolutePath);
  const result = await mammoth.extractRawText({ buffer });
  const text = normalizeWhitespace(result.value);
  if (text.length === 0) {
    return { ok: false, errorCode: "SOURCE_TEXT_NOT_AVAILABLE", message: "The document contained no extractable text." };
  }

  // DOCX has no reliable page numbers (PRD §8.2.B) - split into paragraph-numbered sections instead.
  const paragraphs = text.split("\n\n").filter((p) => p.trim().length > 0);
  const sections: ExtractedSection[] = paragraphs.map((paragraph, index) => ({
    heading: `Paragraph ${index + 1}`,
    text: paragraph.trim(),
  }));

  return { ok: true, sections, warnings: result.messages.map((m) => m.message) };
}

async function extractPlainText(absolutePath: string): Promise<ExtractionResult> {
  const raw = await readFile(absolutePath, "utf-8");
  const text = normalizeWhitespace(raw);
  if (text.length === 0) {
    return { ok: false, errorCode: "SOURCE_TEXT_NOT_AVAILABLE", message: "The file is empty." };
  }

  const lines = text.split("\n");
  const sections: ExtractedSection[] = [];
  let currentHeading: string | undefined;
  let buffer: string[] = [];
  let startLine = 1;

  const flush = (endLine: number) => {
    const body = buffer.join("\n").trim();
    if (body.length > 0) {
      sections.push({ heading: currentHeading, pageStart: startLine, pageEnd: endLine, text: body });
    }
    buffer = [];
  };

  lines.forEach((line, idx) => {
    const headingMatch = /^#{1,6}\s+(.*)/.exec(line);
    if (headingMatch) {
      flush(idx);
      currentHeading = headingMatch[1]!.trim();
      startLine = idx + 2;
      return;
    }
    buffer.push(line);
  });
  flush(lines.length);

  if (sections.length === 0) {
    sections.push({ pageStart: 1, pageEnd: lines.length, text });
  }

  return { ok: true, sections, warnings: [] };
}

export async function extractSource(absolutePath: string, extension: SupportedExtension): Promise<ExtractionResult> {
  try {
    switch (extension) {
      case ".pdf":
        return await extractPdf(absolutePath);
      case ".docx":
        return await extractDocx(absolutePath);
      case ".txt":
      case ".md":
        return await extractPlainText(absolutePath);
    }
  } catch (error) {
    return {
      ok: false,
      errorCode: "SOURCE_FILE_UNREADABLE",
      message: error instanceof Error ? error.message : "The file could not be parsed.",
    };
  }
}
