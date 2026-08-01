import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  formatEGP,
  todayISO,
  type DailyEntry,
  type TrackerSettings,
} from "@/lib/tracker/analytics";
import { Zap, TrendingUp, Target, Flame, Trophy } from "lucide-react";

export type MotivationCardProps = {
  settings: TrackerSettings;
  todaysEntry?: DailyEntry;
  currentStreak: number;
  targetProgress: number;
  expectedAmount: number;
  difference: number;
  daysRemaining: number;
  onAddToday: () => void;
};

export function MotivationCard({
  settings,
  todaysEntry,
  currentStreak,
  targetProgress,
  expectedAmount,
  difference,
  daysRemaining,
  onAddToday,
}: MotivationCardProps) {
  const todayEarned = Number(todaysEntry?.earnings) || 0;
  const target = settings.dailyTarget;
  const gap = Math.max(0, target - todayEarned);
  const pct = target > 0 ? Math.min(100, (todayEarned / target) * 100) : 0;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const messages = getMessages({
    todayEarned,
    target,
    gap,
    currentStreak,
    difference,
    daysRemaining,
    todaysEntry,
  });

  return (
    <div className="glass-card relative overflow-hidden p-5" dir="rtl">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(circle at 80% 20%, oklch(0.78 0.18 152 / 0.15), transparent 55%)",
        }}
      />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Progress ring + status */}
        <div className="flex items-center gap-4">
          <div className="relative grid h-20 w-20 shrink-0 place-items-center">
            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="fill-none stroke-muted/40"
                strokeWidth="3"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={cn(
                  "fill-none transition-all duration-700",
                  pct >= 100 ? "stroke-[color:var(--success)]" : "stroke-primary",
                )}
                strokeWidth="3"
                strokeDasharray={`${pct}, 100`}
                strokeLinecap="round"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                style={{ opacity: mounted ? 1 : 0 }}
              />
            </svg>
            <div className="text-center">
              <div className="stat-number text-lg leading-none">
                {pct.toFixed(0)}%
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                اليوم
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="text-xs font-medium text-muted-foreground">
              {todaysEntry ? "أرباح اليوم" : "النهارده لسه متسجّلش"}
            </div>
            <div
              className={cn(
                "stat-number text-3xl tracking-tight",
                todayEarned >= target ? "text-[color:var(--success)]" : "text-foreground",
              )}
            >
              {formatEGP(todayEarned)}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                الهدف: {formatEGP(target)}
              </span>
              {currentStreak > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--warning)]/15 px-2 py-0.5 text-[color:var(--warning)]">
                  <Flame className="h-3 w-3" />
                  {currentStreak} يوم متتابع
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Message + CTA */}
        <div className="flex flex-1 flex-col gap-3 md:items-end">
          <div className="max-w-sm text-sm leading-relaxed md:text-right">
            <span className="font-semibold text-foreground">{messages.title}</span>
            {messages.body && (
              <span className="text-muted-foreground"> — {messages.body}</span>
            )}
          </div>

          {!todaysEntry && (
            <Button className="glow-primary w-full md:w-auto" onClick={onAddToday}>
              <Zap className="mr-1.5 h-4 w-4" />
              سجّل اليوم
            </Button>
          )}

          {todaysEntry && gap > 0 && (
            <div className="w-full md:w-56">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">فاضل للهدف</span>
                <span className="font-semibold text-primary">{formatEGP(gap)}</span>
              </div>
              <Progress value={pct} className="h-2" />
            </div>
          )}

          {todaysEntry && todayEarned >= target && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--success)]/15 px-3 py-1 text-xs font-medium text-[color:var(--success)]">
              <Trophy className="h-3.5 w-3.5" />
              هدف اليوم تحقق
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getMessages({
  todayEarned,
  target,
  gap,
  currentStreak,
  difference,
  daysRemaining,
  todaysEntry,
}: {
  todayEarned: number;
  target: number;
  gap: number;
  currentStreak: number;
  difference: number;
  daysRemaining: number;
  todaysEntry?: DailyEntry;
}) {
  if (!todaysEntry) {
    if (currentStreak > 0) {
      return {
        title: "متكسرش السلسلة!",
        body: `عندك ${currentStreak} أيام متتابعة. سجّل النهارده عشان تفضلها شغالة.`,
        tone: "warning" as const,
      };
    }
    if (difference < 0 && daysRemaining > 0) {
      return {
        title: "النهارده فرصتك تلحق",
        body: `متأخر بـ ${formatEGP(Math.abs(difference))}. سجّل يومك وابدأ العودة.`,
        tone: "danger" as const,
      };
    }
    return {
      title: "ابدأ يومك بالإنجاز",
      body: "سجّل دخلك النهارده — كل يوم بيحسب.",
      tone: "info" as const,
    };
  }

  if (todayEarned >= target * 2) {
    return {
      title: "يوم خرافي!",
      body: `كسبت ${formatEGP(todayEarned)} — ضعف الهدف أو أكتر. كمّل التحفظ ده.`,
      tone: "success" as const,
    };
  }

  if (todayEarned >= target) {
    if (currentStreak > 2) {
      return {
        title: "هدف اليوم محقق",
        body: `وسلسلتك ${currentStreak} أيام. أنت في المود الصح.`,
        tone: "success" as const,
      };
    }
    return {
      title: "هدف اليوم محقق",
      body: "خطوة كويسة — كمّل بكرة على نفس الإيقاع.",
      tone: "success" as const,
    };
  }

  if (gap <= target * 0.3) {
    return {
      title: "قربت أوي",
      body: `فاضلك ${formatEGP(gap)} بس. شوية مجهود وتخلص الهدف.`,
      tone: "info" as const,
    };
  }

  if (todayEarned > 0) {
    return {
      title: "مشينا بس لسه في طريق",
      body: `فاضلك ${formatEGP(gap)} للهدف. حاول تزود شوية قبل ما ينتهي اليوم.`,
      tone: "warning" as const,
    };
  }

  return {
    title: "النهارده سجّلت صفر دخل",
    body: "مش مشكلة — بكرة يوم جديد، بس حاول تلحق وقتك المتبقي.",
    tone: "danger" as const,
  };
}

export { Target, TrendingUp, Flame, Trophy, Zap };
