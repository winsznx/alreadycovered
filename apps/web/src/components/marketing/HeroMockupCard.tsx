const ROWS = [
  { time: "9:00–10:00 AM", subject: "Mathematics", status: "Reviewed", tone: "verified" as const },
  { time: "10:30–11:30 AM", subject: "Reading", status: "Needs review", tone: "review" as const },
  { time: "1:00–1:45 PM", subject: "Science", status: "Missing material", tone: "blocking" as const },
];

const TONE_CLASSES: Record<"verified" | "review" | "blocking", string> = {
  verified: "bg-verified-soft text-verified",
  review: "bg-review-soft text-review",
  blocking: "bg-blocking-soft text-blocking",
};

/** Illustrative static mockup of the real packet-review screen - not a live embed. */
export function HeroMockupCard() {
  return (
    <div className="w-full max-w-sm rounded-card border border-border bg-surface p-5 shadow-[var(--shadow-card)]" aria-hidden="true">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <p className="text-sm font-semibold text-ink">Grade 4A · Mon, Nov 2</p>
          <p className="text-xs text-ink-muted">Private to your account</p>
        </div>
        <span className="rounded-full bg-review-soft px-2.5 py-1 text-xs font-medium text-review">Needs attention</span>
      </div>

      <ul className="mt-4 space-y-2">
        {ROWS.map((row) => (
          <li key={row.subject} className="flex items-center justify-between rounded-control border border-border px-3 py-2">
            <div>
              <p className="text-xs text-ink-muted">{row.time}</p>
              <p className="text-sm font-medium text-ink">{row.subject}</p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE_CLASSES[row.tone]}`}>{row.status}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-control bg-surface-muted p-3 text-xs text-ink-secondary">
        Source: <span className="font-medium text-ink">fractions-worksheet.pdf, page 1</span>
      </div>
    </div>
  );
}
