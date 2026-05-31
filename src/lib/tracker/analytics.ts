import type { Category, DailyEntry, TrackerSettings } from "./types";

export function makeCategoryMap(categories: Category[] = []): Map<string, Category> {
  const m = new Map<string, Category>();
  for (const c of categories) m.set(c.name, c);
  return m;
}

/** True if a given expense category counts against the target. Unknown
 *  categories default to deductible (legacy behaviour). */
function isDeductible(catName: string, map?: Map<string, Category>): boolean {
  if (!map) return true;
  const c = map.get(catName);
  if (!c) return true;
  return c.deductsFromTarget !== false;
}

export function entryTotalExpenses(e: DailyEntry): number {
  return e.expenses.reduce((s, x) => s + (Number(x.amount) || 0), 0);
}

/** Expenses that reduce the daily target (deductible categories only). */
export function entryDeductibleExpenses(
  e: DailyEntry,
  map?: Map<string, Category>,
): number {
  return e.expenses.reduce(
    (s, x) => s + (isDeductible(x.category, map) ? Number(x.amount) || 0 : 0),
    0,
  );
}

export function entryNonDeductibleExpenses(
  e: DailyEntry,
  map?: Map<string, Category>,
): number {
  return e.expenses.reduce(
    (s, x) => s + (!isDeductible(x.category, map) ? Number(x.amount) || 0 : 0),
    0,
  );
}

/** Net amount counted toward the target. By default all expenses are deductible. */
export function entryNet(e: DailyEntry, map?: Map<string, Category>): number {
  return (Number(e.earnings) || 0) - entryDeductibleExpenses(e, map);
}

export function todayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(startISO: string, endISO: string): number {
  const a = new Date(startISO + "T00:00:00");
  const b = new Date(endISO + "T00:00:00");
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

export type CategoryStat = {
  name: string;
  deductsFromTarget: boolean;
  budget?: number;
  spent: number;
  remaining?: number;
  pct?: number;
};

export type Analytics = {
  currentDay: number;
  daysElapsed: number;
  daysRemaining: number;
  endDate: string;
  isCompleted: boolean;
  notStarted: boolean;
  daysUntilStart: number;

  totalEarnings: number;
  totalExpenses: number; // ALL expenses
  deductibleExpenses: number;
  nonDeductibleExpenses: number;
  netProfit: number; // earnings - deductibleExpenses (target-affecting)

  expectedAmount: number;
  difference: number;
  aheadDays: number;
  behindDays: number;

  goalTotal: number;
  remainingToGoal: number;
  progressPct: number;

  avgDailyEarnings: number;
  avgDailyExpenses: number;
  avgDailyNet: number;

  daysOfRunway: number;
  requiredDailyToRecover: number;
  projectedFinalNet: number;
  paceVsTargetPct: number;

  currentStreak: number;
  bestStreak: number;
  loggedDays: number;

  todaysEntry?: DailyEntry;
  missingToday: boolean;

  categoryStats: CategoryStat[];
};

function computeStreaks(entries: DailyEntry[]): { current: number; best: number } {
  if (entries.length === 0) return { current: 0, best: 0 };
  const dates = new Set(entries.map((e) => e.date));
  const sorted = [...dates].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }
  const today = todayISO();
  let cursor = today;
  if (!dates.has(cursor)) {
    const y = new Date(today + "T00:00:00");
    y.setDate(y.getDate() - 1);
    cursor = y.toISOString().slice(0, 10);
    if (!dates.has(cursor)) return { current: 0, best };
  }
  let current = 0;
  while (dates.has(cursor)) {
    current++;
    const d = new Date(cursor + "T00:00:00");
    d.setDate(d.getDate() - 1);
    cursor = d.toISOString().slice(0, 10);
  }
  return { current, best };
}

export function computeAnalytics(
  entries: DailyEntry[],
  settings: TrackerSettings,
  categories: Category[] = [],
): Analytics {
  const catMap = makeCategoryMap(categories);
  const totalDays = settings.totalDays;
  const target = settings.dailyTarget;
  const today = todayISO();

  const elapsedRaw = daysBetween(settings.startDate, today) + 1;
  const notStarted = elapsedRaw <= 0;
  const daysUntilStart = notStarted ? Math.abs(elapsedRaw) + 1 : 0;
  const daysElapsed = Math.max(0, elapsedRaw);
  const currentDay = Math.min(Math.max(daysElapsed, 1), totalDays);
  const daysRemaining = Math.max(totalDays - daysElapsed, 0);

  const endDateObj = new Date(settings.startDate + "T00:00:00");
  endDateObj.setDate(endDateObj.getDate() + totalDays - 1);
  const endDate = endDateObj.toISOString().slice(0, 10);
  const isCompleted = daysElapsed >= totalDays;

  const totalEarnings = entries.reduce((s, e) => s + (Number(e.earnings) || 0), 0);
  const totalExpenses = entries.reduce((s, e) => s + entryTotalExpenses(e), 0);
  const deductibleExpenses = entries.reduce(
    (s, e) => s + entryDeductibleExpenses(e, catMap),
    0,
  );
  const nonDeductibleExpenses = totalExpenses - deductibleExpenses;
  const netProfit = totalEarnings - deductibleExpenses;

  const expectedAmount = notStarted ? 0 : currentDay * target;
  const difference = netProfit - expectedAmount;
  const aheadDays = difference > 0 && target > 0 ? difference / target : 0;
  const behindDays = difference < 0 && target > 0 ? Math.abs(difference) / target : 0;

  const goalTotal = totalDays * target;
  const remainingToGoal = Math.max(goalTotal - netProfit, 0);
  const progressPct = goalTotal > 0 ? Math.min(100, Math.max(0, (netProfit / goalTotal) * 100)) : 0;

  const loggedDays = entries.length;
  const denom = loggedDays || 1;
  const avgDailyEarnings = totalEarnings / denom;
  const avgDailyExpenses = totalExpenses / denom;
  const avgDailyNet = netProfit / denom;

  const daysOfRunway = target > 0 ? netProfit / target : 0;
  const requiredDailyToRecover =
    daysRemaining > 0 ? remainingToGoal / daysRemaining : 0;
  const projectedFinalNet = loggedDays > 0 ? avgDailyNet * totalDays : 0;
  const paceVsTargetPct = target > 0 ? (avgDailyNet / target) * 100 : 0;

  const { current: currentStreak, best: bestStreak } = computeStreaks(entries);

  const todaysEntry = entries.find((e) => e.date === today);
  const missingToday = !todaysEntry && !isCompleted && !notStarted;

  // Spend by category
  const spentByCat = new Map<string, number>();
  for (const e of entries) {
    for (const x of e.expenses) {
      spentByCat.set(x.category, (spentByCat.get(x.category) ?? 0) + (Number(x.amount) || 0));
    }
  }
  const categoryStats: CategoryStat[] = categories.map((c) => {
    const spent = spentByCat.get(c.name) ?? 0;
    const hasBudget = typeof c.budget === "number" && c.budget > 0;
    return {
      name: c.name,
      deductsFromTarget: c.deductsFromTarget,
      budget: hasBudget ? c.budget : undefined,
      spent,
      remaining: hasBudget ? Math.max((c.budget as number) - spent, 0) : undefined,
      pct: hasBudget
        ? Math.min(100, Math.max(0, (spent / (c.budget as number)) * 100))
        : undefined,
    };
  });

  return {
    currentDay,
    daysElapsed,
    daysRemaining,
    endDate,
    isCompleted,
    notStarted,
    daysUntilStart,
    totalEarnings,
    totalExpenses,
    deductibleExpenses,
    nonDeductibleExpenses,
    netProfit,
    expectedAmount,
    difference,
    aheadDays,
    behindDays,
    goalTotal,
    remainingToGoal,
    progressPct,
    avgDailyEarnings,
    avgDailyExpenses,
    avgDailyNet,
    daysOfRunway,
    requiredDailyToRecover,
    projectedFinalNet,
    paceVsTargetPct,
    currentStreak,
    bestStreak,
    loggedDays,
    todaysEntry,
    missingToday,
    categoryStats,
  };
}

export function formatEGP(n: number): string {
  const rounded = Math.round(n);
  return rounded.toLocaleString("en-US") + " EGP";
}

export function entryStatus(
  e: DailyEntry,
  target: number,
  map?: Map<string, Category>,
): "ahead" | "behind" | "ontrack" {
  const net = entryNet(e, map);
  if (net >= target * 1.05) return "ahead";
  if (net < target * 0.95) return "behind";
  return "ontrack";
}
