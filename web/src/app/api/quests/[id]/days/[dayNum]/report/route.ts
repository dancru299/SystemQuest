import { z } from "zod";
import { ApiError, fail, ok } from "@/lib/api/response";
import { getAuthedRequest } from "@/lib/api/auth";
import { missionSchema } from "@/lib/validation/quest";

const missionsSchema = z.array(missionSchema);

const missionReportSchema = z.object({
  mission_id: z.string().min(1),
  status: z.enum(["not_started", "partial", "done", "blocked"]),
  completion_percent: z.coerce.number().int().min(0).max(100),
  note: z.string().max(1000).optional().nullable(),
});

const dayReportSchema = z.object({
  overall_completion_percent: z.coerce.number().int().min(0).max(100),
  time_spent_minutes: z.coerce.number().int().min(0).max(1440),
  blockers: z.string().max(2000).optional().nullable(),
  outcome: z.string().max(2000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  evidence_url: z.string().max(1000).optional().nullable(),
  mission_reports: z.array(missionReportSchema).min(1).max(20),
});

type RouteContext = {
  params: Promise<{ id: string; dayNum: string }>;
};

async function getOwnedQuestDay(id: string, dayNum: string) {
  const dayNumber = Number(dayNum);
  if (!Number.isInteger(dayNumber) || dayNumber < 1) {
    throw new ApiError("VALIDATION_ERROR", "Quest day khong hop le.", 400);
  }

  const { supabase, user } = await getAuthedRequest();

  const { data: quest, error: questError } = await supabase
    .from("quests")
    .select("id,total_days,current_day_number")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (questError || !quest) {
    throw new ApiError("QUEST_NOT_FOUND", "Quest khong ton tai hoac khong thuoc ve ban.", 404);
  }
  if (dayNumber > quest.total_days) {
    throw new ApiError("QUEST_DAY_NOT_FOUND", "Ngay nhiem vu khong ton tai.", 404);
  }
  if (dayNumber > quest.current_day_number) {
    throw new ApiError("QUEST_DAY_LOCKED", "Ngay nay chua mo khoa.", 403);
  }

  const { data: day, error: dayError } = await supabase
    .from("quest_days")
    .select("id,day_number,missions")
    .eq("quest_id", id)
    .eq("day_number", dayNumber)
    .single();

  if (dayError || !day) {
    throw new ApiError("QUEST_DAY_NOT_FOUND", "Ngay nhiem vu khong ton tai.", 404);
  }

  return { supabase, user, quest, day, dayNumber };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id, dayNum } = await context.params;
    const { supabase, user, day } = await getOwnedQuestDay(id, dayNum);

    const { data: report, error } = await supabase
      .from("quest_day_reports")
      .select(
        "id,overall_completion_percent,time_spent_minutes,blockers,outcome,notes,evidence_url,mission_reports,submitted_at",
      )
      .eq("quest_day_id", day.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;
    return ok({ report: report ?? null });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id, dayNum } = await context.params;
    const { supabase, user, day, dayNumber } = await getOwnedQuestDay(id, dayNum);
    const body = dayReportSchema.parse(await request.json());
    const missions = missionsSchema.parse(day.missions);
    const validMissionIds = new Set(missions.map((mission) => mission.id));

    for (const missionReport of body.mission_reports) {
      if (!validMissionIds.has(missionReport.mission_id)) {
        throw new ApiError("VALIDATION_ERROR", "Mission report khong thuoc ngay nay.", 400);
      }
    }

    const { data: report, error } = await supabase
      .from("quest_day_reports")
      .upsert(
        {
          user_id: user.id,
          quest_id: id,
          quest_day_id: day.id,
          day_number: dayNumber,
          overall_completion_percent: body.overall_completion_percent,
          time_spent_minutes: body.time_spent_minutes,
          blockers: body.blockers?.trim() || null,
          outcome: body.outcome?.trim() || null,
          notes: body.notes?.trim() || null,
          evidence_url: body.evidence_url?.trim() || null,
          mission_reports: body.mission_reports.map((missionReport) => ({
            mission_id: missionReport.mission_id,
            status: missionReport.status,
            completion_percent: missionReport.completion_percent,
            note: missionReport.note?.trim() || "",
          })),
          submitted_at: new Date().toISOString(),
        },
        { onConflict: "quest_day_id" },
      )
      .select(
        "id,overall_completion_percent,time_spent_minutes,blockers,outcome,notes,evidence_url,mission_reports,submitted_at",
      )
      .single();

    if (error) throw error;
    return ok({ report });
  } catch (error) {
    return fail(error);
  }
}
