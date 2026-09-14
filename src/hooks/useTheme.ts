import { useEffect } from 'react';
import { usePrefsStore } from '@/store/usePrefsStore';

/**
 * Apply the theme choice to the document root.
 *
 * "system" removes the attribute entirely rather than resolving the OS
 * preference into a stamped value. That matters: a stamped value freezes the
 * theme at page load, so a viewer switching their OS to dark mid-session would
 * be left on the light palette. Leaving it unstamped lets the media query in
 * tokens.css keep following along live.
 */
export function useThemeEffect() {
  const theme = usePrefsStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);
}
