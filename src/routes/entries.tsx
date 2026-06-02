import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTracker } from "@/hooks/useTracker";
import { OnboardingDialog } from "@/components/tracker/OnboardingDialog";
import { DailyEntryDialog } from "@/components/tracker/DailyEntryDialog";
import { EntriesTable } from "@/components/tracker/EntriesTable";
import type { DailyEntry } from "@/lib/tracker/types";

export const Route = createFileRoute("/entries")({
  head: () => ({
    meta: [
      { title: "Entries — Target Tracker" },
      { name: "description", content: "Every logged day, sortable and filterable." },
    ],
  }),
  component: EntriesPage,
});

function EntriesPage() {
  const {
    hydrated,
    settings,
    entries,
    categories,
    updateSettings,
    upsertEntry,
    deleteEntry,
    addCategory,
  } = useTracker();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DailyEntry | null>(null);

  if (!hydrated) return <div className="h-40 animate-pulse rounded-2xl bg-muted/40" />;
  if (!settings) return <OnboardingDialog open onComplete={updateSettings} />;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">All entries</h1>
          <p className="text-sm text-muted-foreground">
            {entries.length} day{entries.length === 1 ? "" : "s"} logged
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Add day
        </Button>
      </div>

      <EntriesTable
        entries={entries}
        settings={settings}
        categories={categories}
        onEdit={(e) => {
          setEditing(e);
          setOpen(true);
        }}
        onDelete={(id) => {
          deleteEntry(id);
          toast.success("Entry deleted");
        }}
      />

      <DailyEntryDialog
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        categories={categories}
        onAddCategory={addCategory}
        onSave={(e) => {
          upsertEntry(e);
          toast.success("Day saved");
        }}
      />
    </div>
  );
}
