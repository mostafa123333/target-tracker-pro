import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import type { Category, DailyEntry, Expense } from "@/lib/tracker/types";
import {
  computeEntryTargetDeductions,
  entryDeductibleExpenses,
  entryNet,
  entryNonDeductibleExpenses,
  entryTargetNetUsing,
  entryTotalExpenses,
  formatEGP,
  makeCategoryMap,
  todayISO,
} from "@/lib/tracker/analytics";

function rid() {
  return Math.random().toString(36).slice(2, 10);
}

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: DailyEntry | null;
  categories: Category[];
  entries?: DailyEntry[];
  onAddCategory: (name: string, deductsFromTarget?: boolean) => void;
  onSave: (entry: DailyEntry) => boolean | void;
};

export function DailyEntryDialog({
  open,
  onOpenChange,
  initial,
  categories,
  entries = [],
  onAddCategory,
  onSave,
}: Props) {
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [earnings, setEarnings] = useState<string>(initial?.earnings.toString() ?? "");
  const [expenses, setExpenses] = useState<Expense[]>(initial?.expenses ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [newCategory, setNewCategory] = useState("");
  // Per-expense input buffer so users can type "-", "12.", etc. without losing chars.
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});

  const catMap = useMemo(() => makeCategoryMap(categories), [categories]);

  useEffect(() => {
    if (open) {
      setDate(initial?.date ?? todayISO());
      setEarnings(initial?.earnings.toString() ?? "");
      setExpenses(initial?.expenses ?? []);
      setNotes(initial?.notes ?? "");
      setNewCategory("");
      setAmountDrafts({});
    }
  }, [open, initial]);

  const draftEntry: DailyEntry = {
    id: initial?.id ?? "draft",
    date,
    earnings: Number(earnings) || 0,
    expenses,
  };
  const totalExp = entryTotalExpenses(draftEntry);
  const deductible = entryDeductibleExpenses(draftEntry, catMap);
  const nonDeductible = entryNonDeductibleExpenses(draftEntry, catMap);
  // Cap-aware target net: combine the draft with all OTHER entries so we capture
  // overflow when a capped non-deductible category exceeds its budget.
  const deductionsMap = useMemo(() => {
    const others = entries.filter((e) => e.id !== draftEntry.id);
    return computeEntryTargetDeductions([...others, draftEntry], catMap);
  }, [entries, draftEntry, catMap]);
  const net = entryTargetNetUsing(draftEntry, deductionsMap);

  function addExpense() {
    setExpenses((prev) => [
      ...prev,
      { id: rid(), category: categories[0]?.name ?? "Other", amount: 0 },
    ]);
  }

  // Top recurring expense presets from history: (category, amount) pairs by frequency.
  const presets = useMemo(() => {
    const counts = new Map<string, { category: string; amount: number; count: number }>();
    for (const e of entries) {
      if (e.id === initial?.id) continue;
      for (const x of e.expenses) {
        const amt = Math.round(Number(x.amount) || 0);
        if (amt <= 0) continue;
        const key = `${x.category}__${amt}`;
        const prev = counts.get(key);
        if (prev) prev.count++;
        else counts.set(key, { category: x.category, amount: amt, count: 1 });
      }
    }
    return [...counts.values()]
      .filter((p) => p.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [entries, initial?.id]);

  function applyPreset(p: { category: string; amount: number }) {
    setExpenses((prev) => [
      ...prev,
      { id: rid(), category: p.category, amount: p.amount },
    ]);
  }

  function updateExpense(id: string, patch: Partial<Expense>) {
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function removeExpense(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  function handleAddCategory() {
    const v = newCategory.trim();
    if (!v) return;
    onAddCategory(v, true);
    setNewCategory("");
  }

  function handleSave() {
    const entry: DailyEntry = {
      id: initial?.id ?? rid(),
      date,
      earnings: Number(earnings) || 0,
      expenses: expenses.filter((e) => Number(e.amount) !== 0 && e.category),
      notes: notes.trim() || undefined,
    };
    const result = onSave(entry);
    if (result !== false) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit day" : "Add day"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="earnings">Earnings (EGP)</Label>
              <Input
                id="earnings"
                type="number"
                inputMode="decimal"
                placeholder="0"
                autoFocus
                className="h-11 text-lg"
                value={earnings}
                onChange={(e) => setEarnings(e.target.value)}
              />
            </div>
          </div>

          {/* Quick earnings chips — one tap instead of typing */}
          <div className="flex flex-wrap gap-1.5">
            {[100, 220, 300, 500].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() =>
                  setEarnings(String((Number(earnings) || 0) + amt))
                }
                className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-primary/10"
              >
                +{amt}
              </button>
            ))}
            {earnings !== "" && (
              <button
                type="button"
                onClick={() => setEarnings("")}
                className="rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground"
              >
                Clear
              </button>
            )}
          </div>


          {(() => {
            const conflict = entries.find((e) => e.date === date && e.id !== (initial?.id ?? "draft"));
            if (!conflict) return null;
            return (
              <div className="rounded-md border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 px-3 py-2 text-xs text-[color:var(--warning)]">
                ⚠ في إنتري تاني محفوظ في {date}. الحفظ هيرفض التعديل — غيّر التاريخ أو احذف القديم.
              </div>
            );
          })()}

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Expenses</Label>
              <Button type="button" size="sm" variant="secondary" onClick={addExpense}>
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>

            {presets.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {presets.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-primary/10 hover:border-primary/40"
                  >
                    <Plus className="h-3 w-3 text-primary" />
                    <span>{p.category}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="stat-number">{formatEGP(p.amount)}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {expenses.length === 0 && (
                <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                  No expenses yet
                </p>
              )}
              {expenses.map((exp) => {
                const cat = catMap.get(exp.category);
                const deducts = cat ? cat.deductsFromTarget !== false : true;
                return (
                  <div key={exp.id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Select
                        value={exp.category}
                        onValueChange={(v) => updateExpense(exp.id, { category: v })}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.name} value={c.name}>
                              <span className="flex items-center gap-2">
                                {c.name}
                                {!c.deductsFromTarget && (
                                  <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                                    no target
                                  </span>
                                )}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="text"
                        inputMode="decimal"
                        className="w-28"
                        placeholder="0"
                        value={amountDrafts[exp.id] ?? (exp.amount === 0 ? "" : String(exp.amount))}
                        onChange={(e) => {
                          const raw = e.target.value.replace(",", ".");
                          if (raw === "" || /^-?\d*\.?\d*$/.test(raw)) {
                            setAmountDrafts((d) => ({ ...d, [exp.id]: raw }));
                            const n = raw === "" || raw === "-" || raw === "." || raw === "-." ? 0 : Number(raw);
                            if (Number.isFinite(n)) updateExpense(exp.id, { amount: n });
                          }
                        }}
                        onBlur={() =>
                          setAmountDrafts((d) => {
                            const { [exp.id]: _drop, ...rest } = d;
                            return rest;
                          })
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeExpense(exp.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    {!deducts ? (
                      cat?.budget && cat.budget > 0 ? (
                        <p className="pl-1 text-[11px] text-muted-foreground">
                          Capped category — free to spend up to {formatEGP(cat.budget)}; anything above deducts from the target.
                        </p>
                      ) : (
                        <p className="pl-1 text-[11px] text-muted-foreground">
                          Savings jar — positive = deposit, negative = withdrawal
                        </p>
                      )
                    ) : (
                      exp.amount < 0 && (
                        <p className="pl-1 text-[11px] text-muted-foreground">
                          Negative amount (refund / reversal)
                        </p>
                      )
                    )}

                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Input
                placeholder="New category"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCategory();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={handleAddCategory}>
                Add category
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder="How was the day?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="space-y-1 rounded-lg bg-muted/40 px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Target net</span>
              <span
                className={
                  "stat-number text-base " +
                  (net >= 0 ? "text-[color:var(--success)]" : "text-destructive")
                }
              >
                {formatEGP(net)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {formatEGP(deductible)} deducted
                {nonDeductible > 0 && ` · ${formatEGP(nonDeductible)} excluded`}
              </span>
              <span>Total spent {formatEGP(totalExp)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save day</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// re-export helpers used elsewhere
export { entryNet, entryTotalExpenses };
