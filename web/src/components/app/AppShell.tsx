"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bell,
  Compass,
  FileText,
  Flame,
  Home,
  LogOut,
  MoonStar,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getLevelProgress } from "@/lib/quest/levels";
import { ParticleCanvas } from "@/components/app/ParticleCanvas";

type Stats = {
  xp_total: number;
  level: number;
  streak_current: number;
  streak_max: number;
  quests_completed: number;
};

type AppShellProps = {
  children: React.ReactNode;
  displayName: string;
  userEmail: string;
  emailVerified: boolean;
  initialStats: Stats;
  isAdmin?: boolean;
};

const navItems = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app", label: "Overview", icon: BarChart3 },
  { href: "/app", label: "Quests", icon: Compass },
  { href: "/app/import", label: "Plan", icon: FileText },
  { href: "/app", label: "Stats", icon: Trophy },
];

export function AppShell({
  children,
  displayName,
  userEmail,
  emailVerified,
  initialStats,
  isAdmin = false,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [stats, setStats] = useState(initialStats);
  const [lowGraphics, setLowGraphics] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("quest-low-graphics") === "true",
  );
  const progress = useMemo(() => getLevelProgress(stats.xp_total), [stats.xp_total]);

  const refreshStats = useCallback(async () => {
    const response = await fetch("/api/users/me/stats", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    if (payload.success) setStats(payload.data);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("low-graphics", lowGraphics);
    localStorage.setItem("quest-low-graphics", String(lowGraphics));
  }, [lowGraphics]);

  useEffect(() => {
    window.addEventListener("quest:stats-refresh", refreshStats);
    return () => window.removeEventListener("quest:stats-refresh", refreshStats);
  }, [refreshStats]);

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push("/login");
  }

  return (
    <div className="relative min-h-svh overflow-hidden">
      <ParticleCanvas disabled={lowGraphics} />
      <div className="relative z-10 flex min-h-svh">
        <aside className="hidden w-[76px] shrink-0 border-r border-white/10 bg-void/70 backdrop-blur md:flex md:flex-col md:items-center md:py-4">
          <Link href="/app" className="mb-7 grid size-11 place-items-center border border-rune/50 text-rune-bright">
            <Sparkles className="size-6" />
          </Link>
          <nav className="flex flex-1 flex-col items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.href !== "/app" ? pathname.startsWith(item.href) : pathname === item.href;
              return (
                <Link
                  key={`${item.label}-${item.href}`}
                  href={item.href}
                  className={`grid w-full place-items-center gap-1 px-2 py-3 text-[11px] transition ${
                    active ? "text-rune-bright" : "text-text-dim hover:text-text-primary"
                  }`}
                >
                  <Icon className="size-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={() => setLowGraphics((value) => !value)}
            className="grid w-full place-items-center gap-1 px-2 py-3 text-[11px] text-text-dim transition hover:text-ice"
            aria-label="Toggle low graphics mode"
          >
            <Settings className="size-5" />
            <span>{lowGraphics ? "Lite" : "FX"}</span>
          </button>
          {isAdmin ? (
            <Link
              href="/admin"
              className="grid w-full place-items-center gap-1 px-2 py-3 text-[11px] text-gold transition hover:text-ice"
            >
              <ShieldCheck className="size-5" />
              <span>Admin</span>
            </Link>
          ) : null}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-white/10 bg-void/80 backdrop-blur">
            <div className="flex min-h-18 items-center gap-4 px-4 sm:px-6">
              <Link href="/app" className="flex min-w-0 items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center border border-rune/50 text-rune-bright">
                  <MoonStar className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-display text-lg text-text-primary">Nhiem Vu He Thong</p>
                  <p className="hidden text-[10px] uppercase tracking-[0.28em] text-text-dim sm:block">
                    Quest System
                  </p>
                </div>
              </Link>

              <div className="ml-auto hidden items-center gap-5 lg:flex">
                <div className="min-w-[180px]">
                  <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-text-dim">
                    <span>Lv. {stats.level}</span>
                    <span>
                      {stats.xp_total.toLocaleString()} /{" "}
                      {progress.next?.xp.toLocaleString() ?? "MAX"} XP
                    </span>
                  </div>
                  <div className="h-2 bg-white/10">
                    <div
                      className="h-full bg-rune"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 border-l border-white/10 pl-5 text-gold">
                  <Swords className="size-5" />
                  <div>
                    <p className="font-display text-lg leading-none">{stats.xp_total.toLocaleString()}</p>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-text-dim">XP</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 border-l border-white/10 pl-5 text-ember">
                  <Flame className="size-5" />
                  <div>
                    <p className="font-display text-lg leading-none">{stats.streak_current}</p>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-text-dim">Streak</p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="ml-auto text-text-dim transition hover:text-text-primary lg:ml-0"
                aria-label="Notifications"
              >
                <Bell className="size-5" />
              </button>
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-2 border border-white/10 px-3 py-2 text-xs text-text-dim transition hover:border-ember hover:text-ember"
                aria-label="Dang xuat"
              >
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
              {isAdmin ? (
                <Link
                  href="/admin"
                  className="hidden items-center gap-2 border border-gold/30 px-3 py-2 text-xs text-gold transition hover:border-gold sm:flex"
                >
                  <ShieldCheck className="size-4" />
                  Admin
                </Link>
              ) : null}
            </div>
            {!emailVerified ? (
              <div className="border-t border-ember/30 bg-ember/10 px-4 py-2 text-xs text-ember sm:px-6">
                Email {userEmail} chua verify. Ban van co the dung app, nhung nen xac nhan email de bao ve tai khoan.
              </div>
            ) : null}
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>

          <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-4 border-t border-white/10 bg-void/95 md:hidden">
            {[
              { href: "/app", label: "Home", icon: Home },
              { href: "/app/import", label: "Plan", icon: ScrollText },
              { href: "/app", label: "Quest", icon: Compass },
              isAdmin
                ? { href: "/admin", label: "Admin", icon: ShieldCheck }
                : { href: "/app", label: "Stats", icon: Trophy },
            ].map((item) => {
              const Icon = item.icon;
              const active = item.href !== "/app" ? pathname.startsWith(item.href) : pathname === item.href;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`grid place-items-center gap-1 py-2 text-[11px] ${
                    active ? "text-rune-bright" : "text-text-dim"
                  }`}
                >
                  <Icon className="size-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="h-14 md:hidden" />
        </div>
      </div>
      <span className="sr-only">Signed in as {displayName}</span>
    </div>
  );
}
