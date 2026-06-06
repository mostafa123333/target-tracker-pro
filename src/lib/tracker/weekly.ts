import type { Category, DailyEntry, TrackerSettings } from "./types";
import {
  computeEntryTargetDeductions,
  entryNet,
  entryTargetNetUsing,
  entryTotalExpenses,
  makeCategoryMap,
  todayISO,
} from "./analytics";

export type WeekSummary = {
  start: string; // YYYY-MM-DD (Saturday)
  end: string;   // YYYY-MM-DD (Friday)
  days: number;  // days logged in window
  earnings: number;
  expenses: number;
  net: number;
  targetNet: number;
  hitDays: number;       // days that hit the daily target
  bestDay?: { date: string; net: number };
};

export type WeeklyReview = {
  thisWeek: WeekSummary;
  lastWeek: WeekSummary;
  earningsDeltaPct: number; // (this - last) / last * 100, 0 when last == 0
  netDeltaPct: number;
  hitDaysDelta: number;
};

function startOfWeekSat(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  // 6 = Saturday in JS. Compute days back to Saturday.
  const back = (d.getDay() + 1) % 7; // Sat->0, Sun->1, ... Fri->6
  d.setDate(d.getDate() - back);
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function summarize(
  entries: DailyEntry[],
  start: string,
  end: string,
  target: number,
  catMap: Map<string, Category>,
  ded: Map<string, number>,
): WeekSummary {
  const inRange = entries.filter((e) => e.date >= start && e.date <= end);
  let earnings = 0;
  let expenses = 0;
  let net = 0;
  let targetNet = 0;
  let hitDays = 0;
  let bestDay: WeekSummary["bestDay"];
  for (const e of inRange) {
    const en = Number(e.earnings) || 0;
    const exp = entryTotalExpenses(e);
    const n = entryNet(e, catMap);
    const tn = entryTargetNetUsing(e, ded);
    earnings += en;
    expenses += exp;
    net += n;
    targetNet += tn;
    if (tn >= target) hitDays++;
    if (!bestDay || n > bestDay.net) bestDay = { date: e.date, net: n };
  }
  return {
    start,
    end,
    days: inRange.length,
    earnings,
    expenses,
    net,
    targetNet,
    hitDays,
    bestDay,
  };
}

export function computeWeeklyReview(
  entries: DailyEntry[],
  settings: TrackerSettings,
  categories: Category[],
): WeeklyReview {
  const catMap = makeCategoryMap(categories);
  const ded = computeEntryTargetDeductions(entries, catMap);
  const thisStart = startOfWeekSat(todayISO());
  const thisEnd = addDays(thisStart, 6);
  const lastStart = addDays(thisStart, -7);
  const lastEnd = addDays(thisStart, -1);
  const thisWeek = summarize(entries, thisStart, thisEnd, settings.dailyTarget, catMap, ded);
  const lastWeek = summarize(entries, lastStart, lastEnd, settings.dailyTarget, catMap, ded);
  const earningsDeltaPct =
    lastWeek.earnings > 0
      ? ((thisWeek.earnings - lastWeek.earnings) / lastWeek.earnings) * 100
      : thisWeek.earnings > 0
        ? 100
        : 0;
  const netDeltaPct =
    Math.abs(lastWeek.net) > 0
      ? ((thisWeek.net - lastWeek.net) / Math.abs(lastWeek.net)) * 100
      : thisWeek.net !== 0
        ? 100 * Math.sign(thisWeek.net)
        : 0;
  return {
    thisWeek,
    lastWeek,
    earningsDeltaPct,
    netDeltaPct,
    hitDaysDelta: thisWeek.hitDays - lastWeek.hitDays,
  };
}
