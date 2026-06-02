export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  return { url, anonKey };
}

export function getAnthropicModel() {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
}

export function getGeminiModel() {
  return process.env.GEMINI_MODEL || "gemini-3.5-flash";
}

export function getOpenAiModel() {
  return process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

export function getProviderPriority() {
  return (process.env.AI_PROVIDER_PRIORITY || "gemini,openai,anthropic")
    .split(",")
    .map((provider) => provider.trim())
    .filter(Boolean);
}
