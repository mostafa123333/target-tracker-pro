import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Category, DailyEntry, TrackerSettings } from "@/lib/tracker/types";
import {
  loadAll,
  saveCategories,
  saveEntries,
  saveSettings,
  resetAll as resetStorage,
  importBackup,
} from "@/lib/tracker/storage";

export function useTracker() {
  const [settings, setSettings] = useState<TrackerSettings | null>(null);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const refresh = () => {
      const d = loadAll();
      setSettings(d.settings);
      setEntries(d.entries);
      setCategories(d.categories);
      setHydrated(true);
    };
    refresh();
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("storage", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("storage", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const updateSettings = useCallback((s: TrackerSettings) => {
    setSettings(s);
    saveSettings(s);
  }, []);

  const upsertEntry = useCallback((entry: DailyEntry): boolean => {
    let ok = true;
    setEntries((prev) => {
      const byId = prev.findIndex((e) => e.id === entry.id);
      // If we're editing an existing entry, only collapse on date when it's the same row.
      if (byId >= 0) {
        const collision = prev.find((e) => e.date === entry.date && e.id !== entry.id);
        if (collision) {
          ok = false;
          toast.error(`في إنتري تاني محفوظ بتاريخ ${entry.date} — غيّر التاريخ أو احذف القديم الأول.`);
          return prev;
        }
        const next = prev.map((e, i) => (i === byId ? entry : e));
        next.sort((a, b) => (a.date < b.date ? 1 : -1));
        saveEntries(next);
        return next;
      }
      // New entry: if date already has one, replace it (classic "add today" upsert).
      const byDate = prev.findIndex((e) => e.date === entry.date);
      const next =
        byDate >= 0
          ? prev.map((e, i) => (i === byDate ? { ...entry, id: prev[byDate].id } : e))
          : [...prev, entry];
      next.sort((a, b) => (a.date < b.date ? 1 : -1));
      saveEntries(next);
      return next;
    });
    return ok;
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      saveEntries(next);
      return next;
    });
  }, []);

  const addCategory = useCallback(
    (name: string, deductsFromTarget = true, budget?: number) => {
      const v = name.trim();
      if (!v) return;
      setCategories((prev) => {
        if (prev.some((c) => c.name.toLowerCase() === v.toLowerCase())) return prev;
        const next: Category[] = [...prev, { name: v, deductsFromTarget, budget }];
        saveCategories(next);
        return next;
      });
    },
    [],
  );

  const updateCategory = useCallback((name: string, patch: Partial<Category>) => {
    setCategories((prev) => {
      const next = prev.map((c) => (c.name === name ? { ...c, ...patch } : c));
      saveCategories(next);
      return next;
    });
  }, []);

  const removeCategory = useCallback((name: string) => {
    setCategories((prev) => {
      const next = prev.filter((c) => c.name !== name);
      saveCategories(next);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    resetStorage();
    setSettings(null);
    setEntries([]);
    setCategories([]);
  }, []);

  const restoreFromJson = useCallback((json: string) => {
    const data = importBackup(json);
    setSettings(data.settings);
    setEntries(data.entries ?? []);
    setCategories(data.categories ?? []);
  }, []);

  return {
    hydrated,
    settings,
    entries,
    categories,
    updateSettings,
    upsertEntry,
    deleteEntry,
    addCategory,
    updateCategory,
    removeCategory,
    resetAll,
    restoreFromJson,
  };
}
