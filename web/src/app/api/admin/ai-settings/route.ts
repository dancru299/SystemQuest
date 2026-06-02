import { ApiError, fail, ok } from "@/lib/api/response";
import { getAdminRequest } from "@/lib/admin/auth";
import {
  adminAiSettingsSchema,
  toAdminAiSettingsView,
} from "@/lib/admin/ai-settings";

export async function GET() {
  try {
    const { adminSupabase } = await getAdminRequest();
    const { data, error } = await adminSupabase
      .from("system_ai_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle();

    if (error) throw error;
    return ok({ settings: toAdminAiSettingsView(data) });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { adminSupabase } = await getAdminRequest();
    const input = adminAiSettingsSchema.parse(await request.json());

    const patch: Record<string, unknown> = {
      id: true,
      provider_priority: input.provider_priority,
      gemini_model: input.gemini_model,
      openai_model: input.openai_model,
      anthropic_model: input.anthropic_model,
      system_prompt: input.system_prompt,
      temperature: input.temperature,
      max_tokens: input.max_tokens,
    };

    if (input.keys.gemini.clear) patch.gemini_api_key = null;
    else if (input.keys.gemini.value?.trim()) patch.gemini_api_key = input.keys.gemini.value.trim();

    if (input.keys.openai.clear) patch.openai_api_key = null;
    else if (input.keys.openai.value?.trim()) patch.openai_api_key = input.keys.openai.value.trim();

    if (input.keys.anthropic.clear) patch.anthropic_api_key = null;
    else if (input.keys.anthropic.value?.trim()) patch.anthropic_api_key = input.keys.anthropic.value.trim();

    const { data, error } = await adminSupabase
      .from("system_ai_settings")
      .upsert(patch, { onConflict: "id" })
      .select("*")
      .single();

    if (error) throw error;
    if (!data) throw new ApiError("SERVER_ERROR", "Khong the luu AI settings.", 500);

    return ok({ settings: toAdminAiSettingsView(data) });
  } catch (error) {
    return fail(error);
  }
}

