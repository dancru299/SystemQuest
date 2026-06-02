import { z } from "zod";
import { DEFAULT_PROVIDER_PRIORITY, DEFAULT_SYSTEM_PROMPT, type AiProvider } from "@/lib/quest/ai";
import { getAnthropicModel, getGeminiModel, getOpenAiModel } from "@/lib/env";

export const aiProviderSchema = z.enum(["gemini", "openai", "anthropic", "deepseek"]);

export const adminAiSettingsSchema = z.object({
  provider_priority: z.array(aiProviderSchema).min(1).max(4),
  gemini_model: z.string().trim().min(1).max(120),
  openai_model: z.string().trim().min(1).max(120),
  anthropic_model: z.string().trim().min(1).max(120),
  system_prompt: z.string().trim().min(100).max(10000),
  temperature: z.number().min(0).max(2),
  max_tokens: z.number().int().min(512).max(16000),
  keys: z.object({
    gemini: z.object({
      value: z.string().optional(),
      clear: z.boolean().optional(),
    }),
    openai: z.object({
      value: z.string().optional(),
      clear: z.boolean().optional(),
    }),
    anthropic: z.object({
      value: z.string().optional(),
      clear: z.boolean().optional(),
    }),
  }),
});

export type AdminAiSettingsInput = z.infer<typeof adminAiSettingsSchema>;

export type AdminAiSettingsView = {
  provider_priority: AiProvider[];
  gemini_model: string;
  openai_model: string;
  anthropic_model: string;
  system_prompt: string;
  temperature: number;
  max_tokens: number;
  providers: Record<
    "gemini" | "openai" | "anthropic",
    {
      hasKey: boolean;
      source: "database" | "env" | "missing";
      maskedKey: string | null;
      envAvailable: boolean;
    }
  >;
};

export function maskSecret(value?: string | null) {
  if (!value) return null;
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

function normalizePriority(value?: string[] | null): AiProvider[] {
  const allowed = new Set<AiProvider>(["gemini", "openai", "anthropic", "deepseek"]);
  const seen = new Set<AiProvider>();
  const normalized = (value?.length ? value : DEFAULT_PROVIDER_PRIORITY)
    .filter((provider): provider is AiProvider => allowed.has(provider as AiProvider))
    .filter((provider) => {
      if (seen.has(provider)) return false;
      seen.add(provider);
      return true;
    });

  for (const provider of DEFAULT_PROVIDER_PRIORITY) {
    if (!seen.has(provider)) normalized.push(provider);
  }
  return normalized;
}

type SettingsRow = {
  provider_priority: string[] | null;
  gemini_api_key: string | null;
  gemini_model: string | null;
  openai_api_key: string | null;
  openai_model: string | null;
  anthropic_api_key: string | null;
  anthropic_model: string | null;
  system_prompt: string | null;
  temperature: number | null;
  max_tokens: number | null;
};

export function toAdminAiSettingsView(row: SettingsRow | null): AdminAiSettingsView {
  const geminiDbKey = row?.gemini_api_key ?? null;
  const openAiDbKey = row?.openai_api_key ?? null;
  const anthropicDbKey = row?.anthropic_api_key ?? null;
  const geminiEnvKey = process.env.GEMINI_API_KEY;
  const openAiEnvKey = process.env.OPENAI_API_KEY;
  const anthropicEnvKey = process.env.ANTHROPIC_API_KEY;

  return {
    provider_priority: normalizePriority(row?.provider_priority),
    gemini_model: row?.gemini_model || getGeminiModel(),
    openai_model: row?.openai_model || getOpenAiModel(),
    anthropic_model: row?.anthropic_model || getAnthropicModel(),
    system_prompt: row?.system_prompt || DEFAULT_SYSTEM_PROMPT,
    temperature: row?.temperature ?? 0.35,
    max_tokens: row?.max_tokens ?? 4000,
    providers: {
      gemini: {
        hasKey: Boolean(geminiDbKey || geminiEnvKey),
        source: geminiDbKey ? "database" : geminiEnvKey ? "env" : "missing",
        maskedKey: maskSecret(geminiDbKey || geminiEnvKey),
        envAvailable: Boolean(geminiEnvKey),
      },
      openai: {
        hasKey: Boolean(openAiDbKey || openAiEnvKey),
        source: openAiDbKey ? "database" : openAiEnvKey ? "env" : "missing",
        maskedKey: maskSecret(openAiDbKey || openAiEnvKey),
        envAvailable: Boolean(openAiEnvKey),
      },
      anthropic: {
        hasKey: Boolean(anthropicDbKey || anthropicEnvKey),
        source: anthropicDbKey ? "database" : anthropicEnvKey ? "env" : "missing",
        maskedKey: maskSecret(anthropicDbKey || anthropicEnvKey),
        envAvailable: Boolean(anthropicEnvKey),
      },
    },
  };
}

