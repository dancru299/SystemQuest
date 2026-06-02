"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, GitBranch, Plus, Save, Target, Trash2 } from "lucide-react";
import type { GoalContract, RoadmapItem } from "@/lib/validation/quest";

type QuestGoalContractEditorProps = {
  questId: string;
  initialGoalContract: GoalContract | null;
  initialRoadmap: RoadmapItem[];
  totalDays: number;
};

function listToText(values?: string[]) {
  return (values ?? []).join("\n");
}

function textToList(value: string, fallback: string[] = []) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length ? lines : fallback;
}

function emptyRoadmapItem(index: number): RoadmapItem {
  return {
    name: `Milestone ${index + 1}`,
    timeframe: "",
    objective: "",
    exitCriteria: "",
  };
}

function fallbackContract(totalDays: number): GoalContract {
  return {
    objective: "Hoan thanh muc tieu chinh cua quest.",
    deadline: `Trong ${totalDays} ngay`,
    targetDurationDays: totalDays,
    constraints: [],
    successCriteria: ["Hoan thanh muc tieu chinh dung han."],
    nonNegotiables: ["Muc tieu va deadline cua version hien tai."],
  };
}

export function QuestGoalContractEditor({
  questId,
  initialGoalContract,
  initialRoadmap,
  totalDays,
}: QuestGoalContractEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const baseContract = initialGoalContract ?? fallbackContract(totalDays);
  const [objective, setObjective] = useState(baseContract.objective);
  const [deadline, setDeadline] = useState(baseContract.deadline);
  const [targetDurationDays, setTargetDurationDays] = useState(baseContract.targetDurationDays ?? totalDays);
  const [constraints, setConstraints] = useState(listToText(baseContract.constraints));
  const [successCriteria, setSuccessCriteria] = useState(listToText(baseContract.successCriteria));
  const [nonNegotiables, setNonNegotiables] = useState(listToText(baseContract.nonNegotiables));
  const [revisionReason, setRevisionReason] = useState("");
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>(
    initialRoadmap.length ? initialRoadmap : [emptyRoadmapItem(0)],
  );

  function updateRoadmapItem(index: number, patch: Partial<RoadmapItem>) {
    setRoadmap((items) => items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function addRoadmapItem() {
    setRoadmap((items) => (items.length >= 24 ? items : [...items, emptyRoadmapItem(items.length)]));
  }

  function removeRoadmapItem(index: number) {
    setRoadmap((items) => (items.length <= 1 ? items : items.filter((_, itemIndex) => itemIndex !== index)));
  }

  function save() {
    startTransition(async () => {
      try {
        const normalizedRoadmap = roadmap.map((item, index) => ({
          name: item.name.trim() || `Milestone ${index + 1}`,
          timeframe: item.timeframe.trim() || `Phase ${index + 1}`,
          objective: item.objective.trim() || objective.trim(),
          exitCriteria: item.exitCriteria.trim() || "Dat du tieu chi cua milestone.",
        }));

        const goalContract: GoalContract = {
          objective: objective.trim(),
          deadline: deadline.trim(),
          targetDurationDays: Math.min(7300, Math.max(1, Math.round(targetDurationDays))),
          constraints: textToList(constraints),
          successCriteria: textToList(successCriteria, ["Hoan thanh muc tieu chinh dung han."]),
          nonNegotiables: textToList(nonNegotiables, ["Muc tieu va deadline cua version hien tai."]),
        };

        const response = await fetch(`/api/quests/${questId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goal_contract: goalContract,
            roadmap: normalizedRoadmap,
            revision_reason: revisionReason.trim() || "Goal contract changed",
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload?.error?.message || "Khong the luu revision.");
        }

        toast.success(`Da tao goal version ${payload.data.quest.goal_version}.`);
        setRevisionReason("");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Khong the luu revision.");
      }
    });
  }

  return (
    <section className="border border-rune/25 bg-deep/72 p-5 shadow-rune sm:p-7">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-ice">
            <GitBranch className="size-4" />
            Goal Revision
          </p>
          <h2 className="mt-2 font-display text-2xl text-text-primary">Dieu Chinh Contract</h2>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="flex h-12 items-center justify-center gap-2 border border-gold/60 bg-gold/12 px-5 text-sm font-semibold text-gold transition hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="size-4" />
          {isPending ? "Dang luu" : "Luu Revision"}
        </button>
      </div>

      <div className="grid gap-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <label className="block min-w-0">
            <span className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-text-muted">
              <Target className="size-4" />
              Objective
            </span>
            <textarea
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              rows={4}
              className="w-full resize-y border border-white/10 bg-void/70 px-3 py-3 text-sm leading-6 text-text-primary outline-none focus:border-ice"
            />
          </label>

          <div className="grid gap-4">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-text-muted">
                <CalendarDays className="size-4" />
                Deadline
              </span>
              <input
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
                className="h-11 w-full border border-white/10 bg-void/70 px-3 text-sm text-text-primary outline-none focus:border-ice"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-text-muted">Target Days</span>
              <input
                type="number"
                min={1}
                max={7300}
                value={targetDurationDays}
                onChange={(event) => setTargetDurationDays(Number(event.target.value))}
                className="h-11 w-full border border-white/10 bg-void/70 px-3 text-sm text-text-primary outline-none focus:border-ice"
              />
            </label>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <label className="block min-w-0">
            <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-text-muted">Constraints</span>
            <textarea
              value={constraints}
              onChange={(event) => setConstraints(event.target.value)}
              rows={5}
              className="w-full resize-y border border-white/10 bg-void/70 px-3 py-3 text-sm leading-6 text-text-primary outline-none focus:border-ice"
            />
          </label>
          <label className="block min-w-0">
            <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-text-muted">Success Criteria</span>
            <textarea
              value={successCriteria}
              onChange={(event) => setSuccessCriteria(event.target.value)}
              rows={5}
              className="w-full resize-y border border-white/10 bg-void/70 px-3 py-3 text-sm leading-6 text-text-primary outline-none focus:border-ice"
            />
          </label>
          <label className="block min-w-0">
            <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-text-muted">Non Negotiables</span>
            <textarea
              value={nonNegotiables}
              onChange={(event) => setNonNegotiables(event.target.value)}
              rows={5}
              className="w-full resize-y border border-white/10 bg-void/70 px-3 py-3 text-sm leading-6 text-text-primary outline-none focus:border-ice"
            />
          </label>
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-lg text-text-primary">Roadmap</h3>
            <button
              type="button"
              onClick={addRoadmapItem}
              className="flex h-10 items-center gap-2 border border-rune/45 px-3 text-sm text-rune-bright transition hover:bg-rune/10"
            >
              <Plus className="size-4" />
              Them Moc
            </button>
          </div>

          <div className="grid gap-3">
            {roadmap.map((item, index) => (
              <div
                key={index}
                className="grid gap-3 border border-white/10 bg-void/35 p-3 xl:grid-cols-[180px_180px_minmax(0,1fr)_minmax(0,1fr)_auto]"
              >
                <input
                  value={item.name}
                  onChange={(event) => updateRoadmapItem(index, { name: event.target.value })}
                  className="h-11 min-w-0 border border-white/10 bg-void/70 px-3 text-sm text-text-primary outline-none focus:border-ice"
                />
                <input
                  value={item.timeframe}
                  onChange={(event) => updateRoadmapItem(index, { timeframe: event.target.value })}
                  className="h-11 min-w-0 border border-white/10 bg-void/70 px-3 text-sm text-text-primary outline-none focus:border-ice"
                />
                <textarea
                  value={item.objective}
                  onChange={(event) => updateRoadmapItem(index, { objective: event.target.value })}
                  rows={2}
                  className="min-w-0 resize-y border border-white/10 bg-void/70 px-3 py-2 text-sm text-text-primary outline-none focus:border-ice"
                />
                <textarea
                  value={item.exitCriteria}
                  onChange={(event) => updateRoadmapItem(index, { exitCriteria: event.target.value })}
                  rows={2}
                  className="min-w-0 resize-y border border-white/10 bg-void/70 px-3 py-2 text-sm text-text-primary outline-none focus:border-ice"
                />
                <button
                  type="button"
                  onClick={() => removeRoadmapItem(index)}
                  disabled={roadmap.length <= 1}
                  className="grid size-11 place-items-center border border-ember/45 text-ember transition hover:bg-ember/10 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Remove roadmap item"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <label className="block min-w-0">
          <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-text-muted">Revision Reason</span>
          <textarea
            value={revisionReason}
            onChange={(event) => setRevisionReason(event.target.value)}
            rows={3}
            className="w-full resize-y border border-white/10 bg-void/70 px-3 py-3 text-sm leading-6 text-text-primary outline-none focus:border-ice"
          />
        </label>
      </div>
    </section>
  );
}
