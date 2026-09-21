import { useCallback, useEffect, useState } from 'react';

/**
 * The design tokens a canvas chart needs, resolved to real colour values.
 *
 * Everything else in the app styles itself with `var(--color-ink-dim)` and the
 * browser re-resolves it the moment the theme changes. A canvas cannot do
 * that: Lightweight Charts paints with literal colour strings, so the values
 * have to be read out of the stylesheet in JavaScript and pushed back into the
 * chart by hand whenever they change.
 *
 * This hook is that bridge.
 */
export interface ChartTheme {
  text: string;
  grid: string;
  crosshair: string;
  border: string;
  up: string;
  down: string;
}

const TOKENS: Record<keyof ChartTheme, string> = {
  text: '--color-ink-dim',
  grid: '--grid-line',
  crosshair: '--color-ink-low',
  border: '--color-line-strong',
  up: '--color-up',
  down: '--color-down',
};

function readTheme(): ChartTheme {
  // On the server, and in the instant before the document exists, fall back to
  // the dark palette's literals — the app's default — rather than empty
  // strings, which Lightweight Charts would silently paint as black on black.
  if (typeof document === 'undefined') {
    return {
      text: '#574f44',
      grid: '#ffffff09',
      crosshair: '#857c6d',
      border: '#332c22',
      up: '#1dbf63',
      down: '#e03540',
    };
  }

  const styles = getComputedStyle(document.documentElement);
  const read = (token: string) => styles.getPropertyValue(token).trim();

  return {
    text: read(TOKENS.text),
    grid: read(TOKENS.grid),
    crosshair: read(TOKENS.crosshair),
    border: read(TOKENS.border),
    up: read(TOKENS.up),
    down: read(TOKENS.down),
  };
}

/**
 * Track the palette across every way the theme can change.
 *
 * Two separate triggers, because the app supports three theme choices and only
 * two of them stamp anything on the document:
 *
 *   - `light`/`dark` set `data-theme` on `<html>`, so a MutationObserver
 *     catches them. Watching the attribute rather than the store is
 *     deliberate — `useThemeEffect` lives in a parent component, and React
 *     runs child effects *before* parent effects, so a hook reading computed
 *     styles off the store's value would read the previous theme's colours.
 *     The observer fires after the attribute actually lands, whatever the
 *     effect order.
 *
 *   - `system` stamps nothing and lets the media query in tokens.css follow
 *     the OS live. Nothing mutates, so the observer never fires and the
 *     `prefers-color-scheme` listener is the only signal.
 */
export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(readTheme);

  const resync = useCallback(() => {
    const next = readTheme();
    // Replacing the object on every tick would hand consumers a new reference
    // and re-run their chart-options effect for no reason.
    setTheme((current) =>
      (Object.keys(next) as Array<keyof ChartTheme>).every((k) => current[k] === next[k])
        ? current
        : next,
    );
  }, []);

  useEffect(() => {
    // The first paint reads tokens before any stylesheet-dependent effect has
    // necessarily run; re-read once mounted so the chart starts correct.
    resync();

    const observer = new MutationObserver(resync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', resync);

    return () => {
      observer.disconnect();
      media.removeEventListener('change', resync);
    };
  }, [resync]);

  return theme;
}
