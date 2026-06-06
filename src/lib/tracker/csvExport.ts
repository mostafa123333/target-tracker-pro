import type { Category, DailyEntry } from "./types";
import { computeEntryTargetDeductions, entryNet, entryTargetNetUsing, entryTotalExpenses, makeCategoryMap } from "./analytics";

function csvEscape(v: string | number | undefined | null): string {
  const s = v === undefined || v === null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function entriesToCsv(entries: DailyEntry[], categories: Category[]): string {
  const map = makeCategoryMap(categories);
  const ded = computeEntryTargetDeductions(entries, map);
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? 1 : -1));
  const header = [
    "date",
    "earnings",
    "total_expenses",
    "target_net",
    "real_net",
    "notes",
    "expenses_breakdown",
  ].join(",");
  const lines = sorted.map((e) => {
    const breakdown = e.expenses
      .map((x) => `${x.category}:${x.amount}`)
      .join(" | ");
    return [
      csvEscape(e.date),
      csvEscape(e.earnings),
      csvEscape(entryTotalExpenses(e)),
      csvEscape(entryTargetNetUsing(e, ded)),
      csvEscape(entryNet(e, map)),
      csvEscape(e.notes ?? ""),
      csvEscape(breakdown),
    ].join(",");
  });
  return [header, ...lines].join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  // Prepend BOM so Excel opens UTF-8 correctly (Arabic notes/categories).
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
