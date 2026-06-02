import { describe, expect, it } from "vitest";
import { parseAiQuest } from "@/lib/quest/ai";

const validQuestJson = JSON.stringify({
  title: "React Quest",
  mainGoal: "Hoc React trong 7 ngay bang cac buoc cu the.",
  totalDays: 1,
  phases: [{ name: "Nen Tang", desc: "Bat dau", dayRange: "Ngay 1" }],
  days: [
    {
      day: 1,
      title: "Mo Cong",
      mentorSpeech: "Hay bat dau bang buoc nho.",
      missions: [
        {
          id: "m_001",
          title: "Cai dat moi truong",
          desc: "Tao project va chay dev server.",
          type: "main",
          xp_reward: 50,
          order: 1,
        },
      ],
    },
  ],
});

describe("AI quest parser", () => {
  it("accepts plain JSON", () => {
    expect(parseAiQuest(validQuestJson).title).toBe("React Quest");
  });

  it("strips markdown JSON fences", () => {
    expect(parseAiQuest(`\`\`\`json\n${validQuestJson}\n\`\`\``).totalDays).toBe(1);
  });

  it("repairs totalDays when provider returns fewer day objects", () => {
    const partialQuest = JSON.parse(validQuestJson);
    partialQuest.totalDays = 30;
    partialQuest.days = Array.from({ length: 7 }, (_, index) => ({
      ...partialQuest.days[0],
      day: index + 1,
      title: `Day ${index + 1}`,
    }));
    partialQuest.phases = [
      { name: "Phase 1", desc: "Start", dayRange: "Ngay 1-30" },
    ];

    const parsed = parseAiQuest(JSON.stringify(partialQuest));
    expect(parsed.totalDays).toBe(7);
    expect(parsed.days).toHaveLength(7);
    expect(parsed.days[6].day).toBe(7);
    expect(parsed.phases[0].dayRange).toBe("Ngay 1-7");
  });

  it("parses fenced provider output with trailing commas", () => {
    const dirtyJson = `Here is the json:\n\`\`\`json\n${validQuestJson.replace(
      /"order":1/g,
      '"order":1,',
    )}\n\`\`\``;

    expect(parseAiQuest(dirtyJson).title).toBe("React Quest");
  });
});
