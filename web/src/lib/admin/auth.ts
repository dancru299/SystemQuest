import { ApiError } from "@/lib/api/response";
import { getAuthedRequest } from "@/lib/api/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAdmin(email?: string | null) {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

export async function getAdminRequest() {
  const { supabase, user } = await getAuthedRequest();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;

  const isAdmin = Boolean(profile?.is_admin) || isEmailAdmin(user.email);
  if (!isAdmin) {
    throw new ApiError("AUTH_REQUIRED", "Bạn không có quyền truy cập admin.", 403);
  }

  return {
    user,
    supabase,
    adminSupabase: createSupabaseAdminClient(),
  };
}

