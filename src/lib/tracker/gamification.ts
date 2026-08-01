import type { Category, DailyEntry, TrackerSettings } from "./types";
import {
  computeEntryTargetDeductions,
  entryNet,
  entryTargetNetUsing,
  entryTotalExpenses,
  makeCategoryMap,
  todayISO,
} from "./analytics";

export type Achievement = {
  id: string;
  title: string;
  desc: string;
  icon: string;
  unlocked: boolean;
  progress: number;
  target: number;
};

export type LevelInfo = {
  level: number;
  name: string;
  xp: number;
  xpFloor: number;
  xpCeil: number;
  xpInLevel: number;
  xpToNext: number;
  pct: number;
};

export type WeekdayStat = {
  /** 0=Sun … 6=Sat */
  weekday: number;
  label: string;
  count: number;
  avgEarnings: number;
  avgNet: number;
  totalEarnings: number;
  isBest: boolean;
};

export type HeatCell = {
  date: string;
  value: number;
  intensity: 0 | 1 | 2 | 3 | 4;
  logged: boolean;
};

export type WeekCompare = {
  thisWeekEarnings: number;
  lastWeekEarnings: number;
  thisWeekNet: number;
  lastWeekNet: number;
  earningsDeltaPct: number;
  netDeltaPct: number;
  thisWeekDays: number;
  lastWeekDays: number;
};

export type DailyChallenge = {
  title: string;
  body: string;
  target: number;
  progress: number;
  done: boolean;
  icon: string;
};

export type Gamification = {
  level: LevelInfo;
  achievements: Achievement[];
  unlockedCount: number;
  weekdayStats: WeekdayStat[];
  bestWeekday?: WeekdayStat;
  weekCompare: WeekCompare;
  heatmap: HeatCell[];
  challenge: DailyChallenge;
};

const LEVEL_NAMES = [
  "مبتدئ",
  "ساعي",
  "مجتهد",
  "محترف",
  "خبير",
  "نجم",
  "بطل",
  "محارب",
  "أسطورة",
  "إمبراطور",
];

const WEEKDAY_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

/** Cumulative XP needed to reach each level (index = level - 1). */
function levelThreshold(level: number): number {
  if (level <= 1) return 0;
  // Geometric-ish curve: 500, 1500, 3500, 7000, 12000, 20000, 35000, 60000, 100000, +50k thereafter
  const ladder = [0, 500, 1500, 3500, 7000, 12000, 20000, 35000, 60000, 100000];
  if (level <= ladder.length) return ladder[level - 1];
  return ladder[ladder.length - 1] + (level - ladder.length) * 50000;
}

function computeLevel(xp: number): LevelInfo {
  let level = 1;
  while (levelThreshold(level + 1) <= xp) level++;
  const xpFloor = levelThreshold(level);
  const xpCeil = levelThreshold(level + 1);
  const xpInLevel = xp - xpFloor;
  const xpToNext = Math.max(0, xpCeil - xp);
  const range = Math.max(1, xpCeil - xpFloor);
  const name = LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)];
  return {
    level,
    name,
    xp,
    xpFloor,
    xpCeil,
    xpInLevel,
    xpToNext,
    pct: Math.min(100, (xpInLevel / range) * 100),
  };
}

function parseDate(iso: string): Date {
  return new Date(iso + "T00:00:00");
}

function isoFromDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay()); // Sunday start
  return x;
}

export function computeGamification(
  entries: DailyEntry[],
  settings: TrackerSettings,
  categories: Category[] = [],
): Gamification {
  const catMap = makeCategoryMap(categories);
  const deductions = computeEntryTargetDeductions(entries, catMap);
  const target = settings.dailyTarget;
  const today = todayISO();
  const todayDate = parseDate(today);

  // ===== XP & level =====
  // XP comes only from positive target-net contributions (encourages earning).
  let xp = 0;
  for (const e of entries) {
    const tn = entryTargetNetUsing(e, deductions);
    if (tn > 0) xp += tn;
  }
  const level = computeLevel(Math.floor(xp));

  // ===== Weekday stats =====
  const buckets = Array.from({ length: 7 }, () => ({
    count: 0,
    earnings: 0,
    net: 0,
  }));
  for (const e of entries) {
    const wd = parseDate(e.date).getDay();
    const b = buckets[wd];
    b.count++;
    b.earnings += Number(e.earnings) || 0;
    b.net += entryNet(e, catMap);
  }
  const weekdayStats: WeekdayStat[] = buckets.map((b, i) => ({
    weekday: i,
    label: WEEKDAY_AR[i],
    count: b.count,
    avgEarnings: b.count ? b.earnings / b.count : 0,
    avgNet: b.count ? b.net / b.count : 0,
    totalEarnings: b.earnings,
    isBest: false,
  }));
  const withData = weekdayStats.filter((w) => w.count > 0);
  let bestWeekday: WeekdayStat | undefined;
  if (withData.length) {
    bestWeekday = withData.reduce((a, b) => (b.avgEarnings > a.avgEarnings ? b : a));
    weekdayStats[bestWeekday.weekday].isBest = true;
  }

  // ===== Week compare (this week vs last week) =====
  const thisWeekStart = startOfWeek(todayDate);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);

  let twE = 0,
    twN = 0,
    twD = 0,
    lwE = 0,
    lwN = 0,
    lwD = 0;
  for (const e of entries) {
    const d = parseDate(e.date);
    const earn = Number(e.earnings) || 0;
    const net = entryNet(e, catMap);
    if (d >= thisWeekStart && d <= todayDate) {
      twE += earn;
      twN += net;
      twD++;
    } else if (d >= lastWeekStart && d <= lastWeekEnd) {
      lwE += earn;
      lwN += net;
      lwD++;
    }
  }
  const pctDelta = (a: number, b: number) =>
    b === 0 ? (a > 0 ? 100 : 0) : ((a - b) / Math.abs(b)) * 100;
  const weekCompare: WeekCompare = {
    thisWeekEarnings: twE,
    lastWeekEarnings: lwE,
    thisWeekNet: twN,
    lastWeekNet: lwN,
    earningsDeltaPct: pctDelta(twE, lwE),
    netDeltaPct: pctDelta(twN, lwN),
    thisWeekDays: twD,
    lastWeekDays: lwD,
  };

  // ===== Heatmap (last 49 days) =====
  const byDate = new Map<string, DailyEntry>();
  for (const e of entries) byDate.set(e.date, e);
  const heatmap: HeatCell[] = [];
  // Use earnings for color intensity, scaled vs daily target
  for (let i = 48; i >= 0; i--) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - i);
    const iso = isoFromDate(d);
    const e = byDate.get(iso);
    const v = e ? Number(e.earnings) || 0 : 0;
    let intensity: 0 | 1 | 2 | 3 | 4 = 0;
    if (e) {
      const r = target > 0 ? v / target : 0;
      if (r >= 1.5) intensity = 4;
      else if (r >= 1) intensity = 3;
      else if (r >= 0.5) intensity = 2;
      else intensity = 1;
    }
    heatmap.push({ date: iso, value: v, intensity, logged: !!e });
  }

  // ===== Daily challenge =====
  // "Beat your weekday average earnings"
  const todaysEntry = byDate.get(today);
  const todayWd = todayDate.getDay();
  const wdAvg = weekdayStats[todayWd].avgEarnings;
  // If no weekday data, fall back to daily target
  const challengeTarget = Math.max(target, Math.round(wdAvg * 1.1));
  const todayEarn = todaysEntry ? Number(todaysEntry.earnings) || 0 : 0;
  const challenge: DailyChallenge = {
    icon: "🎯",
    title: wdAvg > 0
      ? `تحدي اليوم: اكسر متوسط ${WEEKDAY_AR[todayWd]}`
      : "تحدي اليوم: اوصل للهدف اليومي",
    body: wdAvg > 0
      ? `متوسطك في ${WEEKDAY_AR[todayWd]}: ${Math.round(wdAvg)} EGP. اعمل ${Math.round(challengeTarget)} EGP النهارده.`
      : `اعمل ${Math.round(challengeTarget)} EGP النهارده.`,
    target: challengeTarget,
    progress: todayEarn,
    done: todayEarn >= challengeTarget && challengeTarget > 0,
  };

  // ===== Achievements =====
  // Streak (reuse simple chronological scan)
  const dateSet = new Set(entries.map((e) => e.date));
  const sortedDates = [...dateSet].sort();
  let bestStreak = 0,
    runStreak = 0;
  let prev: string | null = null;
  for (const d of sortedDates) {
    if (prev) {
      const diff = Math.round(
        (parseDate(d).getTime() - parseDate(prev).getTime()) / 86_400_000,
      );
      runStreak = diff === 1 ? runStreak + 1 : 1;
    } else runStreak = 1;
    if (runStreak > bestStreak) bestStreak = runStreak;
    prev = d;
  }

  // Hit-target count (using target-net)
  let hitTargetDays = 0;
  let doubleTargetDays = 0;
  let tripleTargetDays = 0;
  let bigDay500 = false;
  let bigDay1000 = false;
  let bigDayEarnings1000 = false;
  let bestNetDay = 0;
  let bestEarningsDay = 0;
  for (const e of entries) {
    const tn = entryTargetNetUsing(e, deductions);
    if (tn >= target && target > 0) hitTargetDays++;
    if (tn >= target * 2 && target > 0) doubleTargetDays++;
    if (tn >= target * 3 && target > 0) tripleTargetDays++;
    const n = entryNet(e, catMap);
    const earn = Number(e.earnings) || 0;
    if (n > bestNetDay) bestNetDay = n;
    if (earn > bestEarningsDay) bestEarningsDay = earn;
    if (n >= 500) bigDay500 = true;
    if (n >= 1000) bigDay1000 = true;
    if (earn >= 1000) bigDayEarnings1000 = true;
  }

  // Perfect week: any 7 consecutive logged dates where each hits target
  let perfectWeek = false;
  // Perfect 2 weeks: any 14 consecutive logged dates hitting target
  let perfectTwoWeeks = false;
  const sortedEntries = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
  for (let i = 0; i + 6 < sortedEntries.length; i++) {
    const window = sortedEntries.slice(i, i + 7);
    const consecutive = window.every((e, idx) => {
      if (idx === 0) return true;
      const diff = Math.round(
        (parseDate(e.date).getTime() - parseDate(window[idx - 1].date).getTime()) /
          86_400_000,
      );
      return diff === 1;
    });
    if (!consecutive) continue;
    const allHit = window.every(
      (e) => entryTargetNetUsing(e, deductions) >= target && target > 0,
    );
    if (allHit) {
      perfectWeek = true;
      // Try extending to 14
      if (i + 13 < sortedEntries.length) {
        const window14 = sortedEntries.slice(i, i + 14);
        const consecutive14 = window14.every((e, idx) => {
          if (idx === 0) return true;
          const diff = Math.round(
            (parseDate(e.date).getTime() - parseDate(window14[idx - 1].date).getTime()) /
              86_400_000,
          );
          return diff === 1;
        });
        if (consecutive14 && window14.every((e) => entryTargetNetUsing(e, deductions) >= target && target > 0)) {
          perfectTwoWeeks = true;
        }
      }
      break;
    }
  }

  // Consecutive target-hits (any streak of hits, not just 7)
  let bestHitStreak = 0;
  let currentHitStreak = 0;
  let prevHitDate: string | null = null;
  for (const e of sortedEntries) {
    const hit = entryTargetNetUsing(e, deductions) >= target && target > 0;
    if (!hit) {
      currentHitStreak = 0;
      prevHitDate = null;
      continue;
    }
    if (prevHitDate && daysBetween(prevHitDate, e.date) === 1) {
      currentHitStreak++;
    } else {
      currentHitStreak = 1;
    }
    if (currentHitStreak > bestHitStreak) bestHitStreak = currentHitStreak;
    prevHitDate = e.date;
  }

  // Total days at 2x or 3x (cumulative, not consecutive)
  const totalDoubleDays = doubleTargetDays;
  const totalTripleDays = tripleTargetDays;

  // Lean spending day (expenses < 20% of earnings) count
  let leanDays = 0;
  for (const e of entries) {
    const earn = Number(e.earnings) || 0;
    if (earn <= 0) continue;
    if (entryTotalExpenses(e) / earn < 0.2) leanDays++;
  }

  // Savings balance
  let savingsBalance = 0;
  for (const c of categories) {
    if (c.deductsFromTarget) continue;
    for (const e of entries) {
      for (const x of e.expenses) {
        if (x.category === c.name) savingsBalance += Number(x.amount) || 0;
      }
    }
  }

  const totalEarnings = entries.reduce((s, e) => s + (Number(e.earnings) || 0), 0);

  const ach = (
    id: string,
    icon: string,
    title: string,
    desc: string,
    progress: number,
    targetN: number,
  ): Achievement => ({
    id,
    icon,
    title,
    desc,
    progress: Math.min(progress, targetN),
    target: targetN,
    unlocked: progress >= targetN && targetN > 0,
  });

  const achievements: Achievement[] = [
    ach("first_step", "👣", "أول خطوة", "سجّل أول يوم", entries.length, 1),
    ach("ten_days", "📅", "عشرة على عشرة", "سجّل 10 أيام", entries.length, 10),
    ach("month_logged", "🗓️", "شهر كامل", "سجّل 30 يوم", entries.length, 30),
    ach("streak_3", "✨", "ثلاثية", "3 أيام متواصلة", bestStreak, 3),
    ach("streak_7", "🔥", "أسبوع نار", "7 أيام متواصلة", bestStreak, 7),
    ach("streak_14", "⚡", "أسبوعين بلا توقف", "14 يوم متواصل", bestStreak, 14),
    ach("streak_30", "🌟", "شهر بلا كسر", "30 يوم متواصل", bestStreak, 30),
    ach("hit_1", "🎯", "أول هدف", "اكسب التارجت في يوم", hitTargetDays, 1),
    ach("hit_10", "🏹", "صياد أهداف", "حقق التارجت في 10 أيام", hitTargetDays, 10),
    ach("hit_30", "🥇", "ملك التارجت", "حقق التارجت في 30 يوم", hitTargetDays, 30),
    ach("double", "💪", "ضعف الهدف", "يوم بـ ضعف التارجت", doubleTargetDays, 1),
    ach("triple", "🚀", "ثلاثة أضعاف", "يوم بـ 3 أضعاف التارجت", tripleTargetDays, 1),
    ach("big_500", "💵", "خمسمية صافي", "صافي يوم ≥ 500 EGP", bigDay500 ? 1 : 0, 1),
    ach("big_1000", "💎", "ألف في اليوم", "صافي يوم ≥ 1000 EGP", bigDay1000 ? 1 : 0, 1),
    ach("perfect_week", "🏆", "أسبوع مثالي", "7 أيام كلها فوق التارجت", perfectWeek ? 1 : 0, 1),
    ach("lean_5", "🧘", "إنفاق منضبط", "5 أيام بمصروفات أقل من 20%", leanDays, 5),
    ach("saver_1k", "🏦", "مدّخر مبتدئ", "ادخر 1000 EGP", savingsBalance, 1000),
    ach("saver_5k", "💰", "مدّخر محترف", "ادخر 5000 EGP", savingsBalance, 5000),
    ach("earn_10k", "📈", "أول 10 آلاف", "إجمالي دخل 10,000 EGP", totalEarnings, 10000),
    ach("earn_25k", "🌠", "ربع مليون قرش", "إجمالي دخل 25,000 EGP", totalEarnings, 25000),
  ];

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return {
    level,
    achievements,
    unlockedCount,
    weekdayStats,
    bestWeekday,
    weekCompare,
    heatmap,
    challenge,
  };
}
