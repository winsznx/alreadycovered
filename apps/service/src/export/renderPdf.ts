import { chromium } from "playwright";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type PacketPdfBlock = {
  subject: string;
  startLabel: string;
  endLabel: string;
  lessonTitle: string | null;
  objective: string | null;
  steps: string[];
  materialsLabel: string | null;
  sourceReference: string | null;
  unresolved: string[];
};

export type PacketPdfData = {
  classLabel: string;
  dateLabel: string;
  teacherDisplayName?: string;
  preparedAtLabel: string;
  revision: number;
  statusLabel: string;
  exportedWithWarnings: boolean;
  blocks: PacketPdfBlock[];
  routines: Array<{ title: string; text: string }>;
  needsAttention: string[];
}

function renderHtml(data: PacketPdfData): string {
  const warningBanner = data.exportedWithWarnings
    ? `<div class="warning-banner">This packet was exported with ${data.needsAttention.length} unresolved item(s). See "Needs teacher attention" below.</div>`
    : "";

  const blocksHtml = data.blocks
    .map(
      (b) => `
      <section class="lesson">
        <h2>${escapeHtml(b.startLabel)}&ndash;${escapeHtml(b.endLabel)} &middot; ${escapeHtml(b.subject)}</h2>
        ${b.lessonTitle ? `<p class="lesson-title">${escapeHtml(b.lessonTitle)}</p>` : ""}
        ${b.objective ? `<p class="objective"><strong>Objective:</strong> ${escapeHtml(b.objective)}</p>` : `<p class="objective muted">Objective: not grounded in available material - needs review.</p>`}
        ${
          b.steps.length > 0
            ? `<ol class="steps">${b.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>`
            : `<p class="muted">No substitute-facing steps are available yet for this lesson.</p>`
        }
        ${b.materialsLabel ? `<p class="materials"><strong>Materials:</strong> ${escapeHtml(b.materialsLabel)}</p>` : ""}
        ${b.sourceReference ? `<p class="source-ref">Source: ${escapeHtml(b.sourceReference)}</p>` : ""}
        ${b.unresolved.length > 0 ? `<div class="block-warning"><strong>Needs teacher attention:</strong><ul>${b.unresolved.map((u) => `<li>${escapeHtml(u)}</li>`).join("")}</ul></div>` : ""}
      </section>`,
    )
    .join("\n");

  const routinesHtml =
    data.routines.length > 0
      ? `<section class="routines"><h2>Classroom routines (provided by the teacher)</h2>${data.routines
          .map((r) => `<p><strong>${escapeHtml(r.title)}:</strong> ${escapeHtml(r.text)}</p>`)
          .join("")}</section>`
      : `<section class="routines"><h2>Classroom routines</h2><p class="muted">No verified classroom routines were included in this packet.</p></section>`;

  const attentionHtml =
    data.needsAttention.length > 0
      ? `<section class="attention"><h2>Needs teacher attention</h2><ul>${data.needsAttention
          .map((i) => `<li>${escapeHtml(i)}</li>`)
          .join("")}</ul></section>`
      : "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { margin: 22mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; color: #111; font-size: 12pt; line-height: 1.45; }
  header { border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 18px; }
  header h1 { font-size: 20pt; margin: 0 0 4px; }
  header .meta { font-size: 10pt; color: #333; }
  .warning-banner { border: 2px solid #b35900; background: #fff4e6; color: #5a3600; padding: 10px 12px; margin-bottom: 16px; font-weight: bold; }
  .schedule-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  .schedule-table th, .schedule-table td { border: 1px solid #999; padding: 6px 8px; text-align: left; font-size: 10.5pt; }
  .lesson { page-break-inside: avoid; margin-bottom: 20px; border-top: 1px solid #ccc; padding-top: 12px; }
  .lesson h2 { font-size: 13pt; margin: 0 0 6px; }
  .lesson-title { font-weight: bold; margin: 0 0 6px; }
  .muted { color: #666; font-style: italic; }
  .steps { margin: 8px 0; padding-left: 22px; }
  .source-ref { font-size: 9.5pt; color: #444; }
  .block-warning { background: #fff4e6; border: 1px solid #c98a14; padding: 8px 10px; margin-top: 8px; font-size: 10.5pt; }
  .attention { border: 2px solid #c22; padding: 10px 12px; margin-bottom: 20px; }
  .attention h2 { color: #c22; margin-top: 0; }
  .routines { margin-bottom: 20px; }
  .notes-page { page-break-before: always; }
  .notes-line { border-bottom: 1px solid #999; height: 26px; }
  footer { font-size: 9pt; color: #777; margin-top: 24px; }
</style>
</head>
<body>
  <header>
    <h1>Substitute Teaching Plan</h1>
    <div class="meta">
      ${escapeHtml(data.classLabel)} &middot; ${escapeHtml(data.dateLabel)}<br/>
      ${data.teacherDisplayName ? `Prepared by ${escapeHtml(data.teacherDisplayName)} &middot; ` : ""}Prepared ${escapeHtml(data.preparedAtLabel)} &middot; Revision ${data.revision} &middot; ${escapeHtml(data.statusLabel)}
    </div>
  </header>
  ${warningBanner}
  <table class="schedule-table">
    <thead><tr><th>Time</th><th>Subject</th></tr></thead>
    <tbody>
      ${data.blocks.map((b) => `<tr><td>${escapeHtml(b.startLabel)}&ndash;${escapeHtml(b.endLabel)}</td><td>${escapeHtml(b.subject)}</td></tr>`).join("")}
    </tbody>
  </table>
  ${blocksHtml}
  ${routinesHtml}
  ${attentionHtml}
  <section class="notes-page">
    <h2>Substitute's end-of-day notes</h2>
    <p class="muted">Please leave notes for the returning teacher.</p>
    <p><strong>Completed work</strong></p>
    <div class="notes-line"></div><div class="notes-line"></div><div class="notes-line"></div>
    <p><strong>Anything that changed from the plan</strong></p>
    <div class="notes-line"></div><div class="notes-line"></div><div class="notes-line"></div>
    <p><strong>Follow-ups for the returning teacher</strong></p>
    <div class="notes-line"></div><div class="notes-line"></div><div class="notes-line"></div>
  </section>
  <footer>Generated by AlreadyCovered from your own uploaded files. Nothing in this document was sent to the school or another person - sharing it is up to you.</footer>
</body>
</html>`;
}

/**
 * Renders the packet to a real PDF via headless Chromium (Playwright).
 * Remote resource fetching and JS execution during render are both disabled by
 * design: the HTML above has no external references and no <script> tags.
 */
export async function renderPacketPdf(data: PacketPdfData): Promise<Buffer> {
  const browser = await chromium.launch({ args: ["--disable-extensions"] });
  try {
    const page = await browser.newPage();
    await page.route("**/*", (route) => {
      // Defense in depth: this document never references external resources,
      // but refuse any such request outright rather than trusting that.
      if (route.request().url().startsWith("data:") || route.request().url() === "about:blank") {
        return route.continue();
      }
      return route.abort();
    });
    await page.setContent(renderHtml(data), { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
    return pdf;
  } finally {
    await browser.close();
  }
}
