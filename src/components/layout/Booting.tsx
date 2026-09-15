import { useEffect, useState } from 'react';
import { Wordmark } from '@/components/brand/Logo';

/**
 * Held before first paint, while the app works out whether it is open.
 *
 * The lock lives in the backend and arrives after first render, so the shell
 * cannot draw anything until it knows — otherwise a closed app shows the whole
 * product for a moment before catching itself, which is exactly what the lock
 * exists to prevent.
 *
 * The mark is delayed rather than shown at once. On a normal connection this
 * state lasts a couple of hundred milliseconds, and a logo that appears and
 * vanishes inside that window reads as a glitch; after half a second the wait
 * is real and silence starts to look broken instead.
 */
export function Booting() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      {slow && (
        <div className="rise opacity-60">
          <Wordmark />
        </div>
      )}
    </div>
  );
}
