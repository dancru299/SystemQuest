import { describe, expect, it } from "vitest";
import { getDayProgress, isDayComplete } from "@/lib/quest/progress";
import type { Mission } from "@/lib/validation/quest";

const missions: Mission[] = [
  { id: "m_001", title: "Main", desc: "Do main", type: "main", xp_reward: 50, order: 1 },
  { id: "m_002", title: "Bonus", desc: "Do bonus", type: "bonus", xp_reward: 30, order: 2 },
];

describe("quest progress", () => {
  it("calculates percentage from completed mission ids", () => {
    expect(getDayProgress(missions, ["m_001"])).toEqual({
      completed: 1,
      total: 2,
      percentage: 50,
    });
  });

  it("marks a day complete only when all main missions are complete", () => {
    expect(isDayComplete(missions, ["m_002"])).toBe(false);
    expect(isDayComplete(missions, ["m_001"])).toBe(true);
  });
});

