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

/** Real net for the day: earnings minus ALL expenses (including savings/non-deductible).
 *  This is what the user actually has left in pocket. */
export function entryNet(e: DailyEntry, map?: Map<string, Category>): number {
  return (Number(e.earnings) || 0) - entryTotalExpenses(e);
}

/** Amount that counts toward the daily target — earnings minus deductible expenses only.
 *  Non-deductible categories (savings, capped spend, etc.) do NOT reduce target progress.
 *  This per-entry helper treats non-deductible spend as fully excluded. For cap-aware
 *  results across many entries, use `computeEntryTargetDeductions` + `entryTargetNetUsing`. */
export function entryTargetNet(e: DailyEntry, map?: Map<string, Category>): number {
  return (Number(e.earnings) || 0) - entryDeductibleExpenses(e, map);
}

/** Earnings minus the precomputed deductible total for this entry. */
export function entryTargetNetUsing(e: DailyEntry, deductions: Map<string, number>): number {
  return (Number(e.earnings) || 0) - (deductions.get(e.id) ?? 0);
}

/** Walks entries in chronological order and returns total deductible amount per entry,
 *  accounting for non-deductible categories with a budget cap: any spend that pushes the
 *  cumulative balance above the cap counts as deductible (eats from the target). Savings
 *  categories without a cap stay fully non-deductible. */
export function computeEntryTargetDeductions(
  entries: DailyEntry[],
  map?: Map<string, Category>,
): Map<string, number> {
  const sorted = [...entries].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1,
  );
  const cumByCat = new Map<string, number>();
  const out = new Map<string, number>();
  for (const e of sorted) {
    let deduct = 0;
    for (const x of e.expenses) {
      const amt = Number(x.amount) || 0;
      if (isDeductible(x.category, map)) {
        deduct += amt;
        continue;
      }
      const cat = map?.get(x.category);
      const cap = cat && typeof cat.budget === "number" && cat.budget > 0 ? cat.budget : undefined;
      const prev = cumByCat.get(x.category) ?? 0;
      const next = prev + amt;
      cumByCat.set(x.category, next);
      if (cap !== undefined && amt > 0 && next > cap) {
        const over = Math.min(amt, next - cap);
        deduct += over;
      }
    }
    out.set(e.id, deduct);
  }
  return out;
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
  /** Net of contributions minus withdrawals (or raw spent for deductible cats). */
  spent: number;
  /** Positive entries — money put into this category (savings deposit). */
  contributed: number;
  /** Absolute value of negative entries — money taken out. */
  withdrawn: number;
  /** contributed - withdrawn (== spent). Kept for clarity in UI. */
  balance: number;
  remaining?: number;
  pct?: number;
};

export type TipKind = "success" | "warning" | "danger" | "info";
export type Tip = {
  kind: TipKind;
  icon: string; // emoji
  title: string;
  body?: string;
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
  netProfit: number; // earnings - ALL expenses (real money in pocket)
  targetProgress: number; // earnings - deductibleExpenses (counts toward goal)

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
  motivationalTips: Tip[];
  restDaysAvailable: number;
  bestDay?: { date: string; net: number };
  worstDay?: { date: string; net: number };
  expenseRatio: number; // total expenses / total earnings
  savingsRate: number; // non-deductible contributions / earnings
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
  const netProfit = totalEarnings - totalExpenses;
  const targetProgress = totalEarnings - deductibleExpenses;

  const expectedAmount = notStarted ? 0 : currentDay * target;
  const difference = targetProgress - expectedAmount;
  const aheadDays = difference > 0 && target > 0 ? difference / target : 0;
  const behindDays = difference < 0 && target > 0 ? Math.abs(difference) / target : 0;

  const goalTotal = totalDays * target;
  const remainingToGoal = Math.max(goalTotal - targetProgress, 0);
  const progressPct = goalTotal > 0 ? Math.min(100, Math.max(0, (targetProgress / goalTotal) * 100)) : 0;

  const loggedDays = entries.length;
  const denom = loggedDays || 1;
  const avgDailyEarnings = totalEarnings / denom;
  const avgDailyExpenses = totalExpenses / denom;
  const avgDailyNet = netProfit / denom;
  const avgDailyTargetNet = targetProgress / denom;

  const daysOfRunway = target > 0 ? targetProgress / target : 0;
  const requiredDailyToRecover =
    daysRemaining > 0 ? remainingToGoal / daysRemaining : 0;
  const projectedFinalNet = loggedDays > 0 ? avgDailyTargetNet * totalDays : 0;
  const paceVsTargetPct = target > 0 ? (avgDailyTargetNet / target) * 100 : 0;

  const { current: currentStreak, best: bestStreak } = computeStreaks(entries);

  const todaysEntry = entries.find((e) => e.date === today);
  const missingToday = !todaysEntry && !isCompleted && !notStarted;

  // Spend by category — track contributions (positive) vs withdrawals (negative)
  const contribByCat = new Map<string, number>();
  const withdrawByCat = new Map<string, number>();
  for (const e of entries) {
    for (const x of e.expenses) {
      const v = Number(x.amount) || 0;
      if (v >= 0) {
        contribByCat.set(x.category, (contribByCat.get(x.category) ?? 0) + v);
      } else {
        withdrawByCat.set(x.category, (withdrawByCat.get(x.category) ?? 0) + Math.abs(v));
      }
    }
  }
  const categoryStats: CategoryStat[] = categories.map((c) => {
    const contributed = contribByCat.get(c.name) ?? 0;
    const withdrawn = withdrawByCat.get(c.name) ?? 0;
    const balance = contributed - withdrawn;
    const hasBudget = typeof c.budget === "number" && c.budget > 0;
    return {
      name: c.name,
      deductsFromTarget: c.deductsFromTarget,
      budget: hasBudget ? c.budget : undefined,
      spent: balance,
      contributed,
      withdrawn,
      balance,
      remaining: hasBudget ? Math.max((c.budget as number) - balance, 0) : undefined,
      pct: hasBudget
        ? Math.min(100, Math.max(0, (balance / (c.budget as number)) * 100))
        : undefined,
    };
  });

  // Best / worst day
  let bestDay: { date: string; net: number } | undefined;
  let worstDay: { date: string; net: number } | undefined;
  for (const e of entries) {
    const n = entryNet(e, catMap);
    if (!bestDay || n > bestDay.net) bestDay = { date: e.date, net: n };
    if (!worstDay || n < worstDay.net) worstDay = { date: e.date, net: n };
  }

  const expenseRatio = totalEarnings > 0 ? totalExpenses / totalEarnings : 0;
  const totalSavingsContrib = categoryStats
    .filter((s) => !s.deductsFromTarget)
    .reduce((s, c) => s + c.contributed, 0);
  const savingsRate = totalEarnings > 0 ? totalSavingsContrib / totalEarnings : 0;

  // Smart motivational tips
  const tips: Tip[] = [];
  const restDaysAvailable =
    target > 0 && difference > 0 ? Math.floor(difference / target) : 0;

  if (notStarted) {
    tips.push({
      kind: "info",
      icon: "🚀",
      title: `التحدي يبدأ بعد ${daysUntilStart} يوم`,
      body: "تقدر تجهز كاتوجوريز المصروفات والادخار من دلوقتي.",
    });
  } else if (isCompleted) {
    if (targetProgress >= goalTotal) {
      tips.push({
        kind: "success",
        icon: "🏆",
        title: `مبروك! تخطّيت الهدف بـ ${formatEGP(targetProgress - goalTotal)}`,
        body: `صافي حقيقي في الجيب: ${formatEGP(netProfit)} على مدار ${totalDays} يوم.`,
      });
    } else {
      tips.push({
        kind: "warning",
        icon: "🎯",
        title: `خلصت التحدي بـ ${formatEGP(targetProgress)} (${progressPct.toFixed(0)}% من الهدف)`,
        body: "ابدأ جولة جديدة بهدف يومي أنسب لمعدلك الحقيقي.",
      });
    }
  } else {
    // === Pace ===
    if (difference >= 0) {
      if (restDaysAvailable >= 1) {
        tips.push({
          kind: "success",
          icon: "😎",
          title: `متقدم بـ ${formatEGP(difference)} — يساوي ${restDaysAvailable} يوم راحة`,
          body: `حتى لو ما كسبتش حاجة لـ ${restDaysAvailable} يوم، لسه فوق الخط.`,
        });
      } else {
        tips.push({
          kind: "success",
          icon: "🔥",
          title: `فوق التارجت بـ ${formatEGP(difference)}`,
          body: "ثبات الأداء ده هو اللي بيوصلك للهدف. كمّل.",
        });
      }
      if (difference >= target * 2) {
        tips.push({
          kind: "info",
          icon: "🏦",
          title: `حوّل الزيادة لكاتوجري ادخار`,
          body: `عندك ${formatEGP(difference)} فوق المطلوب — لو نقلت منها ${formatEGP(target)} لادخار، هتبني عادة بدل ما تتصرف.`,
        });
      }
    } else {
      const need = requiredDailyToRecover;
      const gap = Math.abs(difference);
      tips.push({
        kind: "danger",
        icon: "⚠️",
        title: `متأخر بـ ${formatEGP(gap)} (≈ ${behindDays.toFixed(1)} يوم)`,
        body:
          daysRemaining > 0
            ? `محتاج ${formatEGP(need)}/يوم للـ ${daysRemaining} يوم الجايين بدل ${formatEGP(target)}.`
            : "خلص الوقت — راجع الهدف للجولة الجاية.",
      });
      if (avgDailyNet > 0 && need > avgDailyNet * 1.4 && daysRemaining > 0) {
        const extra = need - avgDailyNet;
        tips.push({
          kind: "warning",
          icon: "🧮",
          title: "الفجوة كبيرة على معدلك الحالي",
          body: `معدلك ${formatEGP(avgDailyNet)}/يوم، والمطلوب ${formatEGP(need)}. لازم تزود ${formatEGP(extra)} يوميًا أو تقلل مصروفاتك بنفس الرقم.`,
        });
      }
    }

    // === Projection ===
    if (loggedDays >= 3) {
      if (projectedFinalNet >= goalTotal) {
        const surplus = projectedFinalNet - goalTotal;
        tips.push({
          kind: "success",
          icon: "📈",
          title: `لو كملت على نفس الإيقاع هتوصل لـ ${formatEGP(projectedFinalNet)}`,
          body: `يعني ${formatEGP(surplus)} فوق الهدف.`,
        });
      } else {
        const shortfall = goalTotal - projectedFinalNet;
        tips.push({
          kind: "warning",
          icon: "📉",
          title: `التوقع الحالي: ${formatEGP(projectedFinalNet)} (${paceVsTargetPct.toFixed(0)}% من السرعة)`,
          body: `لو ما تغيّرش شيء هتقل عن الهدف بـ ${formatEGP(shortfall)}.`,
        });
      }
    }

    // === Expense ratio ===
    if (totalEarnings > 0 && expenseRatio >= 0.5) {
      tips.push({
        kind: "warning",
        icon: "💸",
        title: `المصروفات بتاكل ${(expenseRatio * 100).toFixed(0)}% من دخلك`,
        body: "ابص على أكبر كاتوجري مصاريف وشوف فيها بند تقدر تقلله.",
      });
    } else if (totalEarnings > 0 && expenseRatio > 0 && expenseRatio < 0.2 && loggedDays >= 3) {
      tips.push({
        kind: "success",
        icon: "🧘",
        title: `إنفاقك منضبط — ${(expenseRatio * 100).toFixed(0)}% بس من الدخل`,
      });
    }
  }

  // === Streak ===
  if (currentStreak >= 7) {
    tips.push({
      kind: "success",
      icon: "🔥",
      title: `${currentStreak} يوم متواصلين — أسطورة`,
      body: bestStreak > currentStreak ? `أفضل سلسلة ليك: ${bestStreak} يوم.` : "ده أطول streak ليك حتى الآن.",
    });
  } else if (currentStreak >= 3) {
    tips.push({
      kind: "info",
      icon: "✨",
      title: `سلسلة ${currentStreak} يوم — متكسرهاش`,
    });
  } else if (missingToday) {
    tips.push({
      kind: "warning",
      icon: "📝",
      title: "النهارده لسه متسجّلش",
      body: "حتى لو الدخل صفر، سجّل اليوم عشان البيانات تفضل دقيقة.",
    });
  }

  // === Best / worst day insight ===
  if (loggedDays >= 5 && bestDay && worstDay && bestDay.date !== worstDay.date) {
    if (bestDay.net > target * 2) {
      tips.push({
        kind: "info",
        icon: "⭐",
        title: `أفضل يوم: ${formatEGP(bestDay.net)} في ${bestDay.date}`,
        body: "حاول تفتكر إيه اللي خلاه مميز وكرر الفورمولا دي.",
      });
    }
    if (worstDay.net < 0) {
      tips.push({
        kind: "warning",
        icon: "🚨",
        title: `أسوأ يوم: ${formatEGP(worstDay.net)} في ${worstDay.date}`,
        body: "راجع المصروفات في اليوم ده — في حاجة استثنائية ولا عادة محتاجة تتظبط؟",
      });
    }
  }

  // === Savings ===
  if (savingsRate >= 0.1 && totalSavingsContrib > 0) {
    tips.push({
      kind: "success",
      icon: "💰",
      title: `بتدخر ${(savingsRate * 100).toFixed(0)}% من دخلك`,
      body: `إجمالي ادخار: ${formatEGP(totalSavingsContrib)}.`,
    });
  }
  const savingsCats = categoryStats.filter((s) => !s.deductsFromTarget && s.budget);
  for (const s of savingsCats) {
    if (s.pct !== undefined && s.pct >= 100) {
      tips.push({
        kind: "success",
        icon: "✅",
        title: `وصلت لهدف "${s.name}" بالكامل`,
        body: "ارفع الهدف أو ابدأ كاتوجري ادخار جديد.",
      });
    } else if (s.pct !== undefined && s.pct >= 50) {
      tips.push({
        kind: "info",
        icon: "🎯",
        title: `"${s.name}": ${s.pct.toFixed(0)}% من الهدف`,
        body: `فاضل ${formatEGP(s.remaining ?? 0)} للوصول لـ ${formatEGP(s.budget as number)}.`,
      });
    }
    if (s.withdrawn > s.contributed * 0.5 && s.contributed > 0) {
      tips.push({
        kind: "warning",
        icon: "⛔",
        title: `بتسحب كتير من "${s.name}"`,
        body: `سحبت ${formatEGP(s.withdrawn)} من ${formatEGP(s.contributed)} ادخرتهم. حاول تقلل السحب.`,
      });
    }
  }


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
    targetProgress,
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
    motivationalTips: tips,
    restDaysAvailable,
    bestDay,
    worstDay,
    expenseRatio,
    savingsRate,
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
  const net = entryTargetNet(e, map);
  if (net >= target * 1.05) return "ahead";
  if (net < target * 0.95) return "behind";
  return "ontrack";
}
