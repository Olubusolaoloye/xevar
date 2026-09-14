import { useEffect } from 'react';
import { useMarketStore } from '@/store/useMarketStore';

/**
 * Mount the live feed for as long as the calling component is alive.
 *
 * The store reference-counts subscribers, so this is safe to call from several
 * components at once — the websocket opens once and closes when the last
 * consumer unmounts.
 */
export function useMarketFeed() {
  const start = useMarketStore((s) => s.start);
  const stop = useMarketStore((s) => s.stop);

  useEffect(() => {
    start();
    return stop;
  }, [start, stop]);
}
