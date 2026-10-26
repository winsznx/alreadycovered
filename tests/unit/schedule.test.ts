import { describe, expect, it } from "vitest";
import { isValidIsoDate, validateNoOverlaps, weekdayForDate } from "../../apps/service/src/core/schedule.js";

describe("validateNoOverlaps", () => {
  it("accepts non-overlapping blocks on the same day", () => {
    // #given two back-to-back blocks on Monday
    const blocks = [
      { weekday: 1 as const, startMinute: 540, endMinute: 600 },
      { weekday: 1 as const, startMinute: 600, endMinute: 660 },
    ];
    // #when / #then validating them does not throw
    expect(() => validateNoOverlaps(blocks)).not.toThrow();
  });

  it("rejects overlapping blocks on the same day", () => {
    // #given two blocks on Monday that overlap by 10 minutes
    const blocks = [
      { weekday: 1 as const, startMinute: 540, endMinute: 600 },
      { weekday: 1 as const, startMinute: 590, endMinute: 650 },
    ];
    // #when / #then validating them throws
    expect(() => validateNoOverlaps(blocks)).toThrow();
  });

  it("rejects a block whose end is not after its start", () => {
    // #given a block with endMinute <= startMinute
    const blocks = [{ weekday: 1 as const, startMinute: 600, endMinute: 600 }];
    // #when / #then validating it throws
    expect(() => validateNoOverlaps(blocks)).toThrow();
  });

  it("allows identical time ranges on different weekdays", () => {
    // #given the same time range repeated on two different weekdays
    const blocks = [
      { weekday: 1 as const, startMinute: 540, endMinute: 600 },
      { weekday: 2 as const, startMinute: 540, endMinute: 600 },
    ];
    // #when / #then validating them does not throw
    expect(() => validateNoOverlaps(blocks)).not.toThrow();
  });
});

describe("weekdayForDate", () => {
  it("resolves a known Monday to weekday 1 in the given timezone", () => {
    // #given 2026-11-02, which is a Monday
    // #when computing its weekday in America/New_York
    const weekday = weekdayForDate("2026-11-02", "America/New_York");
    // #then it is Monday (1)
    expect(weekday).toBe(1);
  });
});

describe("isValidIsoDate", () => {
  it("accepts a well-formed ISO date", () => {
    // #given a valid ISO calendar date string
    // #when / #then checking validity returns true
    expect(isValidIsoDate("2026-11-02")).toBe(true);
  });

  it("rejects an ambiguous slash-formatted date", () => {
    // #given an ambiguous non-ISO date string
    // #when / #then checking validity returns false
    expect(isValidIsoDate("10/11/26")).toBe(false);
  });

  it("rejects a nonsense date string", () => {
    // #given garbage input
    // #when / #then checking validity returns false
    expect(isValidIsoDate("not-a-date")).toBe(false);
  });
});
