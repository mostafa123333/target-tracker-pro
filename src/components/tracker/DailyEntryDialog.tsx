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
  onSave: (entry: DailyEntry) => void;
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
  const net = entryNet(draftEntry, catMap);

  function addExpense() {
    setExpenses((prev) => [
      ...prev,
      { id: rid(), category: categories[0]?.name ?? "Other", amount: 0 },
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
    onSave(entry);
    onOpenChange(false);
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
                value={earnings}
                onChange={(e) => setEarnings(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Expenses</Label>
              <Button type="button" size="sm" variant="secondary" onClick={addExpense}>
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>

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
                      <p className="pl-1 text-[11px] text-muted-foreground">
                        Savings category — positive = deposit, negative = withdrawal
                      </p>
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
