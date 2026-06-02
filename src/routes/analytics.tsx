import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTracker } from "@/hooks/useTracker";
import { OnboardingDialog } from "@/components/tracker/OnboardingDialog";
import { StatCard } from "@/components/tracker/StatCard";
import { CategoryPie, ExpensesBar } from "@/components/tracker/Charts";
import { computeAnalytics, entryNet, entryTotalExpenses, formatEGP, makeCategoryMap } from "@/lib/tracker/analytics";
import { Trophy, Frown, Flame, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — 105 Day Target Tracker" },
      { name: "description", content: "Insights from your daily data." },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { hydrated, settings, entries, categories, updateSettings } = useTracker();

  const computed = useMemo(() => {
    if (!entries.length) return null;
    const catMap = makeCategoryMap(categories);
    let best = entries[0];
    let worst = entries[0];
    let mostExp = entries[0];
    for (const e of entries) {
      if (e.earnings > best.earnings) best = e;
      if (e.earnings < worst.earnings) worst = e;
      if (entryTotalExpenses(e) > entryTotalExpenses(mostExp)) mostExp = e;
    }
    const byCat = new Map<string, number>();
    for (const e of entries)
      for (const x of e.expenses) {
        const c = catMap.get(x.category);
        // Only count deductible categories as "spend"; skip savings deposits.
        if (c && c.deductsFromTarget === false) continue;
        byCat.set(x.category, (byCat.get(x.category) ?? 0) + (Number(x.amount) || 0));
      }
    const topCat = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];
    const nets = entries.map((e) => entryNet(e, catMap));
    const positiveDays = nets.filter((n) => n > 0).length;
    const negativeDays = nets.filter((n) => n < 0).length;
    const bestNet = nets.length ? Math.max(...nets) : 0;
    return { best, worst, mostExp, topCat, positiveDays, negativeDays, bestNet };
  }, [entries, categories]);

  if (!hydrated) return <div className="h-40 animate-pulse rounded-2xl bg-muted/40" />;
  if (!settings) return <OnboardingDialog open onComplete={updateSettings} />;

  const a = computeAnalytics(entries, settings, categories);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Analytics</h1>
        <p className="text-sm text-muted-foreground">Patterns from your tracked days.</p>
      </div>

      {!computed ? (
        <div className="glass-card grid place-items-center p-10 text-center">
          <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Log at least one day to unlock analytics.
          </p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              label="Best day"
              value={formatEGP(computed.best.earnings)}
              hint={computed.best.date}
              icon={Trophy}
              tone="success"
            />
            <StatCard
              label="Worst day"
              value={formatEGP(computed.worst.earnings)}
              hint={computed.worst.date}
              icon={Frown}
              tone="destructive"
            />
            <StatCard
              label="Highest expense day"
              value={formatEGP(entryTotalExpenses(computed.mostExp))}
              hint={computed.mostExp.date}
              icon={TrendingDown}
            />
            <StatCard
              label="Top spend category"
              value={computed.topCat ? computed.topCat[0] : "—"}
              hint={computed.topCat ? formatEGP(computed.topCat[1]) : ""}
              icon={Flame}
              tone="warning"
            />

            <StatCard label="Avg earnings" value={formatEGP(a.avgDailyEarnings)} icon={TrendingUp} />
            <StatCard label="Avg expenses" value={formatEGP(a.avgDailyExpenses)} icon={TrendingDown} />
            <StatCard
              label="Highest net day"
              value={formatEGP(computed.bestNet)}
              tone="primary"
            />
            <StatCard
              label="Positive / negative days"
              value={`${computed.positiveDays} / ${computed.negativeDays}`}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="glass-card p-5">
              <h2 className="mb-3 text-base font-semibold">Daily expenses</h2>
              <ExpensesBar entries={entries} />
            </div>
            <div className="glass-card p-5">
              <h2 className="mb-3 text-base font-semibold">Spend by category</h2>
              <CategoryPie entries={entries} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
