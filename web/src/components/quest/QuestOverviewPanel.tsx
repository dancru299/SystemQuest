"use client";

import Link from "next/link";
import { CalendarDays, CheckCircle2, Flag, ScrollText, Shield, Swords } from "lucide-react";
import type { AiQuest, AiQuestDay, Phase } from "@/lib/validation/quest";

type OverviewQuest = {
  id?: string;
  title: string;
  mainGoal: string;
  totalDays: number;
  phases: Phase[];
  days: AiQuestDay[];
  completedDays?: number;
};

type QuestOverviewPanelProps = {
  quest: OverviewQuest;
  isPreview?: boolean;
  isCreating?: boolean;
  onStart?: () => void;
  onReset?: () => void;
};

function getMissionCount(days: AiQuestDay[]) {
  return days.reduce((total, day) => total + day.missions.length, 0);
}

export function fromAiQuest(quest: AiQuest): OverviewQuest {
  return {
    title: quest.title,
    mainGoal: quest.mainGoal,
    totalDays: quest.totalDays,
    phases: quest.phases,
    days: quest.days,
  };
}

export function QuestOverviewPanel({
  quest,
  isPreview = false,
  isCreating = false,
  onStart,
  onReset,
}: QuestOverviewPanelProps) {
  const missionCount = getMissionCount(quest.days);
  const completedDays = quest.completedDays ?? 0;

  return (
    <section className="rune-border border border-rune/25 bg-deep/72 p-5 shadow-rune sm:p-7">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl text-text-primary sm:text-4xl">
          Tong Quan Hanh Trinh
        </h1>
        <p className="mt-2 text-sm text-text-dim">
          Xem lai ke hoach va cac phase cua hanh trinh truoc khi bat dau.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Tong ngay", value: quest.totalDays, icon: CalendarDays, color: "text-rune-bright" },
          { label: "So phase", value: quest.phases.length, icon: Flag, color: "text-rune-bright" },
          { label: "Tong mission", value: missionCount, icon: Swords, color: "text-gold" },
          { label: "Da hoan thanh", value: completedDays, icon: CheckCircle2, color: "text-ice" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="border border-white/10 bg-void/45 p-4">
              <Icon className={`mb-3 size-6 ${stat.color}`} />
              <p className="font-display text-3xl text-text-primary">{stat.value}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-text-dim">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <div className="my-6 border border-gold/45 bg-gold/8 p-5">
        <div className="flex gap-4">
          <div className="hidden size-14 shrink-0 place-items-center border border-gold/50 text-gold sm:grid">
            <Shield className="size-7" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-gold">Muc tieu chinh</p>
            <h2 className="mt-2 font-display text-2xl text-gold">{quest.title}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-text-dim">{quest.mainGoal}</p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-4 font-display text-xl text-text-primary">Cac Phase</h2>
        <div className="divide-y divide-white/10 border border-white/10">
          {quest.phases.map((phase, index) => (
            <div key={`${phase.name}-${index}`} className="grid gap-4 p-4 sm:grid-cols-[64px_1fr_auto] sm:items-center">
              <div className="grid size-11 place-items-center border border-rune/50 font-display text-xl text-rune-bright">
                {index + 1}
              </div>
              <div>
                <p className="font-display text-base text-text-primary">{phase.name}</p>
                <p className="mt-1 text-sm leading-6 text-text-dim">{phase.desc}</p>
              </div>
              <div className="text-sm text-text-dim sm:text-right">
                <p>{phase.dayRange}</p>
                <p>{quest.days.filter((day) => day.day >= 1).length ? "" : null}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {isPreview ? (
          <>
            <button
              type="button"
              onClick={onStart}
              disabled={isCreating}
              className="flex h-14 items-center justify-center gap-3 border border-gold/70 bg-gold/18 font-display text-lg text-gold transition hover:bg-gold/25 disabled:opacity-60"
            >
              <Swords className="size-5" />
              {isCreating ? "Dang luu quest..." : "Bat Dau Hanh Trinh"}
            </button>
            <button
              type="button"
              onClick={onReset}
              disabled={isCreating}
              className="flex h-14 items-center justify-center gap-3 border border-rune/60 bg-rune/10 font-display text-lg text-rune-bright transition hover:bg-rune/20 disabled:opacity-60"
            >
              <ScrollText className="size-5" />
              Nhap Plan Moi
            </button>
          </>
        ) : (
          <>
            <Link
              href={quest.id ? `/app/quests/${quest.id}/days/1` : "/app"}
              className="flex h-14 items-center justify-center gap-3 border border-gold/70 bg-gold/18 font-display text-lg text-gold transition hover:bg-gold/25"
            >
              <Swords className="size-5" />
              Vao Quest Day
            </Link>
            <Link
              href="/app/import"
              className="flex h-14 items-center justify-center gap-3 border border-rune/60 bg-rune/10 font-display text-lg text-rune-bright transition hover:bg-rune/20"
            >
              <ScrollText className="size-5" />
              Nhap Plan Moi
            </Link>
          </>
        )}
      </div>
    </section>
  );
}

