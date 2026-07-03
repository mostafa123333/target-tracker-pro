import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Upload, RotateCcw, Trash2, Plus, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTracker } from "@/hooks/useTracker";
import { OnboardingDialog } from "@/components/tracker/OnboardingDialog";
import { exportBackup } from "@/lib/tracker/storage";
import { entriesToCsv, downloadCsv } from "@/lib/tracker/csvExport";
import { computeAnalytics, formatEGP } from "@/lib/tracker/analytics";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — 105 Day Target Tracker" },
      { name: "description", content: "Manage your goal, categories, and data." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const {
    hydrated,
    settings,
    entries,
    categories,
    updateSettings,
    addCategory,
    updateCategory,
    removeCategory,
    resetAll,
    restoreFromJson,
  } = useTracker();

  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [newDeducts, setNewDeducts] = useState(true);
  const [newBudget, setNewBudget] = useState<string>("");
  const [target, setTarget] = useState<number>(settings?.dailyTarget ?? 220);
  const [totalDays, setTotalDays] = useState<number>(settings?.totalDays ?? 105);
  const [startDate, setStartDate] = useState<string>(settings?.startDate ?? "");

  const analytics = useMemo(
    () => (settings ? computeAnalytics(entries, settings, categories) : null),
    [entries, settings, categories],
  );

  if (!hydrated) return <div className="h-40 animate-pulse rounded-2xl bg-muted/40" />;
  if (!settings) return <OnboardingDialog open onComplete={updateSettings} />;

  function handleBackup() {
    const data = exportBackup();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded");
  }

  function handleRestoreFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        restoreFromJson(reader.result as string);
        toast.success("Data restored");
      } catch {
        toast.error("Invalid backup file");
      }
    };
    reader.readAsText(file);
  }

  function saveGoal() {
    updateSettings({
      startDate: startDate || settings!.startDate,
      dailyTarget: Number(target) || 220,
      totalDays: Number(totalDays) || 105,
    });
    toast.success("Goal updated");
  }

  function handleAddCat() {
    const v = newCat.trim();
    if (!v) return;
    const budget = Number(newBudget) > 0 ? Number(newBudget) : undefined;
    addCategory(v, newDeducts, budget);
    setNewCat("");
    setNewBudget("");
    setNewDeducts(true);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Settings</h1>
        <p className="text-sm text-muted-foreground">Tweak your goal, categories, and data.</p>
      </div>

      <section className="glass-card p-5">
        <h2 className="mb-4 text-base font-semibold">Goal</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="start">Start date</Label>
            <Input id="start" type="date" value={startDate || settings.startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="t">Daily target (EGP)</Label>
            <Input id="t" type="number" value={target} onChange={(e) => setTarget(Number(e.target.value))} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="d">Total days</Label>
            <Input id="d" type="number" value={totalDays} onChange={(e) => setTotalDays(Number(e.target.value))} />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={saveGoal}>Save goal</Button>
        </div>
      </section>

      <section className="glass-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Expense categories</h2>
            <p className="text-xs text-muted-foreground">
              Toggle whether a category deducts from the daily target. For
              non-target categories, the budget acts as a spending cap — you can
              spend freely up to it, and only the overflow starts deducting from
              the target. All expenses still reduce your net profit.
            </p>

          </div>
        </div>

        <div className="mb-4 space-y-2">
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground">No categories yet.</p>
          )}
          {categories.map((c) => {
            const stat = analytics?.categoryStats.find((s) => s.name === c.name);
            return (
              <div
                key={c.name}
                className="rounded-xl border border-border/60 bg-muted/20 p-3"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-[120px] flex-1">
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {c.deductsFromTarget ? "Deducts from target" : "Excluded from target"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label htmlFor={`d-${c.name}`} className="text-xs text-muted-foreground">
                      Deducts
                    </Label>
                    <Switch
                      id={`d-${c.name}`}
                      checked={c.deductsFromTarget}
                      onCheckedChange={(v) => updateCategory(c.name, { deductsFromTarget: v })}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Label htmlFor={`b-${c.name}`} className="text-xs text-muted-foreground">
                      Budget
                    </Label>
                    <Input
                      id={`b-${c.name}`}
                      type="number"
                      placeholder="—"
                      className="h-8 w-24"
                      value={c.budget ?? ""}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        updateCategory(c.name, {
                          budget: n > 0 ? n : undefined,
                        });
                      }}
                    />
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCategory(c.name)}
                    aria-label={`Remove ${c.name}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                {stat?.budget !== undefined && (
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {formatEGP(stat.spent)} of {formatEGP(stat.budget)}
                      </span>
                      <span className="stat-number text-foreground">
                        {(stat.pct ?? 0).toFixed(0)}% · {formatEGP(stat.remaining ?? 0)} left
                      </span>
                    </div>
                    <Progress value={stat.pct ?? 0} className="h-1.5" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="grid gap-2 rounded-xl border border-dashed border-border/60 p-3">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Add a category
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Name"
              value={newCat}
              className="min-w-[140px] flex-1"
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCat();
                }
              }}
            />
            <Input
              type="number"
              placeholder="Budget (optional)"
              className="w-40"
              value={newBudget}
              onChange={(e) => setNewBudget(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <Switch id="new-deducts" checked={newDeducts} onCheckedChange={setNewDeducts} />
              <Label htmlFor="new-deducts" className="text-xs text-muted-foreground">
                Deducts from target
              </Label>
            </div>
            <Button onClick={handleAddCat}>
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </div>
        </div>
      </section>

      <section className="glass-card p-5">
        <h2 className="mb-4 text-base font-semibold">Data</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleBackup}>
            <Download className="mr-1.5 h-4 w-4" /> Backup (JSON)
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              if (!entries.length) {
                toast.error("No entries to export");
                return;
              }
              const csv = entriesToCsv(entries, categories);
              downloadCsv(`tracker-entries-${new Date().toISOString().slice(0, 10)}.csv`, csv);
              toast.success("CSV downloaded");
            }}
          >
            <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Export CSV
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1.5 h-4 w-4" /> Restore
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleRestoreFile(f);
              e.target.value = "";
            }}
          />
          <Button variant="destructive" onClick={() => setConfirmReset(true)}>
            <RotateCcw className="mr-1.5 h-4 w-4" /> Reset everything
          </Button>
        </div>
      </section>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all data?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your settings, entries, and categories. You'll start fresh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                resetAll();
                toast.success("All data cleared");
              }}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
