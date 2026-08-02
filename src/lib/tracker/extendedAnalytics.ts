import type { Category, DailyEntry, TrackerSettings } from "./types";
import {
  computeEntryTargetDeductions,
  entryNet,
  entryTargetNetUsing,
  entryTotalExpenses,
  makeCategoryMap,
} from "./analytics";

export type TopDay = { date: string; net: number; earnings: number };

export type MonthBucket = {
  key: string; // YYYY-MM
  label: string;
  earnings: number;
  expenses: number;
  net: number;
  days: number;
  avg: number;
};

export type DistributionBin = {
  label: string;
  count: number;
  min: number;
  max: number;
};

export type CumulativePoint = {
  date: string;
  cumNet: number;
  cumEarnings: number;
  expected: number;
};

export type MovingAvgPoint = {
  date: string;
  earnings: number;
  ma7: number | null;
};

export type CategoryTrendRow = {
  name: string;
  total: number;
  share: number; // 0..1 of total deductible spend
  avgPerDay: number;
  daysUsed: number;
};

export type ExtendedAnalytics = {
  medianEarnings: number;
  medianNet: number;
  earningsStdDev: number;
  coefficientOfVariation: number; // stdDev / mean — lower = more consistent
  consistencyScore: number; // 0..100
  hitRate: number; // 0..1 — % of logged days that hit target-net
  zeroDays: number;
  daysAboveAvg: number;
  daysBelowAvg: number;
  momentumPct: number; // last 7 avg vs prior 7 avg
  last7Avg: number;
  prev7Avg: number;
  topBestDays: TopDay[];
  topWorstDays: TopDay[];
  monthly: MonthBucket[];
  distribution: DistributionBin[];
  cumulativeSeries: CumulativePoint[];
  movingAvgSeries: MovingAvgPoint[];
  categoryTrend: CategoryTrendRow[];
  forecastFinalNet: number; // based on last-14 avg net
  forecastConfidence: "low" | "medium" | "high";
};

function parseDate(iso: string): Date {
  return new Date(iso + "T00:00:00");
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function stdDev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = nums.reduce((a, b) => a + b, 0) / nums.length;
  const v = nums.reduce((a, b) => a + (b - m) ** 2, 0) / nums.length;
  return Math.sqrt(v);
}

export function computeExtendedAnalytics(
  entries: DailyEntry[],
  settings: TrackerSettings,
  categories: Category[] = [],
): ExtendedAnalytics {
  const catMap = makeCategoryMap(categories);
  const target = settings.dailyTarget;
  const totalDays = settings.totalDays;
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
  const deductions = computeEntryTargetDeductions(sorted, catMap);

  const earningsArr = sorted.map((e) => Number(e.earnings) || 0);
  const netArr = sorted.map((e) => entryNet(e, catMap));
  const meanEarnings =
    earningsArr.length > 0
      ? earningsArr.reduce((a, b) => a + b, 0) / earningsArr.length
      : 0;

  const medianEarnings = median(earningsArr);
  const medianNet = median(netArr);
  const earningsStdDev = stdDev(earningsArr);
  const cv = meanEarnings > 0 ? earningsStdDev / meanEarnings : 0;
  // Map CV (lower=better) to 0..100. CV of 0 -> 100, CV of 1+ -> 0
  const consistencyScore = Math.max(0, Math.min(100, (1 - cv) * 100));

  let hits = 0,
    zeroDays = 0,
    above = 0,
    below = 0;
  for (const e of sorted) {
    const earn = Number(e.earnings) || 0;
    const tn = entryTargetNetUsing(e, deductions);
    if (target > 0 && tn >= target) hits++;
    if (earn === 0) zeroDays++;
    if (earn > meanEarnings) above++;
    else if (earn < meanEarnings) below++;
  }
  const hitRate = sorted.length ? hits / sorted.length : 0;

  // Momentum: last 7 vs prior 7
  const last7 = sorted.slice(-7);
  const prev7 = sorted.slice(-14, -7);
  const avg = (arr: DailyEntry[]) =>
    arr.length ? arr.reduce((s, e) => s + (Number(e.earnings) || 0), 0) / arr.length : 0;
  const last7Avg = avg(last7);
  const prev7Avg = avg(prev7);
  const momentumPct =
    prev7Avg === 0 ? (last7Avg > 0 ? 100 : 0) : ((last7Avg - prev7Avg) / prev7Avg) * 100;

  // Top best/worst days by net
  const withNet = sorted.map((e) => ({
    date: e.date,
    net: entryNet(e, catMap),
    earnings: Number(e.earnings) || 0,
  }));
  const topBestDays = [...withNet].sort((a, b) => b.net - a.net).slice(0, 5);
  const topWorstDays = [...withNet].sort((a, b) => a.net - b.net).slice(0, 5);

  // Monthly buckets
  const monthMap = new Map<string, MonthBucket>();
  const MONTH_AR = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ];
  for (const e of sorted) {
    const key = e.date.slice(0, 7);
    const d = parseDate(e.date);
    const label = `${MONTH_AR[d.getMonth()]} ${d.getFullYear()}`;
    if (!monthMap.has(key))
      monthMap.set(key, {
        key,
        label,
        earnings: 0,
        expenses: 0,
        net: 0,
        days: 0,
        avg: 0,
      });
    const b = monthMap.get(key)!;
    b.earnings += Number(e.earnings) || 0;
    b.expenses += entryTotalExpenses(e);
    b.net += entryNet(e, catMap);
    b.days++;
  }
  const monthly = [...monthMap.values()]
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .map((m) => ({ ...m, avg: m.days ? m.earnings / m.days : 0 }));

  // Earnings distribution (relative to target)
  const bins: DistributionBin[] = target > 0
    ? [
        { label: "صفر", count: 0, min: 0, max: 0 },
        { label: `أقل من ${Math.round(target * 0.5)}`, count: 0, min: 0.0001, max: target * 0.5 },
        { label: `${Math.round(target * 0.5)}–${Math.round(target)}`, count: 0, min: target * 0.5, max: target },
        { label: `${Math.round(target)}–${Math.round(target * 1.5)}`, count: 0, min: target, max: target * 1.5 },
        { label: `${Math.round(target * 1.5)}–${Math.round(target * 2)}`, count: 0, min: target * 1.5, max: target * 2 },
        { label: `أكثر من ${Math.round(target * 2)}`, count: 0, min: target * 2, max: Infinity },
      ]
    : [];
  for (const v of earningsArr) {
    for (const b of bins) {
      if (b.min === 0 && b.max === 0) {
        if (v === 0) {
          b.count++;
          break;
        }
        continue;
      }
      if (v > b.min && v <= b.max) {
        b.count++;
        break;
      }
    }
  }

  // Cumulative net vs expected (target line) over time
  const cumulativeSeries: CumulativePoint[] = [];
  let cumNet = 0;
  let cumEarn = 0;
  let dayIndex = 0;
  for (const e of sorted) {
    dayIndex++;
    cumNet += entryTargetNetUsing(e, deductions);
    cumEarn += Number(e.earnings) || 0;
    cumulativeSeries.push({
      date: e.date.slice(5),
      cumNet,
      cumEarnings: cumEarn,
      expected: dayIndex * target,
    });
  }

  // 7-day moving average of earnings
  const movingAvgSeries: MovingAvgPoint[] = sorted.map((e, i) => {
    const window = sorted.slice(Math.max(0, i - 6), i + 1);
    const ma =
      window.length === 7
        ? window.reduce((s, x) => s + (Number(x.earnings) || 0), 0) / 7
        : null;
    return {
      date: e.date.slice(5),
      earnings: Number(e.earnings) || 0,
      ma7: ma,
    };
  });

  // Category trend (deductible spend share)
  const catTotals = new Map<string, { total: number; days: Set<string> }>();
  for (const e of sorted) {
    for (const x of e.expenses) {
      const cat = catMap.get(x.category);
      if (cat && cat.deductsFromTarget === false) continue;
      const v = Number(x.amount) || 0;
      if (v <= 0) continue;
      if (!catTotals.has(x.category))
        catTotals.set(x.category, { total: 0, days: new Set() });
      const t = catTotals.get(x.category)!;
      t.total += v;
      t.days.add(e.date);
    }
  }
  const totalSpend = [...catTotals.values()].reduce((s, x) => s + x.total, 0);
  const categoryTrend: CategoryTrendRow[] = [...catTotals.entries()]
    .map(([name, t]) => ({
      name,
      total: t.total,
      share: totalSpend > 0 ? t.total / totalSpend : 0,
      avgPerDay: t.days.size ? t.total / t.days.size : 0,
      daysUsed: t.days.size,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  // Forecast: use last 14 days' avg net to project remaining days
  const recent = sorted.slice(-14);
  const recentAvgNet = recent.length
    ? recent.reduce((s, e) => s + entryTargetNetUsing(e, deductions), 0) / recent.length
    : 0;
  const totalCumNet = sorted.reduce(
    (s, e) => s + entryTargetNetUsing(e, deductions),
    0,
  );
  // Base days-left on the actual challenge calendar (start date → today),
  // not on how many days the user has logged. Missed days must count against
  // the forecast, otherwise the projection stays flat no matter what.
  const startMs = settings.startDate ? parseDate(settings.startDate).getTime() : NaN;
  const todayMs = parseDate(todayISO()).getTime();
  const daysElapsed = Number.isFinite(startMs)
    ? Math.min(totalDays, Math.max(0, Math.floor((todayMs - startMs) / 86400000) + 1))
    : sorted.length;
  const daysLeftInChallenge = Math.max(0, totalDays - daysElapsed);
  const forecastFinalNet = totalCumNet + recentAvgNet * daysLeftInChallenge;
  const forecastConfidence: "low" | "medium" | "high" =
    sorted.length >= 14 ? "high" : sorted.length >= 7 ? "medium" : "low";

  return {
    medianEarnings,
    medianNet,
    earningsStdDev,
    coefficientOfVariation: cv,
    consistencyScore,
    hitRate,
    zeroDays,
    daysAboveAvg: above,
    daysBelowAvg: below,
    momentumPct,
    last7Avg,
    prev7Avg,
    topBestDays,
    topWorstDays,
    monthly,
    distribution: bins,
    cumulativeSeries,
    movingAvgSeries,
    categoryTrend,
    forecastFinalNet,
    forecastConfidence,
  };
}
