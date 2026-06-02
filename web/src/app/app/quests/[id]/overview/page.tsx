import { notFound } from "next/navigation";
import { z } from "zod";
import { QuestGoalContractEditor } from "@/components/quest/QuestGoalContractEditor";
import { QuestOverviewPanel } from "@/components/quest/QuestOverviewPanel";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  goalContractSchema,
  missionSchema,
  phaseSchema,
  roadmapItemSchema,
  type AiQuestDay,
} from "@/lib/validation/quest";

type PageProps = {
  params: Promise<{ id: string }>;
};

const phasesSchema = z.array(phaseSchema);
const missionsSchema = z.array(missionSchema);
const roadmapSchema = z.array(roadmapItemSchema);

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
  const goalContract = goalContractSchema.nullable().catch(null).parse(quest.goal_contract);
  const roadmap = roadmapSchema.catch([]).parse(quest.roadmap);

  return (
    <div className="grid gap-6">
      <QuestOverviewPanel
        quest={{
          id: quest.id,
          title: quest.title,
          mainGoal: quest.main_goal,
          totalDays: quest.total_days,
          goalContract,
          roadmap,
          phases: phasesSchema.parse(quest.phases),
          days,
          completedDays: sortedDays.filter((day) => day.is_day_completed).length,
        }}
      />
      <QuestGoalContractEditor
        questId={quest.id}
        initialGoalContract={goalContract}
        initialRoadmap={roadmap}
        totalDays={quest.total_days}
      />
    </div>
  );
}
