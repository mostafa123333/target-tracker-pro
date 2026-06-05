import { useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { computeGamification } from "@/lib/tracker/gamification";
import { formatEGP } from "@/lib/tracker/analytics";
import type { Category, DailyEntry, TrackerSettings } from "@/lib/tracker/types";
import { Award, Crown, Sparkles, TrendingUp, TrendingDown } from "lucide-react";

type Props = {
  entries: DailyEntry[];
  settings: TrackerSettings;
  categories: Category[];
};

export function GamificationPanel({ entries, settings, categories }: Props) {
  const g = useMemo(
    () => computeGamification(entries, settings, categories),
    [entries, settings, categories],
  );

  const sortedAch = useMemo(
    () =>
      [...g.achievements].sort((a, b) => {
        if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
        const ap = a.target ? a.progress / a.target : 0;
        const bp = b.target ? b.progress / b.target : 0;
        return bp - ap;
      }),
    [g.achievements],
  );

  const wkMax = Math.max(1, ...g.weekdayStats.map((w) => w.avgEarnings));
  const heatmapWeeks: typeof g.heatmap[] = [];
  for (let i = 0; i < g.heatmap.length; i += 7) {
    heatmapWeeks.push(g.heatmap.slice(i, i + 7));
  }

  const intensityClasses = [
    "bg-muted/30",
    "bg-primary/20",
    "bg-primary/40",
    "bg-primary/70",
    "bg-primary",
  ];

  return (
    <div className="space-y-4" dir="rtl">
      {/* Level + Daily challenge */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="glass-card relative overflow-hidden p-5 lg:col-span-2">
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{ background: "var(--gradient-glow)" }}
          />
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                <Crown className="h-3 w-3" /> ليفل {g.level.level}
              </div>
              <h3 className="mt-2 text-2xl font-bold tracking-tight">
                <span className="gradient-text">{g.level.name}</span>
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatEGP(g.level.xpInLevel)} من{" "}
                {formatEGP(g.level.xpCeil - g.level.xpFloor)} للمستوى الجاي
              </p>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                XP
              </div>
              <div className="stat-number text-2xl text-primary">
                {Math.round(g.level.xp).toLocaleString("en-US")}
              </div>
            </div>
          </div>
          <div className="relative mt-4">
            <Progress value={g.level.pct} className="h-2" />
            <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
              <span>{g.level.name}</span>
              <span>فاضل {formatEGP(g.level.xpToNext)}</span>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "glass-card relative overflow-hidden p-5",
            g.challenge.done && "border-[color:var(--success)]/40",
          )}
        >
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            تحدي اليوم
          </div>
          <div className="mt-2 flex items-start gap-2.5">
            <span className="text-2xl leading-none">{g.challenge.icon}</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold">{g.challenge.title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {g.challenge.body}
              </div>
            </div>
          </div>
          <div className="mt-3">
            <Progress
              value={
                g.challenge.target > 0
                  ? Math.min(100, (g.challenge.progress / g.challenge.target) * 100)
                  : 0
              }
              className="h-1.5"
            />
            <div className="mt-1.5 flex justify-between text-[11px]">
              <span className="text-muted-foreground">
                {formatEGP(g.challenge.progress)} / {formatEGP(g.challenge.target)}
              </span>
              {g.challenge.done && (
                <span className="font-semibold text-[color:var(--success)]">
                  تم ✓
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Week compare + Best weekday */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="glass-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold">الأسبوع ده مقابل اللي فات</h3>
            <span className="text-xs text-muted-foreground">
              {g.weekCompare.thisWeekDays} يوم
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <WeekStat
              label="دخل الأسبوع"
              now={g.weekCompare.thisWeekEarnings}
              prev={g.weekCompare.lastWeekEarnings}
              deltaPct={g.weekCompare.earningsDeltaPct}
            />
            <WeekStat
              label="صافي الأسبوع"
              now={g.weekCompare.thisWeekNet}
              prev={g.weekCompare.lastWeekNet}
              deltaPct={g.weekCompare.netDeltaPct}
            />
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold">أداؤك حسب أيام الأسبوع</h3>
            {g.bestWeekday && (
              <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                أفضل يوم: {g.bestWeekday.label}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {g.weekdayStats.map((w) => (
              <div key={w.weekday} className="flex items-center gap-3">
                <div className="w-14 text-xs text-muted-foreground">{w.label}</div>
                <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-muted/40">
                  <div
                    className={cn(
                      "h-full transition-all",
                      w.isBest ? "bg-primary" : "bg-primary/40",
                    )}
                    style={{
                      width:
                        w.avgEarnings > 0
                          ? `${Math.max(4, (w.avgEarnings / wkMax) * 100)}%`
                          : "0%",
                    }}
                  />
                </div>
                <div className="w-24 text-end text-xs tabular-nums text-muted-foreground">
                  {w.count > 0 ? formatEGP(w.avgEarnings) : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Heatmap */}
      <section className="glass-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">آخر 7 أسابيع</h3>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>أقل</span>
            {intensityClasses.map((c, i) => (
              <span key={i} className={cn("h-3 w-3 rounded-sm", c)} />
            ))}
            <span>أكتر</span>
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto" dir="ltr">
          {heatmapWeeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1.5">
              {week.map((cell) => (
                <div
                  key={cell.date}
                  title={`${cell.date}: ${cell.logged ? formatEGP(cell.value) : "لم يُسجّل"}`}
                  className={cn(
                    "h-4 w-4 rounded-sm transition-transform hover:scale-125",
                    intensityClasses[cell.intensity],
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Achievements */}
      <section className="glass-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            <h3 className="text-base font-semibold">الإنجازات</h3>
          </div>
          <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
            {g.unlockedCount} / {g.achievements.length}
          </span>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {sortedAch.map((a) => {
            const pct = a.target > 0 ? Math.min(100, (a.progress / a.target) * 100) : 0;
            return (
              <div
                key={a.id}
                className={cn(
                  "rounded-xl border p-3 transition-colors",
                  a.unlocked
                    ? "border-primary/40 bg-primary/8"
                    : "border-border/60 bg-muted/20",
                )}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-lg text-lg",
                      a.unlocked ? "bg-primary/20" : "bg-muted/60 opacity-60 grayscale",
                    )}
                  >
                    {a.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div
                        className={cn(
                          "truncate text-sm font-semibold",
                          a.unlocked ? "text-primary" : "text-foreground",
                        )}
                      >
                        {a.title}
                      </div>
                      {a.unlocked && (
                        <span className="text-[10px] font-bold text-[color:var(--success)]">
                          ✓
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {a.desc}
                    </div>
                    <div className="mt-2">
                      <div className="h-1 overflow-hidden rounded-full bg-muted/60">
                        <div
                          className={cn(
                            "h-full transition-all",
                            a.unlocked ? "bg-primary" : "bg-primary/40",
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                        {Math.round(a.progress).toLocaleString("en-US")} /{" "}
                        {a.target.toLocaleString("en-US")}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function WeekStat({
  label,
  now,
  prev,
  deltaPct,
}: {
  label: string;
  now: number;
  prev: number;
  deltaPct: number;
}) {
  const up = deltaPct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="stat-number mt-1 text-xl">{formatEGP(now)}</div>
      <div className="mt-1 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">
          الأسبوع اللي فات: {formatEGP(prev)}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 font-semibold",
            up ? "text-[color:var(--success)]" : "text-destructive",
          )}
        >
          <Icon className="h-3 w-3" />
          {Math.abs(deltaPct).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
