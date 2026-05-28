import type { TrackerData, TrackerSettings, DailyEntry } from "./types";

const KEYS = {
  settings: "tracker_settings",
  entries: "tracker_entries",
  categories: "tracker_categories",
} as const;

const DEFAULT_CATEGORIES = [
  "Food",
  "Transport",
  "Coffee",
  "Subscriptions",
  "Internet",
  "Tools",
];

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function loadAll(): TrackerData {
  return {
    settings: safeRead<TrackerSettings | null>(KEYS.settings, null),
    entries: safeRead<DailyEntry[]>(KEYS.entries, []),
    categories: safeRead<string[]>(KEYS.categories, DEFAULT_CATEGORIES),
  };
}

export function saveSettings(settings: TrackerSettings) {
  safeWrite(KEYS.settings, settings);
}

export function saveEntries(entries: DailyEntry[]) {
  safeWrite(KEYS.entries, entries);
}

export function saveCategories(categories: string[]) {
  safeWrite(KEYS.categories, categories);
}

export function exportBackup(): string {
  return JSON.stringify(loadAll(), null, 2);
}

export function importBackup(json: string): TrackerData {
  const data = JSON.parse(json) as TrackerData;
  if (data.settings) saveSettings(data.settings);
  if (data.entries) saveEntries(data.entries);
  if (data.categories) saveCategories(data.categories);
  return data;
}

export function resetAll() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEYS.settings);
  localStorage.removeItem(KEYS.entries);
  localStorage.removeItem(KEYS.categories);
}

export { DEFAULT_CATEGORIES };
