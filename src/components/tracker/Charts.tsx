import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Category, DailyEntry, TrackerSettings } from "@/lib/tracker/types";
import { computeEntryTargetDeductions, entryNet, entryTargetNetUsing, entryTotalExpenses, makeCategoryMap } from "@/lib/tracker/analytics";

const COLORS = [
  "oklch(0.78 0.18 152)",
  "oklch(0.7 0.14 200)",
  "oklch(0.82 0.17 80)",
  "oklch(0.68 0.21 25)",
  "oklch(0.75 0.12 280)",
  "oklch(0.7 0.15 320)",
];

function tooltipStyle() {
  return {
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
}

function fmtDay(iso: string) {
  return iso.slice(5);
}

export function EarningsLine({ entries, categories = [] }: { entries: DailyEntry[]; categories?: Category[] }) {
  const catMap = useMemo(() => makeCategoryMap(categories), [categories]);
  const data = useMemo(
    () =>
      [...entries]
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map((e) => ({
          date: fmtDay(e.date),
          earnings: e.earnings,
          net: entryNet(e, catMap),
        })),
    [entries, catMap],
  );

  const t = tooltipStyle();

  if (data.length === 0) return <EmptyChart label="No data yet" />;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="earnings-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS[0]} stopOpacity={0.55} />
            <stop offset="100%" stopColor={COLORS[0]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: "oklch(0.7 0.012 240)", fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: "oklch(0.7 0.012 240)", fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
        <Tooltip {...t} />
        <Area
          type="monotone"
          dataKey="earnings"
          stroke={COLORS[0]}
          strokeWidth={2}
          fill="url(#earnings-grad)"
        />
        <Line type="monotone" dataKey="net" stroke={COLORS[1]} strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ExpensesBar({ entries }: { entries: DailyEntry[] }) {
  const data = useMemo(
    () =>
      [...entries]
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map((e) => ({ date: fmtDay(e.date), expenses: entryTotalExpenses(e) })),
    [entries],
  );

  const t = tooltipStyle();
  if (data.length === 0) return <EmptyChart label="No data yet" />;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: "oklch(0.7 0.012 240)", fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: "oklch(0.7 0.012 240)", fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
        <Tooltip {...t} />
        <Bar dataKey="expenses" fill={COLORS[3]} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ExpectedVsActual({
  entries,
  settings,
  categories = [],
}: {
  entries: DailyEntry[];
  settings: TrackerSettings;
  categories?: Category[];
}) {
  const catMap = useMemo(() => makeCategoryMap(categories), [categories]);
  const data = useMemo(() => {
    const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
    let cumulative = 0;
    return sorted.map((e, i) => {
      cumulative += entryTargetNet(e, catMap);
      return {
        date: fmtDay(e.date),
        actual: Math.round(cumulative),
        expected: (i + 1) * settings.dailyTarget,
      };
    });
  }, [entries, settings.dailyTarget, catMap]);

  const t = tooltipStyle();
  if (data.length === 0) return <EmptyChart label="No data yet" />;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid stroke="oklch(1 0 0 / 0.05)" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: "oklch(0.7 0.012 240)", fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: "oklch(0.7 0.012 240)", fontSize: 11 }} tickLine={false} axisLine={false} width={50} />
        <Tooltip {...t} />
        <Line type="monotone" dataKey="expected" stroke={COLORS[4]} strokeDasharray="4 4" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="actual" stroke={COLORS[0]} strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CategoryPie({ entries }: { entries: DailyEntry[] }) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      for (const x of e.expenses) {
        map.set(x.category, (map.get(x.category) ?? 0) + (Number(x.amount) || 0));
      }
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [entries]);

  const t = tooltipStyle();
  if (data.length === 0) return <EmptyChart label="No expenses yet" />;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Tooltip {...t} />
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="grid h-[200px] place-items-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
