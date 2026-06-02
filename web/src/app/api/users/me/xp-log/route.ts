import { fail, ok } from "@/lib/api/response";
import { getAuthedRequest } from "@/lib/api/auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { supabase, user } = await getAuthedRequest();
    const { data, error, count } = await supabase
      .from("xp_log")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;
    return ok({ xpLog: data ?? [] }, { page, total: count ?? 0 });
  } catch (error) {
    return fail(error);
  }
}

