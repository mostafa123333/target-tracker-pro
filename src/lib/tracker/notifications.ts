/**
 * Persisted "already notified" state so celebration toasts fire exactly once,
 * even across reloads, new sessions, or new days.
 */
const ACH_KEY = "tracker_seen_achievements_v1";
const TARGET_DAY_KEY = "tracker_seen_target_day_v1";

function stores(): Storage[] {
  if (typeof window === "undefined") return [];
  return [window.localStorage, window.sessionStorage].filter(Boolean);
}

function read(key: string): string | null {
  for (const s of stores()) {
    try {
      const v = s.getItem(key);
      if (v) return v;
    } catch {
      // try next storage area
    }
  }
  return null;
}

function write(key: string, value: string) {
  for (const s of stores()) {
    try {
      s.setItem(key, value);
    } catch {
      // Safari private mode can reject one area; keep the other.
    }
  }
}

export function readSeenAchievements(): string[] {
  const raw = read(ACH_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function writeSeenAchievements(ids: string[]) {
  write(ACH_KEY, JSON.stringify(ids));
}

export function readSeenTargetDay(): string | null {
  return read(TARGET_DAY_KEY);
}

export function writeSeenTargetDay(iso: string) {
  write(TARGET_DAY_KEY, iso);
}

/** True once we've stored notification state at least once on this device. */
export function hasNotificationRecord(): boolean {
  return read(ACH_KEY) !== null || read(TARGET_DAY_KEY) !== null;
}
