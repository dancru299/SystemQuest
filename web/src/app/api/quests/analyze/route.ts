import { formatInTimeZone } from "date-fns-tz";
import { ApiError, fail, ok } from "@/lib/api/response";
import { getAuthedRequest } from "@/lib/api/auth";
import { analyzePlanWithAi } from "@/lib/quest/ai";
import { analyzePlanSchema } from "@/lib/validation/quest";
import { DEFAULT_TIMEZONE } from "@/lib/quest/date";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthedRequest();
    const body = await request.json();
    const { planText } = analyzePlanSchema.parse(body);

    const { data: profile } = await supabase
      .from("profiles")
      .select("timezone")
      .eq("id", user.id)
      .maybeSingle();

    const timezone = profile?.timezone || DEFAULT_TIMEZONE;
    const localDate = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");

    const { count, error: countError } = await supabase
      .from("ai_analyze_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("local_date", localDate)
      .eq("status", "started");

    if (countError) throw countError;
    if ((count ?? 0) >= 10) {
      throw new ApiError(
        "RATE_LIMITED",
        "Bạn đã dùng 10 lượt phân tích hôm nay. Hãy quay lại ngày mai.",
        429,
      );
    }

    const { error: startError } = await supabase.from("ai_analyze_events").insert({
      user_id: user.id,
      local_date: localDate,
      status: "started",
    });
    if (startError) throw startError;

    try {
      const result = await analyzePlanWithAi(planText);
      await supabase.from("ai_analyze_events").insert({
        user_id: user.id,
        local_date: localDate,
        status: "succeeded",
      });

      return ok({
        quest: result.quest,
        provider: result.provider,
        model: result.model,
      });
    } catch (error) {
      await supabase.from("ai_analyze_events").insert({
        user_id: user.id,
        local_date: localDate,
        status: "failed",
      });

      throw new ApiError(
        "AI_INVALID_RESPONSE",
        error instanceof Error
          ? `AI chưa trả về quest hợp lệ: ${error.message}`
          : "AI chưa trả về quest hợp lệ.",
        422,
      );
    }
  } catch (error) {
    return fail(error);
  }
}
