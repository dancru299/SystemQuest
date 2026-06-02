import { fail, ok } from "@/lib/api/response";
import { getAuthedRequest } from "@/lib/api/auth";

export async function GET() {
  try {
    const { supabase, user } = await getAuthedRequest();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("xp_total,level,streak_current,streak_max,timezone")
      .eq("id", user.id)
      .single();

    if (profileError) throw profileError;

    const { count, error: countError } = await supabase
      .from("quests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "completed");

    if (countError) throw countError;

    return ok({ ...profile, quests_completed: count ?? 0 });
  } catch (error) {
    return fail(error);
  }
}

