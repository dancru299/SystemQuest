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
  Clock,
  Eye,
  FileText,
  MessageSquareText,
  RotateCcw,
  Save,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import type { Mission } from "@/lib/validation/quest";
import { getDayProgress, isDayComplete } from "@/lib/quest/progress";

type QuestDaySummary = {
  id: string;
  day_number: number;
  title: string;
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
  missions: Mission[];
  completed_mission_ids: string[];
};

type Stats = {
  expectedDay: number;
  missedDays: number;
};

type MissionReportStatus = "not_started" | "partial" | "done" | "blocked";

type MissionReport = {
  mission_id: string;
  status: MissionReportStatus;
  completion_percent: number;
  note: string;
};

type DayReport = {
  id?: string;
  overall_completion_percent: number;
  time_spent_minutes: number;
  blockers: string;
  outcome: string;
  notes: string;
  evidence_url: string;
  mission_reports: MissionReport[];
  submitted_at?: string | null;
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
  initialReport: DayReport | null;
};

const QUEUE_KEY = "quest-offline-events-v1";
const reportStatuses: Array<{ value: MissionReportStatus; label: string }> = [
  { value: "not_started", label: "Chua lam" },
  { value: "partial", label: "Dang lam" },
  { value: "done", label: "Hoan thanh" },
  { value: "blocked", label: "Bi chan" },
];

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function clampMinutes(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1440, Math.max(0, Math.round(value)));
}

function getAverageCompletion(reports: MissionReport[]) {
  if (!reports.length) return 0;
  return clampPercent(reports.reduce((sum, report) => sum + report.completion_percent, 0) / reports.length);
}

function defaultMissionReport(mission: Mission, completedIds: string[]): MissionReport {
  const completed = completedIds.includes(mission.id);
  return {
    mission_id: mission.id,
    status: completed ? "done" : "not_started",
    completion_percent: completed ? 100 : 0,
    note: "",
  };
}

function buildMissionReports(missions: Mission[], completedIds: string[], initialReport?: DayReport | null) {
  const existingReports = new Map(
    (initialReport?.mission_reports ?? []).map((report) => [report.mission_id, report]),
  );
  return missions
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((mission) => {
      const existing = existingReports.get(mission.id);
      if (!existing) return defaultMissionReport(mission, completedIds);
      return {
        mission_id: mission.id,
        status: existing.status,
        completion_percent: clampPercent(existing.completion_percent),
        note: existing.note ?? "",
      };
    });
}

function buildInitialReport(missions: Mission[], completedIds: string[], initialReport: DayReport | null): DayReport {
  const missionReports = buildMissionReports(missions, completedIds, initialReport);
  return {
    id: initialReport?.id,
    overall_completion_percent:
      typeof initialReport?.overall_completion_percent === "number"
        ? clampPercent(initialReport.overall_completion_percent)
        : getAverageCompletion(missionReports),
    time_spent_minutes: clampMinutes(initialReport?.time_spent_minutes ?? 0),
    blockers: initialReport?.blockers ?? "",
    outcome: initialReport?.outcome ?? "",
    notes: initialReport?.notes ?? "",
    evidence_url: initialReport?.evidence_url ?? "",
    mission_reports: missionReports,
    submitted_at: initialReport?.submitted_at ?? null,
  };
}

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

export function QuestDayClient({ quest, day, days, timing, initialReport }: QuestDayClientProps) {
  const router = useRouter();
  const [completedIds, setCompletedIds] = useState(day.completed_mission_ids);
  const [currentDayNumber, setCurrentDayNumber] = useState(quest.current_day_number);
  const [report, setReport] = useState(() => buildInitialReport(day.missions, day.completed_mission_ids, initialReport));
  const [overallEdited, setOverallEdited] = useState(Boolean(initialReport));
  const [showMissedModal, setShowMissedModal] = useState(timing.missedDays > 0);
  const [isRescheduling, startRescheduling] = useTransition();
  const [isSavingReport, startSavingReport] = useTransition();
  const [isAdaptingNextDay, startAdaptingNextDay] = useTransition();

  const sortedDays = useMemo(
    () => [...days].sort((a, b) => a.day_number - b.day_number),
    [days],
  );
  const sortedMissions = useMemo(
    () => [...day.missions].sort((a, b) => a.order - b.order),
    [day.missions],
  );
  const progress = getDayProgress(day.missions, completedIds);
  const dayComplete = isDayComplete(day.missions, completedIds);
  const unlockedDayNumber = Math.min(currentDayNumber, quest.total_days);
  const prevDay = Math.max(1, day.day_number - 1);
  const nextDay = Math.min(quest.total_days, day.day_number + 1);
  const canGoNext = day.day_number < quest.total_days && nextDay <= unlockedDayNumber;

  function patchReport(patch: Partial<DayReport>) {
    setReport((current) => ({ ...current, ...patch }));
  }

  function patchMissionReport(missionId: string, patch: Partial<MissionReport>) {
    setReport((current) => {
      const missionReports = current.mission_reports.map((missionReport) =>
        missionReport.mission_id === missionId ? { ...missionReport, ...patch } : missionReport,
      );
      return {
        ...current,
        mission_reports: missionReports,
        overall_completion_percent: overallEdited
          ? current.overall_completion_percent
          : getAverageCompletion(missionReports),
      };
    });
  }

  function patchOverallCompletion(value: number) {
    setOverallEdited(true);
    patchReport({ overall_completion_percent: clampPercent(value) });
  }

  function syncMissionReportCompletion(missionId: string, completed: boolean) {
    patchMissionReport(missionId, {
      status: completed ? "done" : "not_started",
      completion_percent: completed ? 100 : 0,
    });
  }

  function saveReport() {
    startSavingReport(async () => {
      try {
        const response = await fetch(`/api/quests/${quest.id}/days/${day.day_number}/report`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(report),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(getApiError(payload, "Khong the luu bao cao."));
        }
        setReport(buildInitialReport(day.missions, completedIds, payload.data.report));
        setOverallEdited(true);
        toast.success("Da luu bao cao cuoi ngay.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Khong the luu bao cao.");
      }
    });
  }

  function adaptNextDay() {
    startAdaptingNextDay(async () => {
      try {
        const response = await fetch(`/api/quests/${quest.id}/days/${day.day_number}/adapt-next`, {
          method: "POST",
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(getApiError(payload, "Khong the dieu chinh ngay sau."));
        }
        if (typeof payload.data.currentDayNumber === "number") {
          setCurrentDayNumber(payload.data.currentDayNumber);
        }
        toast.success("AI da dieu chinh ngay tiep theo.");
        router.push(`/app/quests/${quest.id}/days/${payload.data.currentDayNumber}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Khong the dieu chinh ngay sau.");
      }
    });
  }

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
        if (typeof data.current_day_number === "number") {
          setCurrentDayNumber(data.current_day_number);
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
      syncMissionReportCompletion(mission.id, nextCompleted);
      if (typeof data.current_day_number === "number") {
        setCurrentDayNumber(data.current_day_number);
      }
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

  return (
    <section className="mx-0 grid w-full min-w-0 gap-6 overflow-hidden">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-4xl text-text-primary">Ngay {day.day_number}</h1>
          <p className="mt-2 text-sm uppercase tracking-[0.2em] text-text-dim">
            {quest.title} • Quest Day {day.day_number} / {quest.total_days}
          </p>
        </div>
        <Link
          href={`/app/quests/${quest.id}/overview`}
          className="flex h-11 shrink-0 items-center gap-2 border border-white/15 px-4 text-sm text-text-dim transition hover:border-rune hover:text-rune-bright"
        >
          <Eye className="size-4" />
          Xem Phase
        </Link>
      </div>

      <div className="min-w-0 border border-white/10 bg-void/35 p-3">
        <div className="flex max-w-full min-w-0 items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
          <Link
            href={`/app/quests/${quest.id}/days/${prevDay}`}
            className="grid size-10 shrink-0 place-items-center text-text-dim transition hover:text-text-primary"
            aria-label="Ngay truoc"
          >
            <ChevronLeft className="size-5" />
          </Link>
          {sortedDays.map((questDay) => {
            const active = questDay.day_number === day.day_number;
            const unlocked = questDay.day_number <= unlockedDayNumber;
            const dayCellClassName = `grid h-16 min-w-12 place-items-center border text-sm transition ${
              active
                ? "border-gold bg-gold/12 text-gold shadow-[0_0_20px_rgba(255,215,0,0.28)]"
                : questDay.is_day_completed
                  ? "border-ice/30 text-ice hover:border-ice"
                  : unlocked
                    ? "border-white/10 text-text-dim hover:border-rune hover:text-rune-bright"
                    : "cursor-not-allowed border-white/10 text-text-muted opacity-45"
            }`;
            const content = (
              <>
                <span>{questDay.day_number}</span>
                {questDay.is_day_completed ? <CheckCircle2 className="size-4" /> : <span className="size-4 rounded-full border border-current opacity-50" />}
              </>
            );
            if (!unlocked) {
              return (
                <button
                  key={questDay.id}
                  type="button"
                  disabled
                  className={dayCellClassName}
                  aria-label={`Ngay ${questDay.day_number} chua mo khoa`}
                >
                  {content}
                </button>
              );
            }
            return (
              <Link
                key={questDay.id}
                href={`/app/quests/${quest.id}/days/${questDay.day_number}`}
                className={dayCellClassName}
              >
                {content}
              </Link>
            );
          })}
          {canGoNext ? (
            <Link
              href={`/app/quests/${quest.id}/days/${nextDay}`}
              className="grid size-10 shrink-0 place-items-center text-text-dim transition hover:text-text-primary"
              aria-label="Ngay sau"
            >
              <ChevronRight className="size-5" />
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="grid size-10 shrink-0 cursor-not-allowed place-items-center text-text-muted opacity-50"
              aria-label="Ngay sau chua mo khoa"
            >
              <ChevronRight className="size-5" />
            </button>
          )}
        </div>
      </div>

      <div className="min-w-0">
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

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]">
        <aside className="min-w-0 border border-rune/35 bg-deep/65 p-5">
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

        <div className="min-w-0 border border-white/10 bg-deep/65">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <h2 className="min-w-0 font-display text-lg text-text-primary">Nhiem vu trong ngay</h2>
            <p className="shrink-0 text-sm text-text-dim">
              Hoan thanh {progress.completed} / {progress.total}
            </p>
          </div>
          <div className="divide-y divide-white/10">
            {sortedMissions.map((mission) => {
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
                    className="grid w-full min-w-0 gap-4 p-4 text-left transition hover:bg-white/[0.03] sm:grid-cols-[44px_minmax(0,1fr)_auto] sm:items-center"
                  >
                    <span
                      className={`grid size-9 place-items-center border ${
                        completed ? "border-ice bg-ice/12 text-ice" : "border-gold text-gold"
                      }`}
                    >
                      {completed ? <Check className="size-5" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block break-words font-medium text-text-primary ${
                          completed ? "text-text-muted line-through" : ""
                        }`}
                      >
                        {mission.title}
                      </span>
                      <span className={`mt-1 block break-words text-sm leading-6 ${completed ? "text-text-muted" : "text-text-dim"}`}>
                        {mission.desc}
                      </span>
                    </span>
                    <span className="flex min-w-0 flex-wrap items-center gap-3 sm:justify-end">
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

      <form
        onSubmit={(event) => {
          event.preventDefault();
          saveReport();
        }}
        className="min-w-0 border border-white/10 bg-deep/65"
      >
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <FileText className="size-5 shrink-0 text-ice" />
            <h2 className="min-w-0 font-display text-lg text-text-primary">Bao cao cuoi ngay</h2>
          </div>
          {report.submitted_at ? (
            <p className="text-xs uppercase tracking-[0.18em] text-text-dim">Da luu</p>
          ) : null}
        </div>

        <div className="grid gap-5 p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <label className="block min-w-0">
              <span className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-text-muted">
                <ShieldAlert className="size-4" />
                Tong muc do hoan thanh
              </span>
              <div className="flex min-w-0 items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={report.overall_completion_percent}
                  onChange={(event) => patchOverallCompletion(Number(event.target.value))}
                  className="min-w-0 flex-1 accent-[#64ffda]"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={report.overall_completion_percent}
                  onChange={(event) => patchOverallCompletion(Number(event.target.value))}
                  className="h-11 w-20 border border-white/10 bg-void/70 px-3 text-right text-sm text-text-primary outline-none focus:border-ice"
                />
                <span className="text-sm text-text-dim">%</span>
              </div>
            </label>

            <label className="block min-w-0">
              <span className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-text-muted">
                <Clock className="size-4" />
                Thoi gian
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={1440}
                  value={report.time_spent_minutes}
                  onChange={(event) => patchReport({ time_spent_minutes: clampMinutes(Number(event.target.value)) })}
                  className="h-11 w-full border border-white/10 bg-void/70 px-3 text-sm text-text-primary outline-none focus:border-ice"
                />
                <span className="shrink-0 text-sm text-text-dim">phut</span>
              </div>
            </label>
          </div>

          <div className="grid gap-3">
            {sortedMissions.map((mission) => {
              const missionReport =
                report.mission_reports.find((item) => item.mission_id === mission.id) ??
                defaultMissionReport(mission, completedIds);
              return (
                <div
                  key={mission.id}
                  className="grid min-w-0 gap-3 border border-white/10 bg-void/35 p-3 xl:grid-cols-[minmax(180px,1fr)_170px_180px_minmax(220px,1.1fr)] xl:items-end"
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium text-text-primary">{mission.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-text-muted">{mission.type}</p>
                  </div>

                  <label className="block min-w-0">
                    <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-text-muted">Trang thai</span>
                    <select
                      value={missionReport.status}
                      onChange={(event) => {
                        const status = event.target.value as MissionReportStatus;
                        patchMissionReport(mission.id, {
                          status,
                          completion_percent:
                            status === "done"
                              ? 100
                              : status === "not_started"
                                ? 0
                                : missionReport.completion_percent,
                        });
                      }}
                      className="h-11 w-full border border-white/10 bg-void/70 px-3 text-sm text-text-primary outline-none focus:border-ice"
                    >
                      {reportStatuses.map((status) => (
                        <option key={status.value} value={status.value} className="bg-void text-text-primary">
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block min-w-0">
                    <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-text-muted">Muc do</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={missionReport.completion_percent}
                        onChange={(event) =>
                          patchMissionReport(mission.id, {
                            completion_percent: clampPercent(Number(event.target.value)),
                          })
                        }
                        className="h-11 w-full border border-white/10 bg-void/70 px-3 text-sm text-text-primary outline-none focus:border-ice"
                      />
                      <span className="text-sm text-text-dim">%</span>
                    </div>
                  </label>

                  <label className="block min-w-0">
                    <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-text-muted">Ghi chu mission</span>
                    <input
                      value={missionReport.note}
                      onChange={(event) => patchMissionReport(mission.id, { note: event.target.value })}
                      className="h-11 w-full border border-white/10 bg-void/70 px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-ice"
                      placeholder="Ket qua, lech so voi du kien..."
                    />
                  </label>
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block min-w-0">
              <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-text-muted">Ket qua thuc te</span>
              <textarea
                value={report.outcome}
                onChange={(event) => patchReport({ outcome: event.target.value })}
                rows={4}
                className="w-full resize-y border border-white/10 bg-void/70 px-3 py-3 text-sm leading-6 text-text-primary outline-none placeholder:text-text-muted focus:border-ice"
                placeholder="Da tao duoc gi, so lieu, dau ra..."
              />
            </label>

            <label className="block min-w-0">
              <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-text-muted">Blocker</span>
              <textarea
                value={report.blockers}
                onChange={(event) => patchReport({ blockers: event.target.value })}
                rows={4}
                className="w-full resize-y border border-white/10 bg-void/70 px-3 py-3 text-sm leading-6 text-text-primary outline-none placeholder:text-text-muted focus:border-ice"
                placeholder="Kho khan, viec bi chan, ly do khong xong..."
              />
            </label>

            <label className="block min-w-0">
              <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-text-muted">Ghi chu</span>
              <textarea
                value={report.notes}
                onChange={(event) => patchReport({ notes: event.target.value })}
                rows={3}
                className="w-full resize-y border border-white/10 bg-void/70 px-3 py-3 text-sm leading-6 text-text-primary outline-none placeholder:text-text-muted focus:border-ice"
                placeholder="Dieu can dieu chinh cho ngay sau..."
              />
            </label>

            <label className="block min-w-0">
              <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-text-muted">Evidence URL</span>
              <input
                value={report.evidence_url}
                onChange={(event) => patchReport({ evidence_url: event.target.value })}
                className="h-11 w-full border border-white/10 bg-void/70 px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-ice"
                placeholder="https://..."
              />
            </label>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            {dayComplete && day.day_number < quest.total_days ? (
              <button
                type="button"
                disabled={isAdaptingNextDay}
                onClick={adaptNextDay}
                className="flex h-12 min-w-52 items-center justify-center gap-2 border border-gold/50 bg-gold/10 px-5 text-sm font-semibold text-gold transition hover:bg-gold/18 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Sparkles className="size-4" />
                {isAdaptingNextDay ? "Dang dieu chinh" : "AI dieu chinh ngay sau"}
              </button>
            ) : null}
            <button
              type="submit"
              disabled={isSavingReport}
              className="flex h-12 min-w-44 items-center justify-center gap-2 border border-ice/50 bg-ice/10 px-5 text-sm font-semibold text-ice transition hover:bg-ice/18 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="size-4" />
              {isSavingReport ? "Dang luu" : "Luu bao cao"}
            </button>
          </div>
        </div>
      </form>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link
          href={`/app/quests/${quest.id}/overview`}
          className="flex h-13 min-w-0 items-center justify-center gap-2 border border-white/15 px-3 text-center text-sm text-text-dim transition hover:border-rune hover:text-rune-bright"
        >
          <Eye className="size-4" />
          <span className="truncate">Overview</span>
        </Link>
        <Link
          href={`/app/quests/${quest.id}/days/${prevDay}`}
          className="flex h-13 min-w-0 items-center justify-center gap-2 border border-rune/45 px-3 text-center text-sm text-rune-bright transition hover:bg-rune/10"
        >
          <ArrowLeft className="size-4" />
          <span className="truncate">Ngay Truoc</span>
        </Link>
        {canGoNext ? (
          <Link
            href={`/app/quests/${quest.id}/days/${nextDay}`}
            className="flex h-13 min-w-0 items-center justify-center gap-2 border border-gold/55 bg-gold/10 px-3 text-center text-sm text-gold transition hover:bg-gold/18"
          >
            <span className="truncate">Ngay Sau</span>
            <ArrowRight className="size-4" />
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="flex h-13 min-w-0 cursor-not-allowed items-center justify-center gap-2 border border-white/10 px-3 text-center text-sm text-text-muted opacity-60"
          >
            <span className="truncate">Ngay Sau</span>
            <ArrowRight className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setCompletedIds([]);
            toast.info("Reset UI local. Server XP ledger không bị trừ trong MVP.");
          }}
          className="flex h-13 min-w-0 items-center justify-center gap-2 border border-ember/55 px-3 text-center text-sm text-ember transition hover:bg-ember/10"
        >
          <RotateCcw className="size-4" />
          <span className="truncate">Reset Ngay</span>
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
