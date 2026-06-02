import { notFound } from "next/navigation";
import { z } from "zod";
import { QuestOverviewPanel } from "@/components/quest/QuestOverviewPanel";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { missionSchema, phaseSchema, type AiQuestDay } from "@/lib/validation/quest";

type PageProps = {
  params: Promise<{ id: string }>;
};

const phasesSchema = z.array(phaseSchema);
const missionsSchema = z.array(missionSchema);

export default async function QuestOverviewPage({ params }: PageProps) {
  if (!hasSupabaseEnv()) return null;

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: quest } = await supabase
    .from("quests")
    .select("*, quest_days(*)")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!quest) notFound();

  const sortedDays = [...(quest.quest_days ?? [])].sort(
    (a, b) => a.day_number - b.day_number,
  );
  const days: AiQuestDay[] = sortedDays.map((day) => ({
    day: day.day_number,
    title: day.title,
    mentorSpeech: day.mentor_speech ?? "",
    missions: missionsSchema.parse(day.missions),
  }));

  return (
    <QuestOverviewPanel
      quest={{
        id: quest.id,
        title: quest.title,
        mainGoal: quest.main_goal,
        totalDays: quest.total_days,
        phases: phasesSchema.parse(quest.phases),
        days,
        completedDays: sortedDays.filter((day) => day.is_day_completed).length,
      }}
    />
  );
}
