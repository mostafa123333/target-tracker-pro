import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type Props = {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "destructive" | "primary";
  className?: string;
};

const toneClasses: Record<NonNullable<Props["tone"]>, string> = {
  default: "text-foreground",
  success: "text-[color:var(--success)]",
  warning: "text-[color:var(--warning)]",
  destructive: "text-destructive",
  primary: "text-primary",
};

export function StatCard({ label, value, hint, icon: Icon, tone = "default", className }: Props) {
  return (
    <div className={cn("glass-card relative overflow-hidden p-5 animate-count-up", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        {Icon && (
          <div className={cn("rounded-lg bg-muted/60 p-2", toneClasses[tone])}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className={cn("stat-number mt-3 text-2xl md:text-3xl", toneClasses[tone])}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
