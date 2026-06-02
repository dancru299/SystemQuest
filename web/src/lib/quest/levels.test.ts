import { describe, expect, it } from "vitest";
import { getLevelForXp, getLevelProgress } from "@/lib/quest/levels";

describe("level thresholds", () => {
  it("maps accumulated XP to the expected level", () => {
    expect(getLevelForXp(0).level).toBe(1);
    expect(getLevelForXp(500).level).toBe(2);
    expect(getLevelForXp(1500).level).toBe(3);
    expect(getLevelForXp(3500).level).toBe(4);
    expect(getLevelForXp(7000).level).toBe(5);
  });

  it("reports progress toward the next level", () => {
    const progress = getLevelProgress(250);
    expect(progress.current.level).toBe(1);
    expect(progress.next?.level).toBe(2);
    expect(progress.percent).toBe(50);
  });
});

