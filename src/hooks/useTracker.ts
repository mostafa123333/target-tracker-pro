import { useCallback, useEffect, useState } from "react";
import type { DailyEntry, TrackerSettings } from "@/lib/tracker/types";
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
  const [categories, setCategories] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const d = loadAll();
    setSettings(d.settings);
    setEntries(d.entries);
    setCategories(d.categories);
    setHydrated(true);
  }, []);

  const updateSettings = useCallback((s: TrackerSettings) => {
    setSettings(s);
    saveSettings(s);
  }, []);

  const upsertEntry = useCallback((entry: DailyEntry) => {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === entry.id || e.date === entry.date);
      const next = idx >= 0 ? prev.map((e, i) => (i === idx ? entry : e)) : [...prev, entry];
      next.sort((a, b) => (a.date < b.date ? 1 : -1));
      saveEntries(next);
      return next;
    });
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      saveEntries(next);
      return next;
    });
  }, []);

  const addCategory = useCallback((name: string) => {
    const v = name.trim();
    if (!v) return;
    setCategories((prev) => {
      if (prev.includes(v)) return prev;
      const next = [...prev, v];
      saveCategories(next);
      return next;
    });
  }, []);

  const removeCategory = useCallback((name: string) => {
    setCategories((prev) => {
      const next = prev.filter((c) => c !== name);
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
    removeCategory,
    resetAll,
    restoreFromJson,
  };
}
