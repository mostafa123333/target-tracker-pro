import { useMemo } from "react";
import { TrendingDown, TrendingUp, Target as TargetIcon, CalendarRange } from "lucide-react";
import type { Category, DailyEntry, TrackerSettings } from "@/lib/tracker/types";
import { computeWeeklyReview } from "@/lib/tracker/weekly";
import { formatEGP } from "@/lib/tracker/analytics";
import { cn } from "@/lib/utils";

type Props = {
  entries: DailyEntry[];
  settings: TrackerSettings;
  categories: Category[];
};

export function WeeklyReview({ entries, settings, categories }: Props) {
  const wr = useMemo(
    () => computeWeeklyReview(entries, settings, categories),
    [entries, settings, categories],
  );
  const { thisWeek, lastWeek, earningsDeltaPct, netDeltaPct, hitDaysDelta } = wr;
  if (thisWeek.days === 0 && lastWeek.days === 0) return null;

  const earningsUp = earningsDeltaPct >= 0;
  const netUp = netDeltaPct >= 0;

  return (
    <section className="glass-card p-5" dir="rtl">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">مراجعة الأسبوع</h2>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {thisWeek.start} → {thisWeek.end}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="مكسب الأسبوع"
          value={formatEGP(thisWeek.earnings)}
          delta={`${earningsUp ? "▲" : "▼"} ${Math.abs(earningsDeltaPct).toFixed(0)}%`}
          deltaTone={earningsUp ? "success" : "destructive"}
          hint={`الأسبوع اللي فات: ${formatEGP(lastWeek.earnings)}`}
        />
        <Tile
          label="صافي الأسبوع"
          value={formatEGP(thisWeek.net)}
          delta={`${netUp ? "▲" : "▼"} ${Math.abs(netDeltaPct).toFixed(0)}%`}
          deltaTone={netUp ? "success" : "destructive"}
          hint={`الأسبوع اللي فات: ${formatEGP(lastWeek.net)}`}
        />
        <Tile
          label="أيام فوق التارجت"
          value={`${thisWeek.hitDays} / ${thisWeek.days || 0}`}
          delta={
            hitDaysDelta === 0
              ? "= نفس الأسبوع"
              : `${hitDaysDelta > 0 ? "+" : ""}${hitDaysDelta} مقارنة بالفائت`
          }
          deltaTone={hitDaysDelta >= 0 ? "success" : "destructive"}
          icon={TargetIcon}
        />
        <Tile
          label="أحسن يوم"
          value={thisWeek.bestDay ? formatEGP(thisWeek.bestDay.net) : "—"}
          delta={thisWeek.bestDay?.date ?? "لسه مفيش بيانات"}
          deltaTone="default"
          icon={TrendingUp}
        />
      </div>
    </section>
  );
}

function Tile({
  label,
  value,
  delta,
  deltaTone,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  delta: string;
  deltaTone: "success" | "destructive" | "default";
  hint?: string;
  icon?: typeof TrendingUp;
}) {
  const toneClass =
    deltaTone === "success"
      ? "text-[color:var(--success)]"
      : deltaTone === "destructive"
        ? "text-destructive"
        : "text-muted-foreground";
  const DeltaIcon = deltaTone === "success" ? TrendingUp : deltaTone === "destructive" ? TrendingDown : null;
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        {Icon && <Icon className="h-3.5 w-3.5" />}
      </div>
      <div className="stat-number text-xl text-foreground">{value}</div>
      <div className={cn("mt-1 flex items-center gap-1 text-xs font-medium", toneClass)}>
        {DeltaIcon && <DeltaIcon className="h-3 w-3" />}
        <span>{delta}</span>
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
