import type { TrackerData, TrackerSettings, DailyEntry, Category } from "./types";

const KEYS = {
  snapshot: "tracker_data_v2",
  snapshotBackup: "tracker_data_v2_backup",
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

function readFromStorage<T>(storage: Storage, key: string, fallback: T): T {
  const raw = storage.getItem(key);
  if (!raw) return fallback;
  return JSON.parse(raw) as T;
}

function getStores(): Storage[] {
  if (typeof window === "undefined") return [];
  return [window.localStorage, window.sessionStorage].filter(Boolean);
}

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  for (const storage of getStores()) {
    try {
      return readFromStorage(storage, key, fallback);
    } catch {
      // Try the next storage area before falling back.
    }
  }
  return fallback;
}

function safeWrite(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(value);
  for (const storage of getStores()) {
    try {
      storage.setItem(key, serialized);
    } catch {
      // Safari can reject one storage area; keep the other as a fallback.
    }
  }
}

function safeRemove(key: string) {
  if (typeof window === "undefined") return;
  for (const storage of getStores()) {
    try {
      storage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

function normalizeData(data: Partial<TrackerData> | null | undefined): TrackerData {
  let settings = data?.settings ?? null;
  if (settings && settings.totalDays === 90) settings = { ...settings, totalDays: 105 };
  return {
    settings,
    entries: Array.isArray(data?.entries) ? data.entries : [],
    categories: normalizeCategories(data?.categories),
  };
}

function readSnapshot(): TrackerData | null {
  if (typeof window === "undefined") return null;
  for (const storage of getStores()) {
    for (const key of [KEYS.snapshot, KEYS.snapshotBackup]) {
      try {
        const data = readFromStorage<Partial<TrackerData> | null>(storage, key, null);
        if (data) return normalizeData(data);
      } catch {
        // Corrupt/truncated JSON: try backup and then legacy keys.
      }
    }
  }
  return null;
}

function readLegacyData(): TrackerData {
  const rawCats = safeRead<unknown>(KEYS.categories, DEFAULT_CATEGORIES);
  const settings = safeRead<TrackerSettings | null>(KEYS.settings, null);
  return normalizeData({
    settings,
    entries: safeRead<DailyEntry[]>(KEYS.entries, []),
    categories: normalizeCategories(rawCats),
  });
}

function persistAll(data: TrackerData) {
  const normalized = normalizeData(data);
  safeWrite(KEYS.snapshotBackup, normalized);
  safeWrite(KEYS.snapshot, normalized);
  // Keep legacy keys in sync so old backups/imports and existing UI keep working.
  safeWrite(KEYS.settings, normalized.settings);
  safeWrite(KEYS.entries, normalized.entries);
  safeWrite(KEYS.categories, normalized.categories);
}

function updateStoredData(patch: Partial<TrackerData>) {
  const current = loadAll();
  persistAll({ ...current, ...patch });
}

function hasLegacyData(): boolean {
  try {
    return Boolean(
      localStorage.getItem(KEYS.settings) ||
        localStorage.getItem(KEYS.entries) ||
        localStorage.getItem(KEYS.categories),
    );
  } catch {
    return false;
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
  const data = readSnapshot() ?? readLegacyData();
  if (!readSnapshot() || data.settings?.totalDays === 105 || hasLegacyData()) persistAll(data);
  return data;
}

export function saveSettings(settings: TrackerSettings) {
  updateStoredData({ settings });
}

export function saveEntries(entries: DailyEntry[]) {
  updateStoredData({ entries });
}

export function saveCategories(categories: Category[]) {
  updateStoredData({ categories: normalizeCategories(categories) });
}

export function exportBackup(): string {
  return JSON.stringify(loadAll(), null, 2);
}

export function importBackup(json: string): TrackerData {
  const data = JSON.parse(json) as TrackerData;
  const normalized = normalizeData(data);
  persistAll(normalized);
  return normalized;
}

export function resetAll() {
  if (typeof window === "undefined") return;
  safeRemove(KEYS.snapshot);
  safeRemove(KEYS.snapshotBackup);
  safeRemove(KEYS.settings);
  safeRemove(KEYS.entries);
  safeRemove(KEYS.categories);
}

export { DEFAULT_CATEGORIES };
