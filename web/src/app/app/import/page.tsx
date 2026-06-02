import { ImportPlanClient } from "@/components/quest/ImportPlanClient";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ImportPage() {
  if (!hasSupabaseEnv()) return null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: quest } = user
    ? await supabase
        .from("quests")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  return <ImportPlanClient activeQuestId={quest?.id} />;
}
