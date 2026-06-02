import { z } from "zod";
import { ApiError, fail, ok } from "@/lib/api/response";
import { getAuthedRequest } from "@/lib/api/auth";
import { getDayProgress } from "@/lib/quest/progress";
import { missionSchema } from "@/lib/validation/quest";

type RouteContext = {
  params: Promise<{ id: string; dayNum: string }>;
};

const missionsSchema = z.array(missionSchema);
const idsSchema = z.array(z.string());

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id, dayNum } = await context.params;
    const dayNumber = Number(dayNum);
    const { supabase, user } = await getAuthedRequest();

    const { data: quest } = await supabase
      .from("quests")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!quest) {
      throw new ApiError("QUEST_NOT_FOUND", "Quest không tồn tại hoặc không thuộc về bạn.", 404);
    }

    const { data: day } = await supabase
      .from("quest_days")
      .select("missions,completed_mission_ids")
      .eq("quest_id", id)
      .eq("day_number", dayNumber)
      .single();

    if (!day) {
      throw new ApiError("QUEST_DAY_NOT_FOUND", "Ngày nhiệm vụ không tồn tại.", 404);
    }

    return ok(getDayProgress(missionsSchema.parse(day.missions), idsSchema.parse(day.completed_mission_ids)));
  } catch (error) {
    return fail(error);
  }
}

