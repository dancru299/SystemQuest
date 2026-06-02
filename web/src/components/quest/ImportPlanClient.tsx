"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileUp, Loader2, Sparkles, UploadCloud } from "lucide-react";
import type { AiQuest } from "@/lib/validation/quest";
import { QuestOverviewPanel, fromAiQuest } from "@/components/quest/QuestOverviewPanel";

type ImportPlanClientProps = {
  activeQuestId?: string;
};

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const WARN_FILE_SIZE = 500 * 1024;

function getApiError(payload: unknown, fallback: string) {
  if (
    typeof payload === "object" &&
    payload &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }
  return fallback;
}

export function ImportPlanClient({ activeQuestId }: ImportPlanClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [planText, setPlanText] = useState("");
  const [questPreview, setQuestPreview] = useState<AiQuest | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isCreating, startCreating] = useTransition();

  const canAnalyze = planText.trim().length >= 50 && !isPending;

  async function loadFile(file: File) {
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File vượt quá giới hạn 2MB.");
      return;
    }
    if (file.size > WARN_FILE_SIZE) {
      toast.warning("File khá lớn, quá trình phân tích có thể lâu hơn.");
    }

    const lowerName = file.name.toLowerCase();
    try {
      if (lowerName.endsWith(".txt") || lowerName.endsWith(".md")) {
        const text = await file.text();
        setPlanText(text);
        toast.success("Đã tải file thành công.");
        return;
      }

      if (lowerName.endsWith(".docx")) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/files/extract-plan", {
          method: "POST",
          body: formData,
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(getApiError(payload, "Không thể đọc file .docx."));
        }
        setPlanText(payload.data.text);
        toast.success("Đã trích xuất nội dung .docx.");
        return;
      }

      toast.error("Chỉ hỗ trợ .txt, .md hoặc .docx.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể tải file.");
    }
  }

  function analyze() {
    if (!canAnalyze) return;
    setQuestPreview(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/quests/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planText }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(getApiError(payload, "AI chưa thể phân tích plan."));
        }
        setQuestPreview(payload.data.quest);
        toast.success("Hệ thống đã tạo lộ trình quest.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "AI chưa thể phân tích plan.");
      }
    });
  }

  function startQuest() {
    if (!questPreview) return;
    startCreating(async () => {
      try {
        const response = await fetch("/api/quests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quest: questPreview, planText }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(getApiError(payload, "Không thể lưu quest."));
        }
        window.dispatchEvent(new Event("quest:stats-refresh"));
        router.push(`/app/quests/${payload.data.questId}/days/${payload.data.currentDayNumber}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể lưu quest.");
      }
    });
  }

  if (questPreview) {
    return (
      <QuestOverviewPanel
        quest={fromAiQuest(questPreview)}
        isPreview
        isCreating={isCreating}
        onStart={startQuest}
        onReset={() => {
          if (confirm("Nhập plan mới sẽ bỏ preview hiện tại. Tiếp tục?")) {
            setQuestPreview(null);
          }
        }}
      />
    );
  }

  return (
    <section className="rune-border border border-rune/25 bg-deep/72 p-5 shadow-rune sm:p-7">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl text-text-primary sm:text-4xl">Import Plan</h1>
        <p className="mt-2 text-sm text-text-dim">
          He thong se phan tich plan cua ban va bien thanh he thong nhiem vu.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") fileInputRef.current?.click();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          const file = event.dataTransfer.files.item(0);
          if (file) void loadFile(file);
        }}
        className={`grid min-h-[210px] place-items-center border border-dashed p-6 text-center transition ${
          isDragging ? "border-gold bg-gold/8 text-gold" : "border-rune/70 bg-void/45 text-rune-bright"
        }`}
      >
        <div>
          <UploadCloud className="mx-auto mb-4 size-12" />
          <p className="font-display text-lg">Keo tha file vao day</p>
          <p className="mt-2 text-sm text-text-dim">hoac click de chon file</p>
          <p className="mt-3 text-xs text-text-muted">Ho tro: .txt, .md, .docx toi da 2MB</p>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.docx"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.item(0);
          if (file) void loadFile(file);
          event.currentTarget.value = "";
        }}
      />

      <div className="my-6 flex items-center gap-4 text-xs uppercase tracking-[0.25em] text-text-muted">
        <div className="h-px flex-1 bg-white/10" />
        hoac
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <label className="block">
        <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-text-muted">
          Dan noi dung plan cua ban
        </span>
        <textarea
          value={planText}
          onChange={(event) => setPlanText(event.target.value)}
          rows={9}
          className="w-full resize-y border border-white/10 bg-void/60 p-4 font-mono text-sm leading-7 text-text-primary outline-none transition placeholder:text-text-muted focus:border-rune"
          placeholder="Nhap hoac dan noi dung plan cua ban o day..."
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted">
        <span>{planText.length.toLocaleString()} / 10,000 ky tu</span>
        {planText.length > 0 && planText.length < 50 ? (
          <span className="text-ember">Can toi thieu 50 ky tu de kich hoat.</span>
        ) : null}
      </div>

      <div className="mt-6 border border-white/10 bg-void/45 p-4">
        <div className="flex gap-3 text-sm text-text-dim">
          <Sparkles className="mt-1 size-5 shrink-0 text-rune-bright" />
          <div className="grid gap-2">
            <p className="text-text-primary">He thong AI se:</p>
            <p>Phan tich muc tieu va chia thanh cac phase hop ly.</p>
            <p>Tao mission vu hanh dong ro, can bang kho do va thoi gian.</p>
            <p>Gioi han v1: toi da 30 ngay cho mot lan generate.</p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={analyze}
        disabled={!canAnalyze}
        className="mt-6 flex h-14 w-full items-center justify-center gap-3 border border-gold/60 bg-gold/18 font-display text-lg text-gold transition hover:bg-gold/25 disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-text-muted"
        title={planText.trim().length < 50 ? "Can toi thieu 50 ky tu" : undefined}
      >
        {isPending ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
        {isPending ? "Dang trieu hoi lo trinh..." : "Kich Hoat He Thong Nhiem Vu"}
      </button>

      {activeQuestId ? (
        <button
          type="button"
          onClick={() => router.push(`/app/quests/${activeQuestId}/days/1`)}
          className="mx-auto mt-5 flex items-center gap-2 text-sm text-rune-bright underline underline-offset-4"
        >
          <FileUp className="size-4" />
          Quay lai he thong nhiem vu cu
        </button>
      ) : null}

      {isPending ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-void/80 backdrop-blur-sm">
          <div className="border border-rune/35 bg-deep p-8 text-center shadow-rune">
            <Loader2 className="mx-auto mb-5 size-14 animate-spin text-ice" />
            <p className="font-display text-xl text-text-primary">Dang phan tich ke hoach...</p>
            <p className="mt-2 text-sm text-text-dim">Xay dung nhiem vu va mentor speech.</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
