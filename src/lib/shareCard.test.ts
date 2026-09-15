import { describe, expect, it } from 'vitest';
import { withCacheBust } from './shareCard';

describe('withCacheBust', () => {
  it('starts a query string when the URL has none', () => {
    expect(withCacheBust('https://cdn.example/logo.png', 42)).toBe(
      'https://cdn.example/logo.png?cors=42',
    );
  });

  it('appends to a query string that already exists', () => {
    /* Token logo URLs carry a key parameter. A second "?" produces a URL the
       CDN answers with a 400, so the retry would fail for exactly the images
       it exists to rescue. */
    expect(withCacheBust('https://cdn.example/logo.png?key=abc', 42)).toBe(
      'https://cdn.example/logo.png?key=abc&cors=42',
    );
  });

  it('keeps a fragment-free URL intact apart from the parameter', () => {
    const url = 'https://cdn.example/a/b/c.png?w=64&h=64';
    expect(withCacheBust(url, 7)).toBe(`${url}&cors=7`);
  });

  it('produces a different URL on each call, which is the point', () => {
    expect(withCacheBust('https://x/y.png', 1)).not.toBe(withCacheBust('https://x/y.png', 2));
  });
});
