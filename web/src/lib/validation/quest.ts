import { z } from "zod";

export const missionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  desc: z.string().min(1).max(1200),
  type: z.enum(["main", "bonus", "rest"]),
  xp_reward: z.number().int().min(0).max(500),
  order: z.number().int().min(1),
});

export const phaseSchema = z.object({
  name: z.string().min(1).max(120),
  desc: z.string().min(1).max(800),
  dayRange: z.string().min(1).max(80),
});

export const questDaySchema = z.object({
  day: z.number().int().min(1).max(30),
  title: z.string().min(1).max(160),
  mentorSpeech: z.string().min(1).max(1000).optional().default(""),
  missions: z
    .array(missionSchema)
    .min(1)
    .max(4)
    .refine((missions) => missions.some((mission) => mission.type === "main"), {
      message: "Each quest day needs at least one main mission.",
    }),
});

export const aiQuestSchema = z
  .object({
    title: z.string().min(1).max(80),
    mainGoal: z.string().min(1).max(2000),
    totalDays: z.number().int().min(1).max(30),
    phases: z.array(phaseSchema).min(1).max(8),
    days: z.array(questDaySchema).min(1).max(30),
  })
  .superRefine((quest, ctx) => {
    if (quest.days.length !== quest.totalDays) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "days.length must match totalDays",
        path: ["days"],
      });
    }

    const dayNumbers = new Set(quest.days.map((day) => day.day));
    for (let day = 1; day <= quest.totalDays; day += 1) {
      if (!dayNumbers.has(day)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Missing day ${day}`,
          path: ["days"],
        });
      }
    }
  });

export const analyzePlanSchema = z.object({
  planText: z.string().trim().min(50).max(10000),
});

export const createQuestSchema = z.object({
  quest: aiQuestSchema,
  planText: z.string().trim().min(50).max(10000).optional(),
});

export type Mission = z.infer<typeof missionSchema>;
export type Phase = z.infer<typeof phaseSchema>;
export type AiQuestDay = z.infer<typeof questDaySchema>;
export type AiQuest = z.infer<typeof aiQuestSchema>;

