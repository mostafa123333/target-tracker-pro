import type { TrackerData, TrackerSettings, DailyEntry, Category } from "./types";

const KEYS = {
  settings: "tracker_settings",
  entries: "tracker_entries",
  categories: "tracker_categories",
} as const;

const DEFAULT_CATEGORIES: Category[] = [
  { name: "Food", deductsFromTarget: true },
  { name: "Transport", deductsFromTarget: true },
  { name: "Coffee", deductsFromTarget: true },
  { name: "Subscriptions", deductsFromTarget: true },
  { name: "Internet", deductsFromTarget: true },
  { name: "Tools", deductsFromTarget: true },
  { name: "Savings", deductsFromTarget: false, budget: 5000 },
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

function normalizeCategories(raw: unknown): Category[] {
  if (!Array.isArray(raw)) return DEFAULT_CATEGORIES;
  const out: Category[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      out.push({ name: item, deductsFromTarget: true });
    } else if (item && typeof item === "object" && typeof (item as Category).name === "string") {
      const c = item as Category;
      out.push({
        name: c.name,
        deductsFromTarget: c.deductsFromTarget !== false,
        budget: typeof c.budget === "number" && c.budget > 0 ? c.budget : undefined,
      });
    }
  }
  return out.length ? out : DEFAULT_CATEGORIES;
}

export function loadAll(): TrackerData {
  const rawCats = safeRead<unknown>(KEYS.categories, DEFAULT_CATEGORIES);
  return {
    settings: safeRead<TrackerSettings | null>(KEYS.settings, null),
    entries: safeRead<DailyEntry[]>(KEYS.entries, []),
    categories: normalizeCategories(rawCats),
  };
}

export function saveSettings(settings: TrackerSettings) {
  safeWrite(KEYS.settings, settings);
}

export function saveEntries(entries: DailyEntry[]) {
  safeWrite(KEYS.entries, entries);
}

export function saveCategories(categories: Category[]) {
  safeWrite(KEYS.categories, categories);
}

export function exportBackup(): string {
  return JSON.stringify(loadAll(), null, 2);
}

export function importBackup(json: string): TrackerData {
  const data = JSON.parse(json) as TrackerData;
  if (data.settings) saveSettings(data.settings);
  if (data.entries) saveEntries(data.entries);
  if (data.categories) saveCategories(normalizeCategories(data.categories));
  return {
    settings: data.settings ?? null,
    entries: data.entries ?? [],
    categories: normalizeCategories(data.categories),
  };
}

export function resetAll() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEYS.settings);
  localStorage.removeItem(KEYS.entries);
  localStorage.removeItem(KEYS.categories);
}

export { DEFAULT_CATEGORIES };
