import { AppError } from "@alreadycovered/shared";
import type { TimetableBlock } from "@alreadycovered/shared";

export function validateNoOverlaps(blocks: Array<Pick<TimetableBlock, "weekday" | "startMinute" | "endMinute">>): void {
  const byWeekday = new Map<number, Array<{ startMinute: number; endMinute: number }>>();
  for (const block of blocks) {
    if (block.endMinute <= block.startMinute) {
      throw new AppError("SCHEDULE_INVALID_RANGE", "A lesson block's end time must be after its start time.");
    }
    const existing = byWeekday.get(block.weekday) ?? [];
    existing.push(block);
    byWeekday.set(block.weekday, existing);
  }

  for (const dayBlocks of byWeekday.values()) {
    const sorted = [...dayBlocks].sort((a, b) => a.startMinute - b.startMinute);
    for (let i = 1; i < sorted.length; i += 1) {
      const previousEnd = sorted[i - 1]!.endMinute;
      const currentStart = sorted[i]!.startMinute;
      if (currentStart < previousEnd) {
        throw new AppError("SCHEDULE_OVERLAP", "Two lesson blocks on the same day overlap in time.");
      }
    }
  }
}

/** Weekday index (0=Sunday) for an ISO yyyy-mm-dd date, interpreted in the given timezone. */
export function weekdayForDate(localDate: string, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" });
  const date = new Date(`${localDate}T12:00:00`);
  const label = formatter.format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[label] ?? date.getUTCDay();
}

export function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function nextSchoolDay(fromDate: Date, timezone: string, enabledWeekdays: Set<number>): string {
  const cursor = new Date(fromDate);
  for (let i = 0; i < 14; i += 1) {
    const isoDate = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(cursor);
    const weekday = weekdayForDate(isoDate, timezone);
    if (enabledWeekdays.has(weekday)) {
      return isoDate;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(fromDate);
}
