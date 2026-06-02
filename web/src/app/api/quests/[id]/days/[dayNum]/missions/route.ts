import { z } from "zod";
import { ApiError, fail, ok } from "@/lib/api/response";
import { getAuthedRequest } from "@/lib/api/auth";

const toggleMissionSchema = z.object({
  mission_id: z.string().min(1),
  completed: z.boolean(),
  client_event_id: z.string().min(8).max(160).optional(),
});

type RouteContext = {
  params: Promise<{ id: string; dayNum: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id, dayNum } = await context.params;
    const dayNumber = Number(dayNum);
    if (!Number.isInteger(dayNumber) || dayNumber < 1) {
      throw new ApiError("VALIDATION_ERROR", "Quest day không hợp lệ.", 400);
    }

    const { supabase } = await getAuthedRequest();
    const body = toggleMissionSchema.parse(await request.json());

    const { data, error } = await supabase.rpc("toggle_mission_completion", {
      p_quest_id: id,
      p_day_number: dayNumber,
      p_mission_id: body.mission_id,
      p_completed: body.completed,
      p_client_event_id: body.client_event_id ?? null,
    });

    if (error) {
      if (error.message.includes("QUEST_NOT_FOUND")) {
        throw new ApiError("QUEST_NOT_FOUND", "Quest không tồn tại hoặc không thuộc về bạn.", 404);
      }
      if (error.message.includes("QUEST_DAY_NOT_FOUND")) {
        throw new ApiError("QUEST_DAY_NOT_FOUND", "Ngày nhiệm vụ không tồn tại.", 404);
      }
      if (error.message.includes("MISSION_NOT_FOUND")) {
        throw new ApiError("MISSION_NOT_FOUND", "Mission không tồn tại.", 404);
      }
      throw error;
    }

    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

