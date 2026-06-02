"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, ShieldCheck, Sparkles } from "lucide-react";
import type { AdminAiSettingsView } from "@/lib/admin/ai-settings";
import type { AiProvider } from "@/lib/quest/ai";

type AdminAiSettingsFormProps = {
  initialSettings: AdminAiSettingsView;
};

const PROVIDERS: { value: AiProvider; label: string; help: string }[] = [
  { value: "gemini", label: "Gemini", help: "Default provider" },
  { value: "openai", label: "OpenAI", help: "Fallback 2" },
  { value: "anthropic", label: "Anthropic", help: "Fallback 3" },
  { value: "deepseek", label: "DeepSeek", help: "Reserved adapter" },
];

function uniquePriority(priority: AiProvider[]) {
  const seen = new Set<AiProvider>();
  const next = priority.filter((provider) => {
    if (seen.has(provider)) return false;
    seen.add(provider);
    return true;
  });
  for (const provider of PROVIDERS.map((item) => item.value)) {
    if (!seen.has(provider)) next.push(provider);
  }
  return next;
}

export function AdminAiSettingsForm({ initialSettings }: AdminAiSettingsFormProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [keys, setKeys] = useState({
    gemini: "",
    openai: "",
    anthropic: "",
  });
  const [clearKeys, setClearKeys] = useState({
    gemini: false,
    openai: false,
    anthropic: false,
  });
  const [isPending, startTransition] = useTransition();

  function updatePriority(index: number, provider: AiProvider) {
    const next = [...settings.provider_priority];
    next[index] = provider;
    setSettings((value) => ({ ...value, provider_priority: uniquePriority(next) }));
  }

  function save() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/ai-settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider_priority: settings.provider_priority,
            gemini_model: settings.gemini_model,
            openai_model: settings.openai_model,
            anthropic_model: settings.anthropic_model,
            system_prompt: settings.system_prompt,
            temperature: settings.temperature,
            max_tokens: settings.max_tokens,
            keys: {
              gemini: { value: keys.gemini, clear: clearKeys.gemini },
              openai: { value: keys.openai, clear: clearKeys.openai },
              anthropic: { value: keys.anthropic, clear: clearKeys.anthropic },
            },
          }),
        });

        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload?.error?.message || "Khong the luu cau hinh AI.");
        }

        setSettings(payload.data.settings);
        setKeys({ gemini: "", openai: "", anthropic: "" });
        setClearKeys({ gemini: false, openai: false, anthropic: false });
        toast.success("Da luu AI settings toan he thong.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Khong the luu cau hinh AI.");
      }
    });
  }

  return (
    <main className="mx-auto min-h-svh max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/app" className="mb-4 inline-flex items-center gap-2 text-sm text-rune-bright">
            <ArrowLeft className="size-4" />
            Ve Quest App
          </Link>
          <h1 className="font-display text-4xl text-gold">Admin AI Control</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-text-dim">
            Cau hinh provider, model, API key va prompt dung chung cho toan bo he thong. Client khong bao gio nhan key that.
          </p>
        </div>
        <div className="border border-rune/35 bg-deep/70 p-4 text-sm text-text-dim">
          <p className="flex items-center gap-2 text-rune-bright">
            <ShieldCheck className="size-4" />
            Admin only
          </p>
          <p className="mt-1">Keys duoc mask trong UI.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <section className="border border-rune/25 bg-deep/72 p-5 shadow-rune">
          <h2 className="font-display text-2xl text-text-primary">Provider Priority</h2>
          <p className="mt-2 text-sm leading-6 text-text-dim">
            Mac dinh: Gemini, OpenAI, Anthropic. Provider khong co key se bi bo qua.
          </p>
          <div className="mt-5 grid gap-3">
            {[0, 1, 2, 3].map((index) => (
              <label key={index} className="block">
                <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-text-muted">
                  Uu tien {index + 1}
                </span>
                <select
                  value={settings.provider_priority[index] ?? PROVIDERS[index].value}
                  onChange={(event) => updatePriority(index, event.target.value as AiProvider)}
                  className="h-11 w-full border border-white/10 bg-void/70 px-3 text-sm text-text-primary outline-none focus:border-rune"
                >
                  {PROVIDERS.map((provider) => (
                    <option key={provider.value} value={provider.value}>
                      {provider.label} - {provider.help}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="mt-6 grid gap-3">
            {(["gemini", "openai", "anthropic"] as const).map((provider) => {
              const meta = settings.providers[provider];
              return (
                <div key={provider} className="border border-white/10 bg-void/45 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium capitalize text-text-primary">{provider}</span>
                    <span
                      className={
                        meta.source === "missing"
                          ? "text-ember"
                          : meta.source === "database"
                            ? "text-ice"
                            : "text-gold"
                      }
                    >
                      {meta.source}
                    </span>
                  </div>
                  <p className="mt-1 text-text-dim">{meta.maskedKey ?? "No key configured"}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="border border-rune/25 bg-deep/72 p-5 shadow-rune">
          <h2 className="font-display text-2xl text-text-primary">Models & Keys</h2>
          <div className="mt-5 grid gap-5">
            {[
              { provider: "gemini" as const, label: "Gemini", modelKey: "gemini_model" as const },
              { provider: "openai" as const, label: "OpenAI", modelKey: "openai_model" as const },
              { provider: "anthropic" as const, label: "Anthropic", modelKey: "anthropic_model" as const },
            ].map((item) => (
              <div key={item.provider} className="grid gap-3 border border-white/10 bg-void/35 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <label className="block">
                  <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-text-muted">
                    {item.label} model
                  </span>
                  <input
                    value={settings[item.modelKey]}
                    onChange={(event) =>
                      setSettings((value) => ({ ...value, [item.modelKey]: event.target.value }))
                    }
                    className="h-11 w-full border border-white/10 bg-void/70 px-3 text-sm text-text-primary outline-none focus:border-rune"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-text-muted">
                    New API key optional
                  </span>
                  <input
                    type="password"
                    value={keys[item.provider]}
                    onChange={(event) =>
                      setKeys((value) => ({ ...value, [item.provider]: event.target.value }))
                    }
                    className="h-11 w-full border border-white/10 bg-void/70 px-3 text-sm text-text-primary outline-none focus:border-rune"
                    placeholder="Leave blank to keep current key"
                  />
                </label>
                <label className="flex h-11 items-center gap-2 text-sm text-text-dim">
                  <input
                    type="checkbox"
                    checked={clearKeys[item.provider]}
                    onChange={(event) =>
                      setClearKeys((value) => ({ ...value, [item.provider]: event.target.checked }))
                    }
                  />
                  Clear DB key
                </label>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-text-muted">
                Temperature
              </span>
              <input
                type="number"
                min={0}
                max={2}
                step={0.05}
                value={settings.temperature}
                onChange={(event) =>
                  setSettings((value) => ({
                    ...value,
                    temperature: Number(event.target.value),
                  }))
                }
                className="h-11 w-full border border-white/10 bg-void/70 px-3 text-sm text-text-primary outline-none focus:border-rune"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-text-muted">
                Max output tokens
              </span>
              <input
                type="number"
                min={512}
                max={16000}
                step={256}
                value={settings.max_tokens}
                onChange={(event) =>
                  setSettings((value) => ({
                    ...value,
                    max_tokens: Number(event.target.value),
                  }))
                }
                className="h-11 w-full border border-white/10 bg-void/70 px-3 text-sm text-text-primary outline-none focus:border-rune"
              />
            </label>
          </div>

          <label className="mt-6 block">
            <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-text-muted">
              System prompt
            </span>
            <textarea
              value={settings.system_prompt}
              onChange={(event) =>
                setSettings((value) => ({ ...value, system_prompt: event.target.value }))
              }
              rows={14}
              className="w-full resize-y border border-white/10 bg-void/70 p-4 font-mono text-xs leading-6 text-text-primary outline-none focus:border-rune"
            />
          </label>

          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="mt-6 flex h-13 w-full items-center justify-center gap-3 border border-gold/60 bg-gold/18 font-display text-lg text-gold transition hover:bg-gold/25 disabled:opacity-60"
          >
            {isPending ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />}
            Save System AI Settings
          </button>

          <div className="mt-5 flex items-start gap-3 border border-rune/25 bg-rune/8 p-4 text-sm leading-6 text-text-dim">
            <Sparkles className="mt-1 size-5 shrink-0 text-rune-bright" />
            <p>
              DeepSeek da co trong priority schema de them adapter sau. Hien tai runtime chi goi Gemini, OpenAI va Anthropic.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

