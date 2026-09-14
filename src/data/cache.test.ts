import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cached, clearCache, peek } from './cache';

beforeEach(() => {
  clearCache();
});

describe('cached', () => {
  it('serves a fresh value without calling the loader again', async () => {
    const loader = vi.fn().mockResolvedValue('first');

    await cached('k', loader, { freshMs: 10_000 });
    const second = await cached('k', loader, { freshMs: 10_000 });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(second.value).toBe('first');
    expect(second.stale).toBe(false);
  });

  it('keeps the last good value when a refresh fails', async () => {
    // This is the behaviour that stops the board emptying on a 429 or a
    // momentary connection drop.
    const loader = vi
      .fn()
      .mockResolvedValueOnce('good')
      .mockRejectedValue(new Error('429'));

    await cached('k', loader, { freshMs: 0 });
    const result = await cached('k', loader, { freshMs: 0 });

    expect(result.value).toBe('good');
    expect(result.stale).toBe(true);
    expect(result.ageMs).toBeGreaterThanOrEqual(0);
  });

  it('reports staleness so the UI can say the data is not live', async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce('v1')
      .mockRejectedValue(new Error('down'));

    const fresh = await cached('k', loader, { freshMs: 0 });
    expect(fresh.stale).toBe(false);

    const stale = await cached('k', loader, { freshMs: 0 });
    expect(stale.stale).toBe(true);
  });

  it('throws when nothing has ever succeeded', async () => {
    const loader = vi.fn().mockRejectedValue(new Error('cold'));
    await expect(cached('k', loader)).rejects.toThrow('cold');
  });

  it('refuses a cached value that is older than maxStale', async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce('old')
      .mockRejectedValue(new Error('down'));

    await cached('k', loader, { freshMs: 0 });
    // Any positive age exceeds a zero tolerance, so the stale value is refused
    // rather than silently presented.
    await new Promise((resolve) => setTimeout(resolve, 5));
    await expect(cached('k', loader, { freshMs: 0, maxStaleMs: 0 })).rejects.toThrow('down');
  });

  it('collapses concurrent refreshes of one key into a single request', async () => {
    let resolveLoader: (value: string) => void = () => {};
    const loader = vi.fn().mockImplementation(
      () => new Promise<string>((resolve) => { resolveLoader = resolve; }),
    );

    const both = Promise.all([cached('k', loader), cached('k', loader)]);
    resolveLoader('once');
    const [a, b] = await both;

    expect(loader).toHaveBeenCalledTimes(1);
    expect(a.value).toBe('once');
    expect(b.value).toBe('once');
  });

  it('exposes the stored value without triggering a request', async () => {
    const loader = vi.fn().mockResolvedValue('stored');
    await cached('k', loader);

    expect(peek('k')).toBe('stored');
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
