import { describe, expect, it } from "vitest";
import { isMembershipActive, membershipSnapshot } from "../src/lib/membership-state";

describe("membership status", () => {
  const now = new Date("2026-09-03T15:00:00-03:00");

  it("treats a membership that expires today as active until end of day", () => {
    const snapshot = membershipSnapshot("2026-09-03T00:00:00-03:00", now);
    expect(snapshot.active).toBe(true);
    expect(snapshot.state).toBe("expiring");
  });

  it("marks an already expired membership as expired", () => {
    const snapshot = membershipSnapshot("2026-09-02T00:00:00-03:00", now);
    expect(snapshot.active).toBe(false);
    expect(snapshot.state).toBe("expired");
  });

  it("distinguishes memberships expiring within seven days", () => {
    expect(membershipSnapshot("2026-09-10T00:00:00-03:00", now).state).toBe("expiring");
    expect(membershipSnapshot("2026-09-11T00:00:00-03:00", now).state).toBe("active");
  });

  it("handles missing and invalid dates as no membership", () => {
    expect(membershipSnapshot(null, now).state).toBe("none");
    expect(membershipSnapshot("not-a-date", now).state).toBe("none");
  });

  it("exposes a boolean helper for operational checks", () => {
    expect(isMembershipActive("2026-09-03T00:00:00-03:00", now)).toBe(true);
    expect(isMembershipActive("2026-09-02T00:00:00-03:00", now)).toBe(false);
  });
});
