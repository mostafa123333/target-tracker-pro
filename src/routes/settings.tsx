import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Upload, RotateCcw, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — 90 Day Target Tracker" },
      { name: "description", content: "Manage your goal, categories, and data." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const {
    hydrated,
    settings,
    categories,
    updateSettings,
    addCategory,
    removeCategory,
    resetAll,
    restoreFromJson,
  } = useTracker();

  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [target, setTarget] = useState<number>(settings?.dailyTarget ?? 220);
  const [totalDays, setTotalDays] = useState<number>(settings?.totalDays ?? 90);
  const [startDate, setStartDate] = useState<string>(settings?.startDate ?? "");

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
      totalDays: Number(totalDays) || 90,
    });
    toast.success("Goal updated");
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
        <h2 className="mb-4 text-base font-semibold">Expense categories</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground">No categories yet.</p>
          )}
          {categories.map((c) => (
            <Badge
              key={c}
              className="group cursor-pointer gap-1 border border-border bg-muted/40 px-3 py-1 text-foreground hover:bg-destructive/15"
              onClick={() => removeCategory(c)}
            >
              {c}
              <Trash2 className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add a category"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (newCat.trim()) {
                  addCategory(newCat);
                  setNewCat("");
                }
              }
            }}
          />
          <Button
            onClick={() => {
              if (!newCat.trim()) return;
              addCategory(newCat);
              setNewCat("");
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
      </section>

      <section className="glass-card p-5">
        <h2 className="mb-4 text-base font-semibold">Data</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleBackup}>
            <Download className="mr-1.5 h-4 w-4" /> Backup
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
