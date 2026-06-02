"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  MessageSquareText,
  RotateCcw,
} from "lucide-react";
import type { Mission } from "@/lib/validation/quest";
import { getDayProgress, isDayComplete } from "@/lib/quest/progress";

type QuestDaySummary = {
  id: string;
  day_number: number;
  title: string;
  missions: Mission[];
  completed_mission_ids: string[];
  is_day_completed: boolean;
};

type Quest = {
  id: string;
  title: string;
  total_days: number;
  current_day_number: number;
  start_date: string | null;
};

type QuestDay = QuestDaySummary & {
  mentor_speech: string | null;
};

type Stats = {
  expectedDay: number;
  missedDays: number;
};

type QueueEvent = {
  questId: string;
  dayNumber: number;
  missionId: string;
  completed: boolean;
  clientEventId: string;
  timestamp: number;
};

type QuestDayClientProps = {
  quest: Quest;
  day: QuestDay;
  days: QuestDaySummary[];
  timing: Stats;
};

const QUEUE_KEY = "quest-offline-events-v1";

function readQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [] as QueueEvent[];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueueEvent[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueueEvent[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

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

async function sendToggle(event: QueueEvent) {
  const response = await fetch(
    `/api/quests/${event.questId}/days/${event.dayNumber}/missions`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mission_id: event.missionId,
        completed: event.completed,
        client_event_id: event.clientEventId,
      }),
    },
  );
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(getApiError(payload, "Không thể đồng bộ mission."));
  }
  return payload.data;
}

export function QuestDayClient({ quest, day, days, timing }: QuestDayClientProps) {
  const router = useRouter();
  const [completedIds, setCompletedIds] = useState(day.completed_mission_ids);
  const [showMissedModal, setShowMissedModal] = useState(timing.missedDays > 0);
  const [isRescheduling, startRescheduling] = useTransition();

  const sortedDays = useMemo(
    () => [...days].sort((a, b) => a.day_number - b.day_number),
    [days],
  );
  const progress = getDayProgress(day.missions, completedIds);
  const dayComplete = isDayComplete(day.missions, completedIds);

  const syncQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    const queue = readQueue().sort((a, b) => a.timestamp - b.timestamp);
    if (!queue.length) return;

    const remaining: QueueEvent[] = [];
    for (const queuedEvent of queue) {
      try {
        const data = await sendToggle(queuedEvent);
        if (queuedEvent.questId === quest.id && queuedEvent.dayNumber === day.day_number) {
          setCompletedIds(data.quest_day.completed_mission_ids ?? []);
        }
        if (data.xp_gained > 0) {
          toast.success(`+${data.xp_gained} XP da dong bo.`);
          window.dispatchEvent(new Event("quest:stats-refresh"));
        }
      } catch {
        remaining.push(queuedEvent);
      }
    }
    writeQueue(remaining);
  }, [day.day_number, quest.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void syncQueue();
    }, 0);
    window.addEventListener("online", syncQueue);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", syncQueue);
    };
  }, [syncQueue]);

  async function toggleMission(mission: Mission, timestamp: number) {
    const wasComplete = completedIds.includes(mission.id);
    const nextCompleted = !wasComplete;
    const previousIds = completedIds;
    const nextIds = nextCompleted
      ? [...completedIds, mission.id]
      : completedIds.filter((id) => id !== mission.id);

    setCompletedIds(nextIds);

    const event: QueueEvent = {
      questId: quest.id,
      dayNumber: day.day_number,
      missionId: mission.id,
      completed: nextCompleted,
      clientEventId: crypto.randomUUID(),
      timestamp,
    };

    if (!navigator.onLine) {
      writeQueue([...readQueue(), event]);
      toast.warning("Mất mạng. Mission đã lưu offline và sẽ đồng bộ sau.");
      return;
    }

    try {
      const data = await sendToggle(event);
      const serverIds = data.quest_day.completed_mission_ids ?? nextIds;
      const wasDayComplete = isDayComplete(day.missions, previousIds);
      const isServerDayComplete = isDayComplete(day.missions, serverIds);
      setCompletedIds(serverIds);
      if (data.xp_gained > 0) {
        toast.success(`+${data.xp_gained} XP`);
        window.dispatchEvent(new Event("quest:stats-refresh"));
      }
      if (!wasDayComplete && isServerDayComplete) {
        confetti({
          particleCount: 30,
          spread: 64,
          origin: { y: 0.72 },
          colors: ["#7C4DFF", "#FFD700", "#64FFDA", "#FF6B35"],
          disableForReducedMotion: true,
        });
        toast.success("Hoàn thành toàn bộ Main Mission trong ngày.");
      }
    } catch (error) {
      setCompletedIds(previousIds);
      writeQueue([...readQueue(), event]);
      toast.error(error instanceof Error ? error.message : "Đã lưu event vào offline queue.");
    }
  }

  function applyMissedAction(action: "continue" | "reschedule") {
    startRescheduling(async () => {
      try {
        const response = await fetch(`/api/quests/${quest.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(getApiError(payload, "Không thể cập nhật lộ trình."));
        }
        setShowMissedModal(false);
        window.dispatchEvent(new Event("quest:stats-refresh"));
        if (action === "continue") {
          router.push(`/app/quests/${quest.id}/days/${payload.data.quest.current_day_number}`);
        } else {
          router.refresh();
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không thể cập nhật lộ trình.");
      }
    });
  }

  const prevDay = Math.max(1, day.day_number - 1);
  const nextDay = Math.min(quest.total_days, day.day_number + 1);

  return (
    <section className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-text-primary">Ngay {day.day_number}</h1>
          <p className="mt-2 text-sm uppercase tracking-[0.2em] text-text-dim">
            {quest.title} • Quest Day {day.day_number} / {quest.total_days}
          </p>
        </div>
        <Link
          href={`/app/quests/${quest.id}/overview`}
          className="flex h-11 items-center gap-2 border border-white/15 px-4 text-sm text-text-dim transition hover:border-rune hover:text-rune-bright"
        >
          <Eye className="size-4" />
          Xem Phase
        </Link>
      </div>

      <div className="border border-white/10 bg-void/35 p-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Link
            href={`/app/quests/${quest.id}/days/${prevDay}`}
            className="grid size-10 shrink-0 place-items-center text-text-dim transition hover:text-text-primary"
            aria-label="Ngay truoc"
          >
            <ChevronLeft className="size-5" />
          </Link>
          {sortedDays.map((questDay) => {
            const active = questDay.day_number === day.day_number;
            return (
              <Link
                key={questDay.id}
                href={`/app/quests/${quest.id}/days/${questDay.day_number}`}
                className={`grid h-16 min-w-12 place-items-center border text-sm transition ${
                  active
                    ? "border-gold bg-gold/12 text-gold shadow-[0_0_20px_rgba(255,215,0,0.28)]"
                    : questDay.is_day_completed
                      ? "border-ice/30 text-ice hover:border-ice"
                      : "border-white/10 text-text-dim hover:border-rune hover:text-rune-bright"
                }`}
              >
                <span>{questDay.day_number}</span>
                {questDay.is_day_completed ? <CheckCircle2 className="size-4" /> : <span className="size-4 rounded-full border border-current opacity-50" />}
              </Link>
            );
          })}
          <Link
            href={`/app/quests/${quest.id}/days/${nextDay}`}
            className="grid size-10 shrink-0 place-items-center text-text-dim transition hover:text-text-primary"
            aria-label="Ngay sau"
          >
            <ChevronRight className="size-5" />
          </Link>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-text-dim">
          <span>Tien do ngay</span>
          <span>{progress.percentage}%</span>
        </div>
        <div className="h-3 bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-rune to-ice transition-all"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <aside className="border border-rune/35 bg-deep/65 p-5">
          <div className="mx-auto mb-4 grid size-24 place-items-center border border-rune/40 bg-void/60 text-rune-bright">
            <MessageSquareText className="size-10" />
          </div>
          <p className="text-center text-xs uppercase tracking-[0.22em] text-rune-bright">
            He Thong Huong Dan
          </p>
          <p className="mt-4 text-sm leading-7 text-text-dim">
            {day.mentor_speech || "Tot lam, Nha Lua Chon. Hay hoan thanh tung mission mot cach chac chan."}
          </p>
        </aside>

        <div className="border border-white/10 bg-deep/65">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h2 className="font-display text-lg text-text-primary">Nhiem vu trong ngay</h2>
            <p className="text-sm text-text-dim">
              Hoan thanh {progress.completed} / {progress.total}
            </p>
          </div>
          <div className="divide-y divide-white/10">
            {day.missions
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((mission) => {
                const completed = completedIds.includes(mission.id);
                const tone =
                  mission.type === "main"
                    ? "border-gold/50 text-gold"
                    : mission.type === "bonus"
                      ? "border-rune/50 text-rune-bright"
                      : "border-white/20 text-text-dim";
                return (
                  <button
                    key={mission.id}
                    type="button"
                    onClick={(event) => void toggleMission(mission, event.timeStamp)}
                    className="grid w-full gap-4 p-4 text-left transition hover:bg-white/[0.03] sm:grid-cols-[44px_1fr_auto] sm:items-center"
                  >
                    <span
                      className={`grid size-9 place-items-center border ${
                        completed ? "border-ice bg-ice/12 text-ice" : "border-gold text-gold"
                      }`}
                    >
                      {completed ? <Check className="size-5" /> : null}
                    </span>
                    <span>
                      <span
                        className={`block font-medium text-text-primary ${
                          completed ? "text-text-muted line-through" : ""
                        }`}
                      >
                        {mission.title}
                      </span>
                      <span className={`mt-1 block text-sm leading-6 ${completed ? "text-text-muted" : "text-text-dim"}`}>
                        {mission.desc}
                      </span>
                    </span>
                    <span className="flex items-center gap-3 sm:justify-end">
                      <span className={`border px-3 py-1 text-xs uppercase tracking-[0.15em] ${tone}`}>
                        {mission.type}
                      </span>
                      <span className="min-w-16 text-right text-sm text-gold">+{mission.xp_reward} XP</span>
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Link
          href={`/app/quests/${quest.id}/overview`}
          className="flex h-13 items-center justify-center gap-2 border border-white/15 text-text-dim transition hover:border-rune hover:text-rune-bright"
        >
          <Eye className="size-4" />
          Overview
        </Link>
        <Link
          href={`/app/quests/${quest.id}/days/${prevDay}`}
          className="flex h-13 items-center justify-center gap-2 border border-rune/45 text-rune-bright transition hover:bg-rune/10"
        >
          <ArrowLeft className="size-4" />
          Ngay Truoc
        </Link>
        <Link
          href={`/app/quests/${quest.id}/days/${nextDay}`}
          className="flex h-13 items-center justify-center gap-2 border border-gold/55 bg-gold/10 text-gold transition hover:bg-gold/18"
        >
          Ngay Sau
          <ArrowRight className="size-4" />
        </Link>
        <button
          type="button"
          onClick={() => {
            setCompletedIds([]);
            toast.info("Reset UI local. Server XP ledger không bị trừ trong MVP.");
          }}
          className="flex h-13 items-center justify-center gap-2 border border-ember/55 text-ember transition hover:bg-ember/10"
        >
          <RotateCcw className="size-4" />
          Reset Ngay
        </button>
      </div>

      {showMissedModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-void/80 px-4 backdrop-blur-sm">
          <div className="max-w-lg border border-rune/40 bg-deep p-6 shadow-rune">
            <h2 className="font-display text-2xl text-gold">Ban da bo lo {timing.missedDays} ngay</h2>
            <p className="mt-3 text-sm leading-7 text-text-dim">
              Quest Day khong tu nhay qua ngay moi. Hay chon cach tiep tuc; ca hai lua chon se reset streak hien tai.
            </p>
            <div className="mt-6 grid gap-3">
              <button
                type="button"
                disabled={isRescheduling}
                onClick={() => applyMissedAction("continue")}
                className="border border-gold/60 bg-gold/12 p-4 text-left text-gold transition hover:bg-gold/20 disabled:opacity-60"
              >
                <span className="block font-display text-lg">Tiep tuc tu Quest Day ke tiep</span>
                <span className="mt-1 block text-sm text-text-dim">
                  Nhay den ngay {Math.min(timing.expectedDay, quest.total_days)} va bo qua cac ngay da lo.
                </span>
              </button>
              <button
                type="button"
                disabled={isRescheduling}
                onClick={() => applyMissedAction("reschedule")}
                className="border border-rune/60 bg-rune/10 p-4 text-left text-rune-bright transition hover:bg-rune/20 disabled:opacity-60"
              >
                <span className="block font-display text-lg">Reschedule lo trinh</span>
                <span className="mt-1 block text-sm text-text-dim">
                  Doi start_date de giu ban o Quest Day {quest.current_day_number}.
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <span className="sr-only">{dayComplete ? "Quest day main missions completed" : "Quest day in progress"}</span>
    </section>
  );
}
