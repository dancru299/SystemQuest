import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AppHomePage() {
  if (!hasSupabaseEnv()) return null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/app");

  const { data: quest } = await supabase
    .from("quests")
    .select("id,current_day_number")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!quest) redirect("/app/import");

  redirect(`/app/quests/${quest.id}/days/${quest.current_day_number ?? 1}`);
}
