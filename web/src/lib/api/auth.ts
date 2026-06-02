import { ApiError } from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getAuthedRequest() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new ApiError("AUTH_REQUIRED", "Bạn cần đăng nhập để tiếp tục.", 401);
  }

  return { supabase, user };
}

