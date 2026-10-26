type Tone = "verified" | "review" | "blocking" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  verified: "bg-verified-soft text-verified",
  review: "bg-review-soft text-review",
  blocking: "bg-blocking-soft text-blocking",
  neutral: "bg-surface-muted text-ink-secondary",
};

const TONE_ICON: Record<Tone, string> = {
  verified: "✓",
  review: "●",
  blocking: "⚠",
  neutral: "•",
};

export function StatusTag({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${TONE_CLASSES[tone]}`}>
      <span aria-hidden>{TONE_ICON[tone]}</span>
      {label}
    </span>
  );
}
