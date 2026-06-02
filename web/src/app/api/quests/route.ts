import { ApiError, fail, ok } from "@/lib/api/response";
import { getAuthedRequest } from "@/lib/api/auth";
import { todayInTimezone, DEFAULT_TIMEZONE } from "@/lib/quest/date";
import { createQuestSchema } from "@/lib/validation/quest";

export async function GET() {
  try {
    const { supabase, user } = await getAuthedRequest();
    const { data, error } = await supabase
      .from("quests")
      .select("id,title,main_goal,total_days,status,current_day_number,start_date,created_at,completed_at")
      .eq("user_id", user.id)
      .neq("status", "archived")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return ok({ quests: data ?? [] });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthedRequest();
    const body = await request.json();
    const { quest, planText } = createQuestSchema.parse(body);

    const { count, error: activeCountError } = await supabase
      .from("quests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active");

    if (activeCountError) throw activeCountError;
    if ((count ?? 0) >= 3) {
      throw new ApiError(
        "VALIDATION_ERROR",
        "MVP chỉ hỗ trợ tối đa 3 quest active. Hãy archive bớt quest cũ.",
        400,
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("timezone")
      .eq("id", user.id)
      .maybeSingle();

    const startDate = todayInTimezone(profile?.timezone || DEFAULT_TIMEZONE);

    const { data: insertedQuest, error: questError } = await supabase
      .from("quests")
      .insert({
        user_id: user.id,
        title: quest.title,
        main_goal: quest.mainGoal,
        total_days: quest.totalDays,
        goal_contract: quest.goalContract ?? {
          objective: quest.mainGoal,
          deadline: `Trong ${quest.totalDays} ngay`,
          targetDurationDays: quest.totalDays,
          constraints: [],
          successCriteria: ["Hoan thanh muc tieu chinh dung han."],
          nonNegotiables: ["Muc tieu va deadline cua version hien tai."],
        },
        roadmap: quest.roadmap ?? quest.phases,
        goal_version: 1,
        phases: quest.phases,
        ai_raw_plan: planText ?? null,
        status: "active",
        generation_status: quest.days.length < quest.totalDays ? "partial" : "full",
        generated_up_to_day: quest.days.length,
        generated_window_days: Math.min(7, quest.days.length),
        start_date: startDate,
        current_day_number: 1,
      })
      .select("id,current_day_number")
      .single();

    if (questError) throw questError;

    const dayRows = quest.days.map((day) => ({
      quest_id: insertedQuest.id,
      day_number: day.day,
      title: day.title,
      mentor_speech: day.mentorSpeech,
      missions: day.missions.sort((a, b) => a.order - b.order),
    }));

    const { error: daysError } = await supabase.from("quest_days").insert(dayRows);
    if (daysError) {
      await supabase.from("quests").update({ status: "archived" }).eq("id", insertedQuest.id);
      throw daysError;
    }

    const { error: revisionError } = await supabase.from("quest_goal_revisions").insert({
      user_id: user.id,
      quest_id: insertedQuest.id,
      version_number: 1,
      goal_contract: quest.goalContract ?? {
        objective: quest.mainGoal,
        deadline: `Trong ${quest.totalDays} ngay`,
        targetDurationDays: quest.totalDays,
        constraints: [],
        successCriteria: ["Hoan thanh muc tieu chinh dung han."],
        nonNegotiables: ["Muc tieu va deadline cua version hien tai."],
      },
      roadmap: quest.roadmap ?? quest.phases,
      reason: "Initial adaptive planning contract",
    });
    if (revisionError) throw revisionError;

    return ok({ questId: insertedQuest.id, currentDayNumber: insertedQuest.current_day_number });
  } catch (error) {
    return fail(error);
  }
}
