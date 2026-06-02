import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ApiError, fail, ok } from "@/lib/api/response";
import { getSupabaseEnv } from "@/lib/env";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";

const autoConfirmSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function isEmailNotConfirmed(message?: string) {
  return (message ?? "").toLowerCase().includes("email not confirmed");
}

export async function POST(request: Request) {
  try {
    if (process.env.AUTH_AUTO_CONFIRM_EMAIL !== "true") {
      throw new ApiError(
        "CONFIG_MISSING",
        "AUTH_AUTO_CONFIRM_EMAIL is disabled. Confirm the email inbox, or disable Confirm email in Supabase Auth settings.",
        403,
      );
    }

    if (!hasSupabaseAdminEnv()) {
      throw new ApiError(
        "CONFIG_MISSING",
        "SUPABASE_SERVICE_ROLE_KEY is required for auto-confirm email.",
        500,
      );
    }

    const { email, password } = autoConfirmSchema.parse(await request.json());
    const { url, anonKey } = getSupabaseEnv();
    const anonSupabase = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { error: signInError } = await anonSupabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!signInError) {
      return ok({ confirmed: true, alreadyConfirmed: true });
    }

    if (!isEmailNotConfirmed(signInError.message)) {
      throw new ApiError("AUTH_REQUIRED", "Email hoặc mật khẩu không đúng.", 401);
    }

    const adminSupabase = createSupabaseAdminClient();
    const { data: usersPage, error: listError } = await adminSupabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) throw listError;

    const user = usersPage.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
    );

    if (!user) {
      throw new ApiError("AUTH_REQUIRED", "Không tìm thấy tài khoản cần xác nhận.", 404);
    }

    const { error: updateError } = await adminSupabase.auth.admin.updateUserById(user.id, {
      email_confirm: true,
    });
    if (updateError) throw updateError;

    return ok({ confirmed: true, alreadyConfirmed: false });
  } catch (error) {
    return fail(error);
  }
}

