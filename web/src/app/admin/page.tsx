import { redirect } from "next/navigation";
import { AdminAiSettingsForm } from "@/components/admin/AdminAiSettingsForm";
import { SetupNotice } from "@/components/app/SetupNotice";
import { isEmailAdmin } from "@/lib/admin/auth";
import { toAdminAiSettingsView } from "@/lib/admin/ai-settings";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  if (!hasSupabaseEnv()) return <SetupNotice />;
  if (!hasSupabaseAdminEnv()) {
    return (
      <main className="mx-auto flex min-h-svh max-w-3xl items-center px-5">
        <section className="border border-rune/35 bg-deep/85 p-8 shadow-rune">
          <p className="font-display text-3xl text-gold">Can service role key</p>
          <p className="mt-4 leading-7 text-text-dim">
            Trang admin can <code className="text-rune-bright">SUPABASE_SERVICE_ROLE_KEY</code> de doc/ghi system settings bi RLS khoa truc tiep.
          </p>
        </section>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = Boolean(profile?.is_admin) || isEmailAdmin(user.email);
  if (!isAdmin) redirect("/app");

  const adminSupabase = createSupabaseAdminClient();
  const { data } = await adminSupabase
    .from("system_ai_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  return <AdminAiSettingsForm initialSettings={toAdminAiSettingsView(data)} />;
}

