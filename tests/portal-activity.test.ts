import { describe, expect, it } from "vitest";
import { calculateVisitStreak } from "../src/lib/portal-activity";

const TZ = "America/Argentina/Buenos_Aires";
const now = new Date("2026-09-03T15:00:00-03:00");

describe("member visit streak", () => {
  it("counts consecutive calendar days including today", () => {
    expect(calculateVisitStreak([
      "2026-09-03T08:00:00-03:00",
      "2026-09-02T21:30:00-03:00",
      "2026-09-01T06:00:00-03:00",
    ], now, TZ)).toBe(3);
  });

  it("keeps yesterday's streak alive before today's visit", () => {
    expect(calculateVisitStreak([
      "2026-09-02T12:00:00-03:00",
      "2026-09-01T12:00:00-03:00",
    ], now, TZ)).toBe(2);
  });

  it("resets after a full missed calendar day", () => {
    expect(calculateVisitStreak([
      "2026-09-01T23:30:00-03:00",
      "2026-08-31T09:00:00-03:00",
    ], now, TZ)).toBe(0);
  });

  it("does not count multiple visits on the same day twice", () => {
    expect(calculateVisitStreak([
      "2026-09-03T07:00:00-03:00",
      "2026-09-03T19:00:00-03:00",
      "2026-09-02T10:00:00-03:00",
    ], now, TZ)).toBe(2);
  });

  it("uses the gym timezone around UTC midnight", () => {
    expect(calculateVisitStreak([
      "2026-09-04T01:30:00Z", // 03/09 22:30 en Buenos Aires
      "2026-09-03T02:30:00Z", // 02/09 23:30 en Buenos Aires
    ], now, TZ)).toBe(2);
  });
});
