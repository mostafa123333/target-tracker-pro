import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { computeExtendedAnalytics } from "@/lib/tracker/extendedAnalytics";
import { formatEGP } from "@/lib/tracker/analytics";
import type { Category, DailyEntry, TrackerSettings } from "@/lib/tracker/types";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Activity,
  Calendar,
  Trophy,
  AlertTriangle,
  Rocket,
} from "lucide-react";

type Props = {
  entries: DailyEntry[];
  settings: TrackerSettings;
  categories: Category[];
};

const tooltip = {
  contentStyle: {
    background: "oklch(0.2 0.008 240)",
    border: "1px solid oklch(1 0 0 / 0.1)",
    borderRadius: 12,
    fontSize: 12,
    color: "white",
  },
  labelStyle: { color: "oklch(0.7 0.012 240)" },
  cursor: { fill: "oklch(1 0 0 / 0.04)" },
} as const;

export function AdvancedAnalytics({ entries, settings, categories }: Props) {
  const x = useMemo(
    () => computeExtendedAnalytics(entries, settings, categories),
    [entries, settings, categories],
  );

  if (!entries.length) return null;

  const momentumUp = x.momentumPct >= 0;
  const MomentumIcon = momentumUp ? TrendingUp : TrendingDown;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Score row */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ScoreCard
          icon={Target}
          label="نسبة تحقيق الهدف"
          value={`${(x.hitRate * 100).toFixed(0)}%`}
          hint={`من إجمالي ${entries.length} يوم`}
          tone={x.hitRate >= 0.6 ? "success" : x.hitRate >= 0.3 ? "warning" : "destructive"}
          progress={x.hitRate * 100}
        />
        <ScoreCard
          icon={Activity}
          label="درجة الثبات"
          value={`${x.consistencyScore.toFixed(0)}`}
          hint={
            x.consistencyScore >= 70
              ? "أداء ثابت جدًا"
              : x.consistencyScore >= 40
                ? "تذبذب متوسط"
                : "تذبذب عالي"
          }
          tone={
            x.consistencyScore >= 70
              ? "success"
              : x.consistencyScore >= 40
                ? "warning"
                : "destructive"
          }
          progress={x.consistencyScore}
        />
        <ScoreCard
          icon={MomentumIcon}
          label="زخم آخر ٧ أيام"
          value={`${momentumUp ? "+" : ""}${x.momentumPct.toFixed(0)}%`}
          hint={`${formatEGP(x.last7Avg)} مقابل ${formatEGP(x.prev7Avg)}`}
          tone={momentumUp ? "success" : "destructive"}
        />
        <ScoreCard
          icon={Rocket}
          label="توقع النهاية"
          value={formatEGP(x.forecastFinalNet)}
          hint={`دقة: ${
            x.forecastConfidence === "high"
              ? "عالية"
              : x.forecastConfidence === "medium"
                ? "متوسطة"
                : "منخفضة"
          }`}
          tone={x.forecastFinalNet >= settings.totalDays * settings.dailyTarget ? "success" : "warning"}
        />
      </section>

      {/* Quick stats row */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="وسيط الدخل" value={formatEGP(x.medianEarnings)} />
        <MiniStat label="وسيط الصافي" value={formatEGP(x.medianNet)} />
        <MiniStat label="انحراف الدخل" value={formatEGP(x.earningsStdDev)} hint="كل ما قل = أحسن" />
        <MiniStat
          label="أيام فوق المتوسط"
          value={`${x.daysAboveAvg} / ${x.daysAboveAvg + x.daysBelowAvg + x.zeroDays}`}
          hint={x.zeroDays > 0 ? `${x.zeroDays} يوم صفر` : undefined}
        />
      </section>

      {/* Cumulative chart */}
      <section className="glass-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">المسار التراكمي مقابل المتوقع</h3>
          <span className="text-xs text-muted-foreground">يومًا بيوم</span>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <AreaChart data={x.cumulativeSeries} dir="ltr">
              <defs>
                <linearGradient id="cumNetFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.78 0.18 152)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="oklch(0.78 0.18 152)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="oklch(1 0 0 / 0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.7 0.012 240)" }} />
              <YAxis tick={{ fontSize: 11, fill: "oklch(0.7 0.012 240)" }} />
              <Tooltip {...tooltip} />
              <Area
                type="monotone"
                dataKey="cumNet"
                name="صافي الهدف التراكمي"
                stroke="oklch(0.78 0.18 152)"
                fill="url(#cumNetFill)"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="expected"
                name="المتوقع"
                stroke="oklch(0.7 0.14 200)"
                strokeDasharray="4 4"
                dot={false}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Moving avg + distribution */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="glass-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold">الدخل ومتوسط ٧ أيام</h3>
          </div>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={x.movingAvgSeries} dir="ltr">
                <CartesianGrid stroke="oklch(1 0 0 / 0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.7 0.012 240)" }} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.7 0.012 240)" }} />
                <Tooltip {...tooltip} />
                <Line
                  type="monotone"
                  dataKey="earnings"
                  name="الدخل"
                  stroke="oklch(0.7 0.14 200)"
                  dot={false}
                  strokeWidth={1.5}
                />
                <Line
                  type="monotone"
                  dataKey="ma7"
                  name="متوسط ٧ أيام"
                  stroke="oklch(0.78 0.18 152)"
                  dot={false}
                  strokeWidth={2.5}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold">توزيع الأيام حسب الدخل</h3>
            <span className="text-xs text-muted-foreground">نسبةً للهدف</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={x.distribution} dir="ltr">
                <CartesianGrid stroke="oklch(1 0 0 / 0.05)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "oklch(0.7 0.012 240)" }} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.7 0.012 240)" }} allowDecimals={false} />
                <Tooltip {...tooltip} />
                <Bar dataKey="count" name="عدد الأيام" fill="oklch(0.78 0.18 152)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Monthly breakdown */}
      {x.monthly.length > 0 && (
        <section className="glass-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold">تفصيل شهري</h3>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={x.monthly} dir="ltr">
                <CartesianGrid stroke="oklch(1 0 0 / 0.05)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "oklch(0.7 0.012 240)" }} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.7 0.012 240)" }} />
                <Tooltip {...tooltip} />
                <Bar dataKey="earnings" name="الدخل" fill="oklch(0.7 0.14 200)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="net" name="الصافي" fill="oklch(0.78 0.18 152)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 overflow-x-auto" dir="rtl">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-1.5 text-start font-medium">الشهر</th>
                  <th className="py-1.5 text-end font-medium">أيام</th>
                  <th className="py-1.5 text-end font-medium">متوسط/يوم</th>
                  <th className="py-1.5 text-end font-medium">دخل</th>
                  <th className="py-1.5 text-end font-medium">مصروف</th>
                  <th className="py-1.5 text-end font-medium">صافي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {x.monthly.map((m) => (
                  <tr key={m.key}>
                    <td className="py-2">{m.label}</td>
                    <td className="py-2 text-end tabular-nums">{m.days}</td>
                    <td className="py-2 text-end tabular-nums">{formatEGP(m.avg)}</td>
                    <td className="py-2 text-end tabular-nums">{formatEGP(m.earnings)}</td>
                    <td className="py-2 text-end tabular-nums text-destructive">
                      {formatEGP(m.expenses)}
                    </td>
                    <td
                      className={cn(
                        "py-2 text-end tabular-nums font-semibold",
                        m.net >= 0 ? "text-[color:var(--success)]" : "text-destructive",
                      )}
                    >
                      {formatEGP(m.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Top best/worst */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="glass-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-[color:var(--success)]" />
            <h3 className="text-base font-semibold">أفضل ٥ أيام</h3>
          </div>
          <ul className="divide-y divide-border/60">
            {x.topBestDays.map((d, i) => (
              <li
                key={d.date}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[color:var(--success)]/15 text-xs font-bold text-[color:var(--success)]">
                    {i + 1}
                  </span>
                  <div>
                    <div className="font-medium">{d.date}</div>
                    <div className="text-xs text-muted-foreground">
                      دخل {formatEGP(d.earnings)}
                    </div>
                  </div>
                </div>
                <div className="stat-number text-[color:var(--success)]">
                  +{formatEGP(d.net)}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h3 className="text-base font-semibold">أسوأ ٥ أيام</h3>
          </div>
          <ul className="divide-y divide-border/60">
            {x.topWorstDays.map((d, i) => (
              <li
                key={d.date}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-destructive/15 text-xs font-bold text-destructive">
                    {i + 1}
                  </span>
                  <div>
                    <div className="font-medium">{d.date}</div>
                    <div className="text-xs text-muted-foreground">
                      دخل {formatEGP(d.earnings)}
                    </div>
                  </div>
                </div>
                <div
                  className={cn(
                    "stat-number",
                    d.net >= 0 ? "text-foreground" : "text-destructive",
                  )}
                >
                  {d.net >= 0 ? "+" : ""}
                  {formatEGP(d.net)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Category trend */}
      {x.categoryTrend.length > 0 && (
        <section className="glass-card p-5">
          <h3 className="mb-3 text-base font-semibold">تحليل بنود الصرف</h3>
          <div className="space-y-3">
            {x.categoryTrend.map((c) => (
              <div key={c.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{c.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatEGP(c.total)} ·{" "}
                    <span className="text-foreground">
                      {(c.share * 100).toFixed(0)}%
                    </span>
                  </span>
                </div>
                <Progress value={c.share * 100} className="h-1.5" />
                <div className="mt-1 text-[11px] text-muted-foreground">
                  متوسط {formatEGP(c.avgPerDay)} على مدار {c.daysUsed} يوم
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ScoreCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  progress,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  hint?: string;
  tone: "success" | "warning" | "destructive";
  progress?: number;
}) {
  const toneColor =
    tone === "success"
      ? "text-[color:var(--success)]"
      : tone === "warning"
        ? "text-[color:var(--warning)]"
        : "text-destructive";
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className={cn("h-4 w-4", toneColor)} />
      </div>
      <div className={cn("stat-number mt-2 text-2xl", toneColor)}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
      {progress !== undefined && (
        <div className="mt-2">
          <Progress value={progress} className="h-1" />
        </div>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="stat-number mt-1 text-lg">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
