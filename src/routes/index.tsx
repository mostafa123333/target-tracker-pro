import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useTracker } from "@/hooks/useTracker";
import { OnboardingDialog } from "@/components/tracker/OnboardingDialog";
import { DailyEntryDialog } from "@/components/tracker/DailyEntryDialog";
import { StatCard } from "@/components/tracker/StatCard";
import { EarningsLine, ExpectedVsActual } from "@/components/tracker/Charts";
import { computeAnalytics, formatEGP } from "@/lib/tracker/analytics";
import type { DailyEntry } from "@/lib/tracker/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — 90 Day Target Tracker" },
      {
        name: "description",
        content: "Your live progress toward 220 EGP/day for 90 days.",
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

  const analytics = useMemo(
    () => (settings ? computeAnalytics(entries, settings) : null),
    [entries, settings],
  );

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
  const aheadTone = a.difference >= 0 ? "success" : "destructive";

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="glass-card relative overflow-hidden p-6 md:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: "var(--gradient-glow)" }} />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Day {Math.min(a.daysElapsed, settings.totalDays)} of {settings.totalDays}
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              {a.isCompleted ? (
                <span className="gradient-text">Challenge Completed</span>
              ) : a.difference >= 0 ? (
                <>You're <span className="gradient-text">ahead</span> by {formatEGP(a.difference)}</>
              ) : (
                <>You're behind by <span className="text-destructive">{formatEGP(Math.abs(a.difference))}</span></>
              )}
            </h1>
            <p className="max-w-md text-sm text-muted-foreground">
              {a.difference >= 0
                ? `That's about ${a.aheadDays.toFixed(1)} days ahead of schedule. Keep the momentum.`
                : `That's about ${a.behindDays.toFixed(1)} days behind. You need ${formatEGP(a.requiredDailyToRecover)} per day for ${a.daysRemaining} days to recover.`}
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            <Button
              size="lg"
              className="glow-primary"
              onClick={() => {
                setEditing(a.todaysEntry ?? null);
                setEntryOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {a.todaysEntry ? "Edit today" : "Add today"}
            </Button>
            {a.missingToday && (
              <div className="inline-flex items-center gap-1.5 text-xs text-[color:var(--warning)]">
                <AlertCircle className="h-3.5 w-3.5" />
                Today not logged yet
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

      {/* Stat grid */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Net profit" value={formatEGP(a.netProfit)} icon={Wallet} tone="primary" />
        <StatCard label="Total earnings" value={formatEGP(a.totalEarnings)} icon={TrendingUp} tone="success" />
        <StatCard label="Total expenses" value={formatEGP(a.totalExpenses)} icon={TrendingDown} tone="destructive" />
        <StatCard label="Daily target" value={formatEGP(settings.dailyTarget)} icon={Target} />

        <StatCard label="Expected so far" value={formatEGP(a.expectedAmount)} icon={CalendarCheck} />
        <StatCard
          label={a.difference >= 0 ? "Ahead by" : "Behind by"}
          value={formatEGP(Math.abs(a.difference))}
          hint={a.difference >= 0 ? `≈ ${a.aheadDays.toFixed(1)} days` : `≈ ${a.behindDays.toFixed(1)} days`}
          icon={a.difference >= 0 ? TrendingUp : TrendingDown}
          tone={aheadTone}
        />
        <StatCard
          label="Days remaining"
          value={`${a.daysRemaining}`}
          hint={`Ends ${a.endDate}`}
          icon={CalendarDays}
        />
        <StatCard
          label="Runway"
          value={`${a.daysOfRunway.toFixed(1)} days`}
          hint="At current daily target"
          icon={Coins}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="glass-card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Expected vs Actual</h2>
            <span className="text-xs text-muted-foreground">Cumulative net</span>
          </div>
          <ExpectedVsActual entries={entries} settings={settings} />
        </div>

        <div className="glass-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Daily earnings</h2>
            <span className="text-xs text-muted-foreground">Last days</span>
          </div>
          <EarningsLine entries={entries} />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Avg daily earnings" value={formatEGP(a.avgDailyEarnings)} />
        <StatCard label="Avg daily expenses" value={formatEGP(a.avgDailyExpenses)} />
        <StatCard label="Avg daily net" value={formatEGP(a.avgDailyNet)} tone="primary" />
      </section>

      <DailyEntryDialog
        open={entryOpen}
        onOpenChange={setEntryOpen}
        initial={editing}
        categories={categories}
        onAddCategory={addCategory}
        onSave={(e) => {
          upsertEntry(e);
          toast.success("Day saved");
        }}
      />
    </div>
  );
}
