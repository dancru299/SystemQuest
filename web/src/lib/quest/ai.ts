import Anthropic from "@anthropic-ai/sdk";
import {
  getAnthropicModel,
  getGeminiModel,
  getOpenAiModel,
  getProviderPriority,
} from "@/lib/env";
import { hasSupabaseAdminEnv, createSupabaseAdminClient } from "@/lib/supabase/admin";
import { aiQuestSchema, type AiQuest } from "@/lib/validation/quest";

export type AiProvider = "gemini" | "openai" | "anthropic" | "deepseek";

type SystemAiSettingsRow = {
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

type ProviderRuntime = {
  provider: AiProvider;
  apiKey: string;
  model: string;
};

type AiRuntimeConfig = {
  priority: AiProvider[];
  providers: Partial<Record<AiProvider, ProviderRuntime>>;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
};

export const DEFAULT_PROVIDER_PRIORITY: AiProvider[] = ["gemini", "openai", "anthropic"];

export const DEFAULT_SYSTEM_PROMPT = `Ban la he thong AI phan tich ke hoach ca nhan va tao lo trinh nhiem vu.
Phan tich ke hoach nguoi dung va tra ve json thuan tuy, khong markdown fence, khong text ngoai json.

Schema:
{
  "title": "string, ten ngan muc tieu duoi 50 ky tu",
  "mainGoal": "string, mo ta tong quan 2-3 cau",
  "totalDays": "number, 7-30; neu plan dai hon hay cat thanh phase dau tien 30 ngay",
  "phases": [{ "name": "string", "desc": "string", "dayRange": "Ngay 1-7" }],
  "days": [{
    "day": 1,
    "title": "string, tieu de anime-style nhung van ro viec",
    "mentorSpeech": "string, 1-2 cau huong dan",
    "missions": [{
      "id": "m_001",
      "title": "string",
      "desc": "string, huong dan cu the de lam duoc",
      "type": "main|bonus|rest",
      "xp_reward": 50,
      "order": 1
    }]
  }]
}

Quy tac:
- Moi ngay co 2-4 missions, toi thieu 1 mission main.
- Nhiem vu phai cu the, co the thuc hien duoc trong ngay.
- xp_reward: main=50, bonus=30, rest=20.
- Giong van thuc te, co mau sac isekai huyen bi vua phai.
- Chi tra json hop le.`;

function stripJsonFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function extractLikelyJson(value: string) {
  const stripped = stripJsonFence(value);
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return stripped;
  }
  return stripped.slice(firstBrace, lastBrace + 1);
}

function removeTrailingCommas(value: string) {
  return value.replace(/,\s*([}\]])/g, "$1");
}

function parseJsonTolerant(raw: string) {
  const extracted = extractLikelyJson(raw);
  try {
    return JSON.parse(extracted);
  } catch {
    return JSON.parse(removeTrailingCommas(extracted));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeAiQuestCandidate(value: unknown) {
  if (!isRecord(value)) return value;
  const days = Array.isArray(value.days) ? value.days.filter(isRecord) : [];
  if (!days.length) return value;

  const normalizedDays = days.slice(0, 30).map((day, index) => ({
    ...day,
    day: index + 1,
  }));
  const totalDays = normalizedDays.length;

  const phases = Array.isArray(value.phases)
    ? value.phases.filter(isRecord).map((phase, index, allPhases) => {
        const phaseCount = Math.max(1, allPhases.length);
        const start = Math.floor((index * totalDays) / phaseCount) + 1;
        const end = index === phaseCount - 1 ? totalDays : Math.floor(((index + 1) * totalDays) / phaseCount);
        return {
          ...phase,
          dayRange: `Ngay ${start}-${Math.max(start, end)}`,
        };
      })
    : value.phases;

  return {
    ...value,
    totalDays,
    days: normalizedDays,
    phases,
  };
}

export function parseAiQuest(raw: string): AiQuest {
  const parsed = parseJsonTolerant(raw);
  return aiQuestSchema.parse(normalizeAiQuestCandidate(parsed));
}

function normalizeProvider(value: string): AiProvider | null {
  if (value === "gemini" || value === "openai" || value === "anthropic" || value === "deepseek") {
    return value;
  }
  return null;
}

function normalizePriority(value?: string[] | null) {
  const input = value?.length ? value : getProviderPriority();
  const seen = new Set<AiProvider>();
  const providers = input
    .map((provider) => normalizeProvider(provider))
    .filter((provider): provider is AiProvider => Boolean(provider))
    .filter((provider) => {
      if (seen.has(provider)) return false;
      seen.add(provider);
      return true;
    });

  for (const provider of DEFAULT_PROVIDER_PRIORITY) {
    if (!seen.has(provider)) providers.push(provider);
  }

  return providers;
}

async function loadSystemAiSettings(): Promise<SystemAiSettingsRow | null> {
  if (!hasSupabaseAdminEnv()) return null;

  try {
    const adminSupabase = createSupabaseAdminClient();
    const { data, error } = await adminSupabase
      .from("system_ai_settings")
      .select(
        "provider_priority,gemini_api_key,gemini_model,openai_api_key,openai_model,anthropic_api_key,anthropic_model,system_prompt,temperature,max_tokens",
      )
      .eq("id", true)
      .maybeSingle();

    if (error) return null;
    return data as SystemAiSettingsRow | null;
  } catch {
    return null;
  }
}

const PLACEHOLDER_KEY_PATTERN = /^(your-|changeme|placeholder|xxx|sk-xxx|<)/i;

// San toi thieu cho output: mot quest JSON (toi 30 ngay) khong vua trong 4000 token
// se bi cat cut va parse loi. Sang an toan o runtime de tranh truncation du DB con
// giu gia tri cu (row seed mac dinh max_tokens = 4000).
const MIN_OUTPUT_TOKENS = 8000;

// Loai bo key rong hoac key placeholder (vi du "your-anthropic-api-key")
// de tranh chon provider chac chan tra ve 401.
function isUsableKey(value?: string | null): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.length >= 8 && !PLACEHOLDER_KEY_PATTERN.test(trimmed);
}

export async function getAiRuntimeConfig(): Promise<AiRuntimeConfig> {
  const settings = await loadSystemAiSettings();

  const providers: Partial<Record<AiProvider, ProviderRuntime>> = {};
  const geminiKey = settings?.gemini_api_key || process.env.GEMINI_API_KEY;
  const openAiKey = settings?.openai_api_key || process.env.OPENAI_API_KEY;
  const anthropicKey = settings?.anthropic_api_key || process.env.ANTHROPIC_API_KEY;

  if (isUsableKey(geminiKey)) {
    providers.gemini = {
      provider: "gemini",
      apiKey: geminiKey.trim(),
      model: settings?.gemini_model || getGeminiModel(),
    };
  }

  if (isUsableKey(openAiKey)) {
    providers.openai = {
      provider: "openai",
      apiKey: openAiKey.trim(),
      model: settings?.openai_model || getOpenAiModel(),
    };
  }

  if (isUsableKey(anthropicKey)) {
    providers.anthropic = {
      provider: "anthropic",
      apiKey: anthropicKey.trim(),
      model: settings?.anthropic_model || getAnthropicModel(),
    };
  }

  return {
    priority: normalizePriority(settings?.provider_priority),
    providers,
    systemPrompt: settings?.system_prompt || DEFAULT_SYSTEM_PROMPT,
    temperature: settings?.temperature ?? 0.35,
    maxTokens: Math.max(settings?.max_tokens ?? MIN_OUTPUT_TOKENS, MIN_OUTPUT_TOKENS),
  };
}

export function mockAiQuest(planText: string): AiQuest {
  const title = planText.toLowerCase().includes("react")
    ? "React System Awakening"
    : "Hanh Trinh Nhiem Vu Dau Tien";

  return {
    title,
    mainGoal:
      "Bien ke hoach lon thanh chuoi nhiem vu nho de ban co the tien len moi ngay. Lich trinh nay uu tien hanh dong ro rang, review ngan va khoang nghi can bang.",
    totalDays: 7,
    phases: [
      {
        name: "Nen Tang",
        desc: "Lam ro muc tieu, chuan bi moi truong va tao nhip thuc hien.",
        dayRange: "Ngay 1-3",
      },
      {
        name: "Xay Dung",
        desc: "Thuc thi cac buoc chinh va bien tien do thanh ket qua nhin thay.",
        dayRange: "Ngay 4-7",
      },
    ],
    days: Array.from({ length: 7 }, (_, index) => {
      const day = index + 1;
      return {
        day,
        title: day === 1 ? "Mo Cong He Thong" : `Chuong ${day}: Tien Sau Hon`,
        mentorSpeech:
          "Tot lam, Nha Lua Chon. Hay tap trung vao mot buoc chac chan truoc khi tim kiem su hoan hao.",
        missions: [
          {
            id: "m_001",
            title: day === 1 ? "Viet lai muc tieu cuoi" : "Hoan thanh nhiem vu chinh",
            desc:
              "Danh 25-45 phut cho dau viec quan trong nhat trong ke hoach. Ket thuc bang mot ghi chu ngan ve dieu da hoan thanh.",
            type: "main",
            xp_reward: 50,
            order: 1,
          },
          {
            id: "m_002",
            title: "Ghi nhan vat can",
            desc:
              "Viet 1-3 vat can co the lam cham tien do va chon cach xu ly nho nhat cho ngay mai.",
            type: "bonus",
            xp_reward: 30,
            order: 2,
          },
          {
            id: "m_003",
            title: "Review 5 phut",
            desc: "Danh dau dieu hoc duoc va de lai mot dong nhac nho cho ban cua ngay mai.",
            type: "rest",
            xp_reward: 20,
            order: 3,
          },
        ],
      };
    }),
  };
}

function buildUserPrompt(planText: string, strictJson = false) {
  const jsonReminder =
    "Output must be a valid json object. The response must contain only json, with no markdown fence and no extra prose. Important: totalDays must exactly equal days.length. If you generate only 7 day objects, set totalDays to 7. Never claim totalDays is 30 unless all days 1 through 30 are present.";
  return strictJson
    ? `${jsonReminder}\n\nKe hoach nguoi dung:\n\n${planText.slice(0, 10000)}\n\nLan truoc json khong hop le. Sua loi totalDays/days neu co. Chi tra ve json thuan tuy dung schema.`
    : `${jsonReminder}\n\nKe hoach nguoi dung:\n\n${planText.slice(0, 10000)}`;
}

function extractOpenAiText(payload: unknown) {
  if (typeof payload !== "object" || payload === null) return "";
  if ("output_text" in payload && typeof payload.output_text === "string") {
    return payload.output_text;
  }

  const output = "output" in payload && Array.isArray(payload.output) ? payload.output : [];
  const texts: string[] = [];
  for (const item of output) {
    if (typeof item !== "object" || item === null || !("content" in item) || !Array.isArray(item.content)) {
      continue;
    }
    for (const content of item.content) {
      if (typeof content === "object" && content && "text" in content && typeof content.text === "string") {
        texts.push(content.text);
      }
    }
  }
  return texts.join("\n");
}

async function callGemini(runtime: ProviderRuntime, planText: string, config: AiRuntimeConfig, strictJson = false) {
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${runtime.model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": runtime.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: config.systemPrompt }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: buildUserPrompt(planText, strictJson) }],
            },
          ],
          generationConfig: {
            temperature: config.temperature,
            maxOutputTokens: config.maxTokens,
            responseMimeType: "application/json",
          },
        }),
      },
    );
  } catch (error) {
    const cause =
      error instanceof Error && "cause" in error && error.cause
        ? ` (${String(error.cause)})`
        : "";
    throw new Error(`Gemini network request failed${cause}`);
  }

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Gemini request failed with ${response.status}`);
  }

  return (
    payload?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("\n") ?? ""
  );
}

function isRetryableProviderError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("quota") ||
    message.includes("rate") ||
    message.includes("429") ||
    message.includes("retry in") ||
    message.includes("temporarily")
  );
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function callOpenAi(runtime: ProviderRuntime, planText: string, config: AiRuntimeConfig, strictJson = false) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${runtime.apiKey}`,
    },
    body: JSON.stringify({
      model: runtime.model,
      instructions: config.systemPrompt,
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: buildUserPrompt(planText, strictJson) }],
        },
      ],
      max_output_tokens: config.maxTokens,
      temperature: config.temperature,
      text: {
        format: { type: "json_object" },
      },
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenAI request failed with ${response.status}`);
  }

  // Khi phan hoi bi cat do cham tran max_output_tokens, JSON se khong hop le.
  // Bao loi ro rang thay vi de parser nem "Expected double-quoted property name".
  if (payload?.status === "incomplete") {
    const reason = payload?.incomplete_details?.reason;
    throw new Error(
      reason === "max_output_tokens"
        ? "OpenAI tra ve JSON bi cat vi vuot max_tokens. Hay tang max_tokens trong cau hinh AI (Admin) hoac rut gon plan."
        : `OpenAI tra ve phan hoi chua hoan chinh (${reason ?? "unknown"}).`,
    );
  }

  return extractOpenAiText(payload);
}

async function callAnthropic(runtime: ProviderRuntime, planText: string, config: AiRuntimeConfig, strictJson = false) {
  const client = new Anthropic({ apiKey: runtime.apiKey });
  const response = await client.messages.create({
    model: runtime.model,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    system: config.systemPrompt,
    messages: [
      {
        role: "user",
        content: buildUserPrompt(planText, strictJson),
      },
    ],
  });

  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

async function callProvider(
  runtime: ProviderRuntime,
  planText: string,
  config: AiRuntimeConfig,
  strictJson = false,
) {
  if (runtime.provider === "gemini") return callGemini(runtime, planText, config, strictJson);
  if (runtime.provider === "openai") return callOpenAi(runtime, planText, config, strictJson);
  if (runtime.provider === "anthropic") return callAnthropic(runtime, planText, config, strictJson);
  throw new Error(`Provider ${runtime.provider} is not implemented yet.`);
}

export async function analyzePlanWithAi(
  planText: string,
): Promise<{ quest: AiQuest; provider: AiProvider | "mock"; model: string }> {
  const config = await getAiRuntimeConfig();

  // Moi luot import chi dung DUY NHAT 1 model: provider duoc uu tien dau tien
  // (theo provider_priority) va co API key hop le. Khong fallback sang provider khac.
  const runtime = config.priority
    .map((provider) => config.providers[provider])
    .find((provider): provider is ProviderRuntime => Boolean(provider));

  if (!runtime) {
    if (process.env.NODE_ENV !== "production") {
      return { quest: mockAiQuest(planText), provider: "mock", model: "local-dev" };
    }
    throw new Error("Chua cau hinh API key hop le cho provider AI nao.");
  }

  try {
    let first: string;
    try {
      first = await callProvider(runtime, planText, config);
    } catch (error) {
      // Cung 1 model: chi tu dong thu lai mot lan khi bi rate-limit tam thoi.
      if (isRetryableProviderError(error)) {
        await delay(5500);
        first = await callProvider(runtime, planText, config);
      } else {
        throw error;
      }
    }
    try {
      return { quest: parseAiQuest(first), provider: runtime.provider, model: runtime.model };
    } catch {
      // Van la cung 1 model, chi thu lai voi yeu cau JSON nghiem ngat hon.
      const retry = await callProvider(runtime, planText, config, true);
      return { quest: parseAiQuest(retry), provider: runtime.provider, model: runtime.model };
    }
  } catch (error) {
    throw new Error(
      `${runtime.provider}:${runtime.model} - ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}
