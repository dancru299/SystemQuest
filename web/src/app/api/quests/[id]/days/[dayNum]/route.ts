import { ApiError, fail, ok } from "@/lib/api/response";
import { getAuthedRequest } from "@/lib/api/auth";

type RouteContext = {
  params: Promise<{ id: string; dayNum: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id, dayNum } = await context.params;
    const dayNumber = Number(dayNum);
    if (!Number.isInteger(dayNumber) || dayNumber < 1) {
      throw new ApiError("VALIDATION_ERROR", "Quest day khong hop le.", 400);
    }

    const { supabase, user } = await getAuthedRequest();

    const { data: quest, error: questError } = await supabase
      .from("quests")
      .select("id,user_id,title,total_days,current_day_number,start_date,status")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (questError || !quest) {
      throw new ApiError("QUEST_NOT_FOUND", "Quest không tồn tại hoặc không thuộc về bạn.", 404);
    }

    if (dayNumber > quest.total_days) {
      throw new ApiError("QUEST_DAY_NOT_FOUND", "Ngay nhiem vu khong ton tai.", 404);
    }
    if (dayNumber > quest.current_day_number) {
      throw new ApiError("QUEST_DAY_LOCKED", "Ngay nay chua mo khoa. Hay hoan thanh Quest Day hien tai truoc.", 403);
    }

    const { data: day, error: dayError } = await supabase
      .from("quest_days")
      .select("*")
      .eq("quest_id", id)
      .eq("day_number", dayNumber)
      .single();

    if (dayError || !day) {
      throw new ApiError("QUEST_DAY_NOT_FOUND", "Ngày nhiệm vụ không tồn tại.", 404);
    }

    return ok({ quest, day });
  } catch (error) {
    return fail(error);
  }
}
