import { describe, expect, it } from "vitest";
import { getShowtimeEndAt, isWithinSchedulingWindow, showtimesOverlap } from "./showtimeUtils.js";

describe("showtimeUtils", () => {
  it("calculates end time from movie runtime", () => {
    expect(getShowtimeEndAt({ startsAt: new Date("2026-06-10T10:00:00.000Z"), durationMin: 150 }).toISOString()).toBe(
      "2026-06-10T12:30:00.000Z"
    );
  });

  it("detects overlaps including the cleaning buffer", () => {
    const first = { startsAt: new Date("2026-06-10T10:00:00.000Z"), durationMin: 120, cleaningBufferMin: 30 };

    expect(showtimesOverlap(first, { startsAt: new Date("2026-06-10T12:15:00.000Z"), durationMin: 90, cleaningBufferMin: 30 })).toBe(true);
    expect(showtimesOverlap(first, { startsAt: new Date("2026-06-10T12:30:00.000Z"), durationMin: 90, cleaningBufferMin: 30 })).toBe(false);
  });

  it("allows only future showtimes within 30 days", () => {
    const now = new Date("2026-06-10T10:00:00.000Z");

    expect(isWithinSchedulingWindow(new Date("2026-06-10T09:59:00.000Z"), now)).toBe(false);
    expect(isWithinSchedulingWindow(new Date("2026-07-10T10:00:00.000Z"), now)).toBe(true);
    expect(isWithinSchedulingWindow(new Date("2026-07-10T10:01:00.000Z"), now)).toBe(false);
  });
});
