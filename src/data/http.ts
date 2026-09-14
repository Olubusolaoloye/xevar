/**
 * Minimal HTTP helper for the public market APIs.
 *
 * Both providers are unauthenticated and rate-limited, so the two things that
 * actually matter here are a hard timeout (a hung request must not stall the
 * board forever) and recognising 429 so callers can back off rather than
 * hammering a limit they have already hit.
 */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    message?: string,
  ) {
    super(message ?? `Request failed with ${status}`);
    this.name = 'HttpError';
  }

  /** Rate limited — back off rather than retry immediately. */
  get isRateLimited() {
    return this.status === 429;
  }
}

const DEFAULT_TIMEOUT_MS = 12_000;

export async function getJson<T>(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      throw new HttpError(response.status, url);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new HttpError(408, url, 'Request timed out');
    }
    // Network failure, DNS, CORS, blocked host — all indistinguishable here.
    throw new HttpError(0, url, error instanceof Error ? error.message : 'Network error');
  } finally {
    clearTimeout(timer);
  }
}
