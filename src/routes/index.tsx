import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  CalendarDays,
  CalendarCheck,
  Target,
  Coins,
  Sparkles,
  Plus,
  AlertCircle,
  Flame,
  Rocket,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useTracker } from "@/hooks/useTracker";
import { OnboardingDialog } from "@/components/tracker/OnboardingDialog";
import { DailyEntryDialog } from "@/components/tracker/DailyEntryDialog";
import { StatCard } from "@/components/tracker/StatCard";
import { EarningsLine, ExpectedVsActual } from "@/components/tracker/Charts";
import { GamificationPanel } from "@/components/tracker/Gamification";
import { WeeklyReview } from "@/components/tracker/WeeklyReview";
import { computeAnalytics, computeEntryTargetDeductions, entryNet, entryTargetNetUsing, entryTotalExpenses, formatEGP, todayISO } from "@/lib/tracker/analytics";
import type { DailyEntry } from "@/lib/tracker/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — 105 Day Target Tracker" },
      {
        name: "description",
        content: "Your live progress toward 220 EGP/day for 105 days.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const {
    hydrated,
    settings,
    entries,
    categories,
    updateSettings,
    upsertEntry,
    addCategory,
  } = useTracker();
  const [entryOpen, setEntryOpen] = useState(false);
  const [editing, setEditing] = useState<DailyEntry | null>(null);
  const [showAllStats, setShowAllStats] = useState(false);


  const analytics = useMemo(
    () => (settings ? computeAnalytics(entries, settings, categories) : null),
    [entries, settings, categories],
  );
  const catMap = useMemo(() => {
    const m = new Map<string, typeof categories[number]>();
    for (const c of categories) m.set(c.name, c);
    return m;
  }, [categories]);

  const openAddToday = () => {
    setEditing(analytics?.todaysEntry ?? null);
    setEntryOpen(true);
  };

  // Keyboard shortcut: N to add today
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (entryOpen) return;
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/i.test(t.tagName)) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        openAddToday();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analytics?.todaysEntry, entryOpen]);

  if (!hydrated) return <div className="h-40 animate-pulse rounded-2xl bg-muted/40" />;

  if (!settings) {
    return (
      <OnboardingDialog
        open
        onComplete={(s) => {
          updateSettings(s);
          toast.success("Challenge started — let's go!");
        }}
      />
    );
  }

  if (!analytics) return null;

  const a = analytics;
  const ahead = a.difference >= 0;
  const aheadTone = ahead ? "success" : "destructive";

  const last7 = [...entries]
    .sort((x, y) => (x.date < y.date ? 1 : -1))
    .slice(0, 7);
  const deductionsMap = computeEntryTargetDeductions(entries, catMap);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="glass-card relative overflow-hidden p-6 md:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: "var(--gradient-glow)" }} />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              {a.notStarted
                ? `Starts in ${a.daysUntilStart} day${a.daysUntilStart === 1 ? "" : "s"}`
                : `Day ${Math.min(a.daysElapsed, settings.totalDays)} of ${settings.totalDays}`}
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              {a.notStarted ? (
                <>Get ready to <span className="gradient-text">launch</span></>
              ) : a.isCompleted ? (
                <span className="gradient-text">Challenge Completed</span>
              ) : ahead ? (
                <>You're <span className="gradient-text">ahead</span> by {formatEGP(a.difference)}</>
              ) : (
                <>You're behind by <span className="text-destructive">{formatEGP(Math.abs(a.difference))}</span></>
              )}
            </h1>
            <p className="max-w-md text-sm text-muted-foreground">
              {a.notStarted
                ? `Challenge begins ${settings.startDate}. You can pre-log earnings any time.`
                : ahead
                ? `That's about ${a.aheadDays.toFixed(1)} days ahead of schedule. Keep the momentum.`
                : `That's about ${a.behindDays.toFixed(1)} days behind. You need ${formatEGP(a.requiredDailyToRecover)}/day for ${a.daysRemaining} days to recover.`}
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            <Button size="lg" className="glow-primary" onClick={openAddToday}>
              <Plus className="mr-1.5 h-4 w-4" />
              {a.todaysEntry ? "Edit today" : "Add today"}
            </Button>
            {a.missingToday && (
              <div className="inline-flex items-center gap-1.5 text-xs text-[color:var(--warning)]">
                <AlertCircle className="h-3.5 w-3.5" />
                Today not logged yet
              </div>
            )}
            {a.currentStreak > 0 && (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--warning)]/10 px-3 py-1 text-xs font-medium text-[color:var(--warning)]">
                <Flame className="h-3.5 w-3.5" />
                {a.currentStreak}-day streak
              </div>
            )}
          </div>
        </div>

        <div className="relative mt-6">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress to {formatEGP(a.goalTotal)}</span>
            <span className="stat-number text-foreground">{a.progressPct.toFixed(1)}%</span>
          </div>
          <Progress value={a.progressPct} className="h-2.5" />
        </div>
      </section>

      {/* Primary stats — always visible */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Net profit" value={formatEGP(a.netProfit)} icon={Wallet} tone="primary" />
        <StatCard
          label={ahead ? "Ahead by" : "Behind by"}
          value={formatEGP(Math.abs(a.difference))}
          hint={ahead ? `≈ ${a.aheadDays.toFixed(1)} days` : `≈ ${a.behindDays.toFixed(1)} days`}
          icon={ahead ? TrendingUp : TrendingDown}
          tone={aheadTone}
        />
        <StatCard
          label="Days remaining"
          value={`${a.daysRemaining}`}
          hint={`Ends ${a.endDate}`}
          icon={CalendarDays}
        />
        <StatCard
          label="Current streak"
          value={`${a.currentStreak} ${a.currentStreak === 1 ? "day" : "days"}`}
          hint={`Best: ${a.bestStreak}`}
          icon={Flame}
          tone={a.currentStreak > 0 ? "warning" : "default"}
        />
      </section>

      {/* Secondary stats — collapsed on mobile to keep the screen scannable */}
      <div className="md:hidden">
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => setShowAllStats((v) => !v)}
        >
          {showAllStats ? "Hide extra stats" : "Show all stats"}
        </Button>
      </div>
      <section
        className={cn(
          "grid-cols-2 gap-3 md:grid md:grid-cols-4",
          showAllStats ? "grid" : "hidden",
        )}
      >
        <StatCard label="Total earnings" value={formatEGP(a.totalEarnings)} icon={TrendingUp} tone="success" />
        <StatCard label="Total expenses" value={formatEGP(a.totalExpenses)} icon={TrendingDown} tone="destructive" />
        <StatCard label="Daily target" value={formatEGP(settings.dailyTarget)} icon={Target} />
        <StatCard label="Expected so far" value={formatEGP(a.expectedAmount)} icon={CalendarCheck} />
        <StatCard
          label="Runway"
          value={`${a.daysOfRunway.toFixed(1)} days`}
          hint="At current daily target"
          icon={Coins}
        />
        <StatCard
          label="Projected total"
          value={formatEGP(a.projectedFinalNet)}
          hint={`At ${a.paceVsTargetPct.toFixed(0)}% of target pace`}
          icon={Rocket}
          tone={a.projectedFinalNet >= a.goalTotal ? "success" : "destructive"}
        />
        <StatCard
          label="Avg daily net"
          value={formatEGP(a.avgDailyNet)}
          hint={`Over ${a.loggedDays} logged days`}
          icon={TrendingUp}
          tone="primary"
        />
        <StatCard
          label="Required/day"
          value={a.daysRemaining > 0 ? formatEGP(a.requiredDailyToRecover) : "—"}
          hint={a.daysRemaining > 0 ? "To hit the goal" : "Challenge ended"}
          icon={Clock}
        />
      </section>


      <section className="grid gap-4 lg:grid-cols-3">
        <div className="glass-card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Expected vs Actual</h2>
            <span className="text-xs text-muted-foreground">Cumulative net</span>
          </div>
          <ExpectedVsActual entries={entries} settings={settings} categories={categories} />
        </div>

        <div className="glass-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Daily earnings</h2>
            <span className="text-xs text-muted-foreground">Last days</span>
          </div>
          <EarningsLine entries={entries} categories={categories} />
        </div>
      </section>

      {/* Motivational insights */}
      {a.motivationalTips.length > 0 && (
        <section className="glass-card p-5" dir="rtl">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">نصائح ذكية ليك</h2>
            {a.restDaysAvailable > 0 && (
              <span className="rounded-full bg-[color:var(--success)]/15 px-3 py-1 text-xs font-medium text-[color:var(--success)]">
                {a.restDaysAvailable} يوم راحة متاح
              </span>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {a.motivationalTips.map((t, i) => {
              const toneClass =
                t.kind === "success"
                  ? "border-[color:var(--success)]/40 bg-[color:var(--success)]/8"
                  : t.kind === "warning"
                    ? "border-[color:var(--warning)]/40 bg-[color:var(--warning)]/8"
                    : t.kind === "danger"
                      ? "border-destructive/40 bg-destructive/8"
                      : "border-primary/30 bg-primary/8";
              const titleClass =
                t.kind === "success"
                  ? "text-[color:var(--success)]"
                  : t.kind === "warning"
                    ? "text-[color:var(--warning)]"
                    : t.kind === "danger"
                      ? "text-destructive"
                      : "text-primary";
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm leading-relaxed",
                    toneClass,
                  )}
                >
                  <span className="text-xl leading-none">{t.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className={cn("text-sm font-semibold", titleClass)}>
                      {t.title}
                    </div>
                    {t.body && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {t.body}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Weekly review */}
      <WeeklyReview entries={entries} settings={settings} categories={categories} />

      {/* Gamification: level, achievements, weekday, heatmap */}
      <GamificationPanel entries={entries} settings={settings} categories={categories} />

      {/* Category budgets (non-deductible & budgeted) */}
      {a.categoryStats.some((s) => s.budget !== undefined || !s.deductsFromTarget) && (
        <section className="glass-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Category goals</h2>
            <span className="text-xs text-muted-foreground">
              Caps &amp; savings tracked separately
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {a.categoryStats
              .filter((s) => s.budget !== undefined || !s.deductsFromTarget)
              .map((s) => {
                const isCap = !s.deductsFromTarget && s.budget !== undefined;
                const isSavings = !s.deductsFromTarget && s.budget === undefined;
                const over =
                  isCap && s.budget !== undefined
                    ? Math.max(s.balance - s.budget, 0)
                    : 0;
                return (
                  <div
                    key={s.name}
                    className="rounded-xl border border-border/60 bg-muted/20 p-4"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium">{s.name}</span>
                      {isCap ? (
                        <span className="rounded-full bg-[color:var(--warning)]/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-[color:var(--warning)]">
                          cap
                        </span>
                      ) : isSavings ? (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                          savings
                        </span>
                      ) : null}
                    </div>
                    {isCap && s.budget !== undefined ? (
                      <>
                        <div
                          className={
                            "stat-number text-xl " +
                            (over > 0 ? "text-destructive" : "")
                          }
                        >
                          {(s.pct ?? 0).toFixed(0)}%
                        </div>
                        <div className="mb-2 text-xs text-muted-foreground">
                          {formatEGP(Math.max(s.balance, 0))} of {formatEGP(s.budget)}
                          {over > 0
                            ? ` · ${formatEGP(over)} over cap`
                            : ` · ${formatEGP(s.remaining ?? 0)} left before it hits the target`}
                        </div>
                        <Progress value={Math.min(100, s.pct ?? 0)} className="h-1.5" />
                      </>
                    ) : s.budget !== undefined ? (
                      // Deductible category with a budget — kept as a soft
                      // spending goal (informational only).
                      <>
                        <div className="stat-number text-xl">
                          {(s.pct ?? 0).toFixed(0)}%
                        </div>
                        <div className="mb-2 text-xs text-muted-foreground">
                          {formatEGP(s.balance)} of {formatEGP(s.budget)} ·{" "}
                          {formatEGP(s.remaining ?? 0)} left
                        </div>
                        <Progress value={s.pct ?? 0} className="h-1.5" />
                      </>
                    ) : (
                      // Pure savings jar (no cap)
                      <>
                        <div className="stat-number text-xl">{formatEGP(s.balance)}</div>
                        <div className="text-xs text-muted-foreground">
                          + {formatEGP(s.contributed)} · − {formatEGP(s.withdrawn)}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
          </div>
        </section>
      )}


      {/* Last 7 days */}
      <section className="glass-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Last 7 logged days</h2>
          <span className="text-xs text-muted-foreground">Tap to edit</span>
        </div>
        {last7.length === 0 ? (
          <div className="grid place-items-center rounded-xl border border-dashed border-border/60 py-10 text-sm text-muted-foreground">
            No entries yet — add your first day to see it here.
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {last7.map((e) => {
              const net = entryNet(e, catMap);
              const targetNet = entryTargetNetUsing(e, deductionsMap);
              const exp = entryTotalExpenses(e);
              const hit = targetNet >= settings.dailyTarget;
              const isToday = e.date === todayISO();
              return (
                <li key={e.id}>
                  <button
                    onClick={() => {
                      setEditing(e);
                      setEntryOpen(true);
                    }}
                    className="flex w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full",
                          hit ? "bg-[color:var(--success)]" : "bg-destructive",
                        )}
                      />
                      <div>
                        <div className="text-sm font-medium">
                          {e.date}
                          {isToday && (
                            <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                              Today
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatEGP(e.earnings)} earned · {formatEGP(exp)} spent
                        </div>
                      </div>
                    </div>
                    <div className={cn("stat-number text-sm md:text-base", hit ? "text-[color:var(--success)]" : "text-destructive")}>
                      {net >= 0 ? "+" : ""}
                      {formatEGP(net)}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Mobile FAB */}
      <button
        onClick={openAddToday}
        aria-label="Add today"
        className="fixed bottom-20 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_40px_-8px_oklch(0.78_0.18_152_/_0.6)] transition-transform hover:scale-105 active:scale-95 md:hidden"
      >
        <Plus className="h-6 w-6" />
      </button>

      <DailyEntryDialog
        open={entryOpen}
        onOpenChange={setEntryOpen}
        initial={editing}
        categories={categories}
        entries={entries}
        onAddCategory={addCategory}
        onSave={(e) => {
          const ok = upsertEntry(e);
          if (ok) toast.success("Day saved");
          return ok;
        }}
      />
    </div>
  );
}

