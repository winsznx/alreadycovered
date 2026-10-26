export function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${String(m).padStart(2, "0")} ${period}`;
}

const STATE_LABELS: Record<string, string> = {
  preparing: "Preparing",
  needs_attention: "Needs attention",
  ready_for_review: "Ready for review",
  reviewed: "Reviewed",
  stale: "Outdated",
  failed: "Failed",
};

export function packetStateLabel(state: string): string {
  return STATE_LABELS[state] ?? state;
}

export function packetStateTone(state: string): "verified" | "review" | "blocking" {
  if (state === "reviewed") return "verified";
  if (state === "needs_attention" || state === "stale" || state === "failed") return "blocking";
  return "review";
}

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function weekdayLabel(weekday: number): string {
  return WEEKDAY_LABELS[weekday] ?? "";
}
