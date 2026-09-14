import { useEffect, useRef, useState } from 'react';
import { usePrefsStore } from '@/store/usePrefsStore';

export type FlashDirection = 'up' | 'down' | null;

/**
 * Flash a cell green or red when its value changes.
 *
 * This is the micro-interaction that makes a screener feel live. It is kept as
 * a hook (rather than derived state in the store) so a re-render of the table
 * never replays every row's animation at once — each cell owns its own
 * previous value.
 *
 * The flash clears itself after `duration`, and honours the user's
 * reduce-flash preference.
 */
export function usePriceFlash(value: number, duration = 900): FlashDirection {
  const reduceFlash = usePrefsStore((s) => s.reduceFlash);
  const previous = useRef(value);
  const [flash, setFlash] = useState<FlashDirection>(null);

  useEffect(() => {
    if (reduceFlash) {
      previous.current = value;
      return;
    }
    if (value === previous.current) return;

    setFlash(value > previous.current ? 'up' : 'down');
    previous.current = value;

    const timer = setTimeout(() => setFlash(null), duration);
    return () => clearTimeout(timer);
  }, [value, duration, reduceFlash]);

  return flash;
}
