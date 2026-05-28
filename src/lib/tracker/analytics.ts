import type { DailyEntry, TrackerSettings } from "./types";

export function entryTotalExpenses(e: DailyEntry): number {
  return e.expenses.reduce((s, x) => s + (Number(x.amount) || 0), 0);
}

export function entryNet(e: DailyEntry): number {
  return (Number(e.earnings) || 0) - entryTotalExpenses(e);
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

export type Analytics = {
  currentDay: number; // 1..totalDays (clamped)
  daysElapsed: number; // can exceed totalDays
  daysRemaining: number;
  endDate: string;
  isCompleted: boolean;

  totalEarnings: number;
  totalExpenses: number;
  netProfit: number;

  expectedAmount: number;
  difference: number; // net - expected
  aheadDays: number; // positive if ahead
  behindDays: number; // positive if behind

  goalTotal: number;
  remainingToGoal: number;
  progressPct: number;

  avgDailyEarnings: number;
  avgDailyExpenses: number;
  avgDailyNet: number;

  daysOfRunway: number; // net / dailyTarget
  requiredDailyToRecover: number; // for remaining days
  todaysEntry?: DailyEntry;
  missingToday: boolean;
};

export function computeAnalytics(
  entries: DailyEntry[],
  settings: TrackerSettings,
): Analytics {
  const totalDays = settings.totalDays;
  const target = settings.dailyTarget;
  const today = todayISO();

  const elapsedRaw = daysBetween(settings.startDate, today) + 1;
  const daysElapsed = Math.max(0, elapsedRaw);
  const currentDay = Math.min(Math.max(daysElapsed, 1), totalDays);
  const daysRemaining = Math.max(totalDays - daysElapsed, 0);

  const endDateObj = new Date(settings.startDate + "T00:00:00");
  endDateObj.setDate(endDateObj.getDate() + totalDays - 1);
  const endDate = endDateObj.toISOString().slice(0, 10);
  const isCompleted = daysElapsed >= totalDays;

  const totalEarnings = entries.reduce((s, e) => s + (Number(e.earnings) || 0), 0);
  const totalExpenses = entries.reduce((s, e) => s + entryTotalExpenses(e), 0);
  const netProfit = totalEarnings - totalExpenses;

  const expectedAmount = currentDay * target;
  const difference = netProfit - expectedAmount;
  const aheadDays = difference > 0 ? difference / target : 0;
  const behindDays = difference < 0 ? Math.abs(difference) / target : 0;

  const goalTotal = totalDays * target;
  const remainingToGoal = Math.max(goalTotal - netProfit, 0);
  const progressPct = Math.min(100, (netProfit / goalTotal) * 100);

  const entriesCount = entries.length || 1;
  const avgDailyEarnings = totalEarnings / entriesCount;
  const avgDailyExpenses = totalExpenses / entriesCount;
  const avgDailyNet = netProfit / entriesCount;

  const daysOfRunway = target > 0 ? netProfit / target : 0;
  const requiredDailyToRecover =
    daysRemaining > 0 ? remainingToGoal / daysRemaining : 0;

  const todaysEntry = entries.find((e) => e.date === today);
  const missingToday = !todaysEntry && !isCompleted;

  return {
    currentDay,
    daysElapsed,
    daysRemaining,
    endDate,
    isCompleted,
    totalEarnings,
    totalExpenses,
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
    todaysEntry,
    missingToday,
  };
}

export function formatEGP(n: number): string {
  const rounded = Math.round(n);
  return rounded.toLocaleString("en-US") + " EGP";
}

export function entryStatus(
  e: DailyEntry,
  target: number,
): "ahead" | "behind" | "ontrack" {
  const net = entryNet(e);
  if (net >= target * 1.05) return "ahead";
  if (net < target * 0.95) return "behind";
  return "ontrack";
}
