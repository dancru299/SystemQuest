import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { QuestDayClient } from "@/components/quest/QuestDayClient";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { expectedQuestDay, DEFAULT_TIMEZONE } from "@/lib/quest/date";
import { missionSchema } from "@/lib/validation/quest";

type PageProps = {
  params: Promise<{ id: string; dayNum: string }>;
};

const missionsSchema = z.array(missionSchema);
const idsSchema = z.array(z.string());

export default async function QuestDayPage({ params }: PageProps) {
  if (!hasSupabaseEnv()) return null;

  const { id, dayNum } = await params;
  const dayNumber = Number(dayNum);
  if (!Number.isInteger(dayNumber) || dayNumber < 1) notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/app/quests/${id}/days/${dayNum}`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();

  const { data: quest } = await supabase
    .from("quests")
    .select("id,title,total_days,current_day_number,generated_up_to_day,start_date,status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!quest) notFound();
  const generatedUpToDay = Math.max(1, quest.generated_up_to_day ?? 1);
  const unlockedDayNumber = Math.min(quest.current_day_number ?? 1, quest.total_days, generatedUpToDay);
  if (dayNumber > quest.total_days || dayNumber > generatedUpToDay || dayNumber > unlockedDayNumber) {
    redirect(`/app/quests/${id}/days/${unlockedDayNumber}`);
  }

  const { data: days } = await supabase
    .from("quest_days")
    .select("*")
    .eq("quest_id", id)
    .order("day_number", { ascending: true });

  const selectedDay = days?.find((day) => day.day_number === dayNumber);
  if (!selectedDay || !days) notFound();

  const timezone = profile?.timezone || DEFAULT_TIMEZONE;
  const expectedDay = Math.min(expectedQuestDay(quest.start_date, timezone), quest.total_days);
  const missedDays = Math.max(0, expectedDay - quest.current_day_number);

  const { data: dayReport } = await supabase
    .from("quest_day_reports")
    .select(
      "id,overall_completion_percent,time_spent_minutes,blockers,outcome,notes,evidence_url,mission_reports,submitted_at",
    )
    .eq("quest_day_id", selectedDay.id)
    .eq("user_id", user.id)
    .maybeSingle();

  const normalizedDays = days.map((day) => ({
    id: day.id,
    day_number: day.day_number,
    title: day.title,
    is_day_completed: day.is_day_completed,
  }));

  return (
    <QuestDayClient
      key={selectedDay.id}
      quest={quest}
      day={{
        id: selectedDay.id,
        day_number: selectedDay.day_number,
        title: selectedDay.title,
        mentor_speech: selectedDay.mentor_speech,
        missions: missionsSchema.parse(selectedDay.missions),
        completed_mission_ids: idsSchema.parse(selectedDay.completed_mission_ids),
        is_day_completed: selectedDay.is_day_completed,
      }}
      days={normalizedDays}
      timing={{ expectedDay, missedDays }}
      initialReport={dayReport}
    />
  );
}
