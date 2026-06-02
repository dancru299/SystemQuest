import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { SetupNotice } from "@/components/app/SetupNotice";
import { isEmailAdmin } from "@/lib/admin/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AppLayoutProps = {
  children: React.ReactNode;
};

export default async function AppLayout({ children }: AppLayoutProps) {
  if (!hasSupabaseEnv()) {
    return <SetupNotice />;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/app");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name,xp_total,level,streak_current,streak_max,timezone,is_admin")
    .eq("id", user.id)
    .maybeSingle();

  const initialStats = {
    xp_total: profile?.xp_total ?? 0,
    level: profile?.level ?? 1,
    streak_current: profile?.streak_current ?? 0,
    streak_max: profile?.streak_max ?? 0,
    quests_completed: 0,
  };

  const { count } = await supabase
    .from("quests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "completed");

  return (
    <AppShell
      displayName={profile?.display_name ?? user.email?.split("@")[0] ?? "Adventurer"}
      userEmail={user.email ?? ""}
      emailVerified={Boolean(user.email_confirmed_at)}
      isAdmin={Boolean(profile?.is_admin) || isEmailAdmin(user.email)}
      initialStats={{ ...initialStats, quests_completed: count ?? 0 }}
    >
      {children}
    </AppShell>
  );
}
