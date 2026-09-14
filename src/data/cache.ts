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
}

const DEFAULTS: Required<CacheOptions> = {
  freshMs: 15_000,
  maxStaleMs: 5 * 60_000,
};

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
  const { freshMs, maxStaleMs } = { ...DEFAULTS, ...options };
  const entry = store.get(key) as Entry<T> | undefined;
  const now = Date.now();

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
        store.set(key, { hasValue: true, value, storedAt: Date.now() });
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
}
