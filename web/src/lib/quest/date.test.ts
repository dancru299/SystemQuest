import { describe, expect, it, vi } from "vitest";
import { expectedQuestDay } from "@/lib/quest/date";

describe("quest day date math", () => {
  it("uses local timezone date for expected quest day", () => {
    vi.setSystemTime(new Date("2026-06-02T17:30:00.000Z"));
    expect(expectedQuestDay("2026-06-02", "Asia/Ho_Chi_Minh")).toBe(2);
    vi.useRealTimers();
  });
});

