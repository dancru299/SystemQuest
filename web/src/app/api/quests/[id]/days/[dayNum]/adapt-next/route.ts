import { ApiError, fail, ok } from "@/lib/api/response";
import { getAuthedRequest } from "@/lib/api/auth";
import { adaptNextDayWithAi } from "@/lib/quest/ai";
import { missionSchema } from "@/lib/validation/quest";
import { z } from "zod";

const missionsSchema = z.array(missionSchema);

type RouteContext = {
  params: Promise<{ id: string; dayNum: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id, dayNum } = await context.params;
    const dayNumber = Number(dayNum);
    if (!Number.isInteger(dayNumber) || dayNumber < 1) {
      throw new ApiError("VALIDATION_ERROR", "Quest day khong hop le.", 400);
    }

    const { supabase, user } = await getAuthedRequest();
    const { data: quest, error: questError } = await supabase
      .from("quests")
      .select(
        "id,title,main_goal,total_days,current_day_number,generated_up_to_day,goal_contract,roadmap,status",
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (questError || !quest) {
      throw new ApiError("QUEST_NOT_FOUND", "Quest khong ton tai hoac khong thuoc ve ban.", 404);
    }
    if (dayNumber >= quest.total_days) {
      throw new ApiError("VALIDATION_ERROR", "Quest da o ngay cuoi cung.", 400);
    }
    if (dayNumber > quest.current_day_number) {
      throw new ApiError("QUEST_DAY_LOCKED", "Ngay nay chua mo khoa.", 403);
    }

    const { data: previousDay, error: previousDayError } = await supabase
      .from("quest_days")
      .select("id,day_number,title,mentor_speech,missions,completed_mission_ids,is_day_completed")
      .eq("quest_id", id)
      .eq("day_number", dayNumber)
      .single();

    if (previousDayError || !previousDay) {
      throw new ApiError("QUEST_DAY_NOT_FOUND", "Ngay nhiem vu khong ton tai.", 404);
    }

    const { data: report } = await supabase
      .from("quest_day_reports")
      .select(
        "overall_completion_percent,time_spent_minutes,blockers,outcome,notes,evidence_url,mission_reports,submitted_at",
      )
      .eq("quest_day_id", previousDay.id)
      .eq("user_id", user.id)
      .maybeSingle();

    const nextDayNumber = dayNumber + 1;
    const aiResult = await adaptNextDayWithAi({
      questTitle: quest.title,
      mainGoal: quest.main_goal,
      totalDays: quest.total_days,
      nextDayNumber,
      goalContract: quest.goal_contract,
      roadmap: quest.roadmap,
      previousDay: {
        ...previousDay,
        missions: missionsSchema.parse(previousDay.missions),
      },
      report: report ?? null,
    });

    const { data: nextDay, error: upsertError } = await supabase
      .from("quest_days")
      .upsert(
        {
          quest_id: id,
          day_number: nextDayNumber,
          title: aiResult.day.title,
          mentor_speech: aiResult.day.mentorSpeech,
          missions: aiResult.day.missions.sort((a, b) => a.order - b.order),
        },
        { onConflict: "quest_id,day_number" },
      )
      .select("id,day_number,title,mentor_speech,missions")
      .single();

    if (upsertError) throw upsertError;

    const nextCurrentDayNumber = Math.max(quest.current_day_number, nextDayNumber);
    const { error: questUpdateError } = await supabase
      .from("quests")
      .update({
        current_day_number: nextCurrentDayNumber,
        generated_up_to_day: Math.max(quest.generated_up_to_day ?? 0, nextDayNumber),
        generation_status: nextDayNumber >= quest.total_days ? "full" : "partial",
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (questUpdateError) throw questUpdateError;

    return ok({
      day: nextDay,
      currentDayNumber: nextCurrentDayNumber,
      generatedUpToDay: Math.max(quest.generated_up_to_day ?? 0, nextDayNumber),
      provider: aiResult.provider,
      model: aiResult.model,
    });
  } catch (error) {
    return fail(error);
  }
}
