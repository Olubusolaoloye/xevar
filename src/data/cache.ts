/**
 * Stale-while-revalidate cache for market requests.
 *
 * A screener polls the same endpoints continuously, and public APIs rate-limit.
 * This keeps the last good response for every key and serves it while a refresh
 * is in flight, so a slow request, a 429, or a few seconds of lost connectivity
 * never empties the board — the UI keeps the previous numbers and reports that
 * they are stale rather than blanking or, worse, presenting stale data as live.
 */

interface Entry<T> {
  /**
   * Present only once a load has succeeded. `hasValue` distinguishes "not
   * loaded yet" from "loaded a value that happens to be undefined".
   */
  hasValue: boolean;
  value?: T;
  /** When the value was written. */
  storedAt: number;
  /** In-flight refresh, so concurrent callers share one request. */
  inflight?: Promise<T>;
}

export interface CacheOptions {
  /** Below this age the cached value is returned without any network call. */
  freshMs?: number;
  /**
   * Above this age the value is considered unusable and a failed refresh
   * surfaces as an error instead of returning it.
   */
  maxStaleMs?: number;
  /**
   * Keep this key across reloads, in localStorage.
   *
   * Off by default, and deliberately opt-in. An in-memory cache only helps
   * within one page view: open a token, lose the provider, reload, and there
   * is nothing left to fall back on — which is why a failing chart showed an
   * error on every single load rather than the series it had drawn a minute
   * earlier.
   *
   * Only worth it for values that are still meaningful when old. Price history
   * is; a live trade feed is not, and is left in memory.
   */
  persist?: boolean;
}

const DEFAULTS: Required<CacheOptions> = {
  freshMs: 15_000,
  maxStaleMs: 5 * 60_000,
  persist: false,
};

const PERSIST_PREFIX = 'panscreener.cache.';
/** Beyond this, a persisted value is dropped rather than offered. */
const PERSIST_MAX_AGE_MS = 24 * 60 * 60_000;
/** Ceiling on persisted keys, so a long session cannot fill the origin's quota. */
const PERSIST_MAX_KEYS = 120;

/**
 * Every localStorage access here is wrapped.
 *
 * It throws outright in a private window and when the quota is full, and a
 * cache that cannot write is not a reason for a chart to stop rendering.
 */
function readPersisted<T>(key: string): Entry<T> | undefined {
  try {
    const raw = localStorage.getItem(PERSIST_PREFIX + key);
    if (!raw) return undefined;

    const parsed = JSON.parse(raw) as { value: T; storedAt: number };
    if (typeof parsed?.storedAt !== 'number') return undefined;
    if (Date.now() - parsed.storedAt > PERSIST_MAX_AGE_MS) {
      localStorage.removeItem(PERSIST_PREFIX + key);
      return undefined;
    }
    return { hasValue: true, value: parsed.value, storedAt: parsed.storedAt };
  } catch {
    return undefined;
  }
}

function writePersisted<T>(key: string, value: T, storedAt: number): void {
  try {
    localStorage.setItem(PERSIST_PREFIX + key, JSON.stringify({ value, storedAt }));
    evictPersisted();
  } catch {
    // Most likely the quota. Drop what we own and let the next write try
    // again on a clean slate rather than failing forever.
    try {
      clearPersisted();
      localStorage.setItem(PERSIST_PREFIX + key, JSON.stringify({ value, storedAt }));
    } catch {
      // Storage is unavailable entirely. The in-memory cache still works.
    }
  }
}

/** Trim to the newest `PERSIST_MAX_KEYS` entries. */
function evictPersisted(): void {
  try {
    const owned: Array<{ key: string; storedAt: number }> = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith(PERSIST_PREFIX)) continue;
      let storedAt = 0;
      try {
        storedAt = (JSON.parse(localStorage.getItem(key) ?? '{}') as { storedAt?: number })
          .storedAt ?? 0;
      } catch {
        storedAt = 0; // Unparseable: treat as oldest so it goes first.
      }
      owned.push({ key, storedAt });
    }

    if (owned.length <= PERSIST_MAX_KEYS) return;
    owned
      .sort((a, b) => a.storedAt - b.storedAt)
      .slice(0, owned.length - PERSIST_MAX_KEYS)
      .forEach((entry) => localStorage.removeItem(entry.key));
  } catch {
    // Nothing to do; the cap is a courtesy, not a correctness requirement.
  }
}

function clearPersisted(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(PERSIST_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignored, as above.
  }
}

export interface CacheResult<T> {
  value: T;
  /** True when the value came from cache because the network failed. */
  stale: boolean;
  /** Age of the returned value in milliseconds. */
  ageMs: number;
}

const store = new Map<string, Entry<unknown>>();

/**
 * Fetch through the cache.
 *
 * - Fresh value → returned immediately, no request.
 * - Stale value → a refresh is attempted; if it fails, the stale value is
 *   returned with `stale: true` rather than throwing.
 * - No value → the request must succeed, or the error propagates.
 */
export async function cached<T>(
  key: string,
  loader: () => Promise<T>,
  options: CacheOptions = {},
): Promise<CacheResult<T>> {
  const { freshMs, maxStaleMs, persist } = { ...DEFAULTS, ...options };
  const now = Date.now();

  /* Hydrate from disk on the first miss of a page view. This is the whole
     point of persisting: without it the in-memory map is empty after every
     reload, so a provider that is down produces an error rather than the
     series this browser already has. */
  let entry = store.get(key) as Entry<T> | undefined;
  if (!entry?.hasValue && persist) {
    const restored = readPersisted<T>(key);
    if (restored) {
      store.set(key, { ...restored, inflight: entry?.inflight });
      entry = store.get(key) as Entry<T>;
    }
  }

  if (entry?.hasValue) {
    const age = now - entry.storedAt;
    if (age < freshMs) return { value: entry.value as T, stale: false, ageMs: age };
  }

  // Share one request across concurrent callers. This has to cover the cold
  // case too: on first load several components ask for the same key at once,
  // and firing a request per caller burns rate limit for no benefit.
  let request = entry?.inflight;

  if (!request) {
    request = loader()
      .then((value) => {
        const storedAt = Date.now();
        store.set(key, { hasValue: true, value, storedAt });
        if (persist) writePersisted(key, value, storedAt);
        return value;
      })
      .catch((error) => {
        // Clear only the in-flight marker; the last good value must survive.
        const current = store.get(key) as Entry<T> | undefined;
        if (current?.hasValue) {
          store.set(key, {
            hasValue: true,
            value: current.value,
            storedAt: current.storedAt,
          });
        } else {
          store.delete(key);
        }
        throw error;
      });

    store.set(key, {
      hasValue: entry?.hasValue ?? false,
      value: entry?.value,
      storedAt: entry?.storedAt ?? 0,
      inflight: request,
    });
  }

  try {
    const value = await request;
    return { value, stale: false, ageMs: 0 };
  } catch (error) {
    const fallback = store.get(key) as Entry<T> | undefined;
    const age = fallback?.hasValue ? Date.now() - fallback.storedAt : Infinity;

    if (fallback?.hasValue && age <= maxStaleMs) {
      return { value: fallback.value as T, stale: true, ageMs: age };
    }
    throw error;
  }
}

/** Read a cached value without triggering a request. */
export function peek<T>(key: string): T | undefined {
  const entry = store.get(key) as Entry<T> | undefined;
  return entry?.hasValue ? entry.value : undefined;
}

export function clearCache() {
  store.clear();
  clearPersisted();
}
