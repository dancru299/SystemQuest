import { addDays, parseISO, subDays } from "date-fns";
import { format } from "date-fns";
import { ApiError, fail, ok } from "@/lib/api/response";
import { getAuthedRequest } from "@/lib/api/auth";
import { expectedQuestDay, todayInTimezone, DEFAULT_TIMEZONE } from "@/lib/quest/date";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { supabase, user } = await getAuthedRequest();

    const { data: quest, error } = await supabase
      .from("quests")
      .select("*, quest_days(*)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !quest) {
      throw new ApiError("QUEST_NOT_FOUND", "Quest không tồn tại hoặc không thuộc về bạn.", 404);
    }

    return ok({ quest });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { supabase, user } = await getAuthedRequest();
    const body = await request.json();

    const { data: quest, error: questError } = await supabase
      .from("quests")
      .select("id,total_days,start_date,current_day_number,status")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (questError || !quest) {
      throw new ApiError("QUEST_NOT_FOUND", "Quest không tồn tại hoặc không thuộc về bạn.", 404);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("timezone")
      .eq("id", user.id)
      .maybeSingle();
    const timezone = profile?.timezone || DEFAULT_TIMEZONE;

    if (body.action === "continue") {
      const expected = expectedQuestDay(quest.start_date, timezone);
      const currentDayNumber = Math.min(Math.max(expected, quest.current_day_number), quest.total_days);
      const { data, error } = await supabase
        .from("quests")
        .update({ current_day_number: currentDayNumber })
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id,current_day_number,start_date")
        .single();
      if (error) throw error;

      await supabase.from("profiles").update({ streak_current: 0 }).eq("id", user.id);
      return ok({ quest: data });
    }

    if (body.action === "reschedule") {
      const today = parseISO(todayInTimezone(timezone));
      const newStartDate = format(subDays(today, quest.current_day_number - 1), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("quests")
        .update({ start_date: newStartDate })
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id,current_day_number,start_date")
        .single();
      if (error) throw error;

      await supabase.from("profiles").update({ streak_current: 0 }).eq("id", user.id);
      return ok({ quest: data });
    }

    const patch: Record<string, unknown> = {};
    if (typeof body.current_day_number === "number") {
      patch.current_day_number = Math.min(Math.max(1, body.current_day_number), quest.total_days);
    }
    if (["active", "completed", "archived"].includes(body.status)) {
      patch.status = body.status;
      if (body.status === "completed") patch.completed_at = new Date().toISOString();
    }
    if (typeof body.start_date_shift_days === "number" && quest.start_date) {
      patch.start_date = format(
        addDays(parseISO(quest.start_date), body.start_date_shift_days),
        "yyyy-MM-dd",
      );
    }

    if (Object.keys(patch).length === 0) {
      throw new ApiError("VALIDATION_ERROR", "Không có trường hợp lệ để cập nhật.", 400);
    }

    const { data, error } = await supabase
      .from("quests")
      .update(patch)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (error) throw error;

    return ok({ quest: data });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { supabase, user } = await getAuthedRequest();
    const { data, error } = await supabase
      .from("quests")
      .update({ status: "archived" })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id,status")
      .single();

    if (error || !data) {
      throw new ApiError("QUEST_NOT_FOUND", "Quest không tồn tại hoặc không thuộc về bạn.", 404);
    }

    return ok({ quest: data });
  } catch (error) {
    return fail(error);
  }
}

