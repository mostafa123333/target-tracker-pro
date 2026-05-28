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
import type { DailyEntry, Expense } from "@/lib/tracker/types";
import { entryNet, entryTotalExpenses, todayISO, formatEGP } from "@/lib/tracker/analytics";

function rid() {
  return Math.random().toString(36).slice(2, 10);
}

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: DailyEntry | null;
  categories: string[];
  onAddCategory: (name: string) => void;
  onSave: (entry: DailyEntry) => void;
};

export function DailyEntryDialog({
  open,
  onOpenChange,
  initial,
  categories,
  onAddCategory,
  onSave,
}: Props) {
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [earnings, setEarnings] = useState<string>(initial?.earnings.toString() ?? "");
  const [expenses, setExpenses] = useState<Expense[]>(initial?.expenses ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    if (open) {
      setDate(initial?.date ?? todayISO());
      setEarnings(initial?.earnings.toString() ?? "");
      setExpenses(initial?.expenses ?? []);
      setNotes(initial?.notes ?? "");
      setNewCategory("");
    }
  }, [open, initial]);

  const totalExp = useMemo(
    () => expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0),
    [expenses],
  );
  const net = (Number(earnings) || 0) - totalExp;

  function addExpense() {
    setExpenses((prev) => [
      ...prev,
      { id: rid(), category: categories[0] ?? "Other", amount: 0 },
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
    onAddCategory(v);
    setNewCategory("");
  }

  function handleSave() {
    const entry: DailyEntry = {
      id: initial?.id ?? rid(),
      date,
      earnings: Number(earnings) || 0,
      expenses: expenses.filter((e) => e.amount > 0 || e.category),
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
              {expenses.map((exp) => (
                <div key={exp.id} className="flex items-center gap-2">
                  <Select
                    value={exp.category}
                    onValueChange={(v) => updateExpense(exp.id, { category: v })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    inputMode="decimal"
                    className="w-28"
                    placeholder="0"
                    value={exp.amount || ""}
                    onChange={(e) =>
                      updateExpense(exp.id, { amount: Number(e.target.value) || 0 })
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
              ))}
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

          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Net</span>
            <span
              className={
                "stat-number text-base " +
                (net >= 0 ? "text-[color:var(--success)]" : "text-destructive")
              }
            >
              {formatEGP(net)}
            </span>
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
