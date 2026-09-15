import { useEffect, useMemo, useState } from 'react';
import { resolveCuratedList, type CuratedRow } from '@/data/curatedList';
import { useAdminStore } from '@/store/useAdminStore';
import { useMarketStore } from '@/store/useMarketStore';
import { usePrefsStore } from '@/store/usePrefsStore';

export interface CuratedWatchlist {
  name: string;
  /** Rows that resolved to a live pair, in roster order. */
  rows: CuratedRow[];
  /** Entries the provider could not place on any chain. */
  unresolved: CuratedRow[];
  /** True until the first resolution pass finishes. */
  loading: boolean;
  /** False once this device has dismissed the list, or if it is empty. */
  visible: boolean;
  dismiss: () => void;
}

/**
 * The curated watchlist, resolved against live markets.
 *
 * Re-runs whenever the board updates so prices stay current: entries the admin
 * has listed are read straight off the board, and the rest come from the
 * session-cached address lookups in data/curatedList, which do not re-request.
 */
export function useCuratedWatchlist(): CuratedWatchlist {
  const name = useAdminStore((s) => s.curatedName);
  const tokens = useAdminStore((s) => s.curatedTokens);
  const board = useMarketStore((s) => s.pairs);
  const dismissed = usePrefsStore((s) => s.curatedDismissed);
  const setDismissed = usePrefsStore((s) => s.setCuratedDismissed);

  const [rows, setRows] = useState<CuratedRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (dismissed || tokens.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    void resolveCuratedList(tokens, board).then((next) => {
      if (cancelled) return;
      setRows(next);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [tokens, board, dismissed]);

  const resolved = useMemo(() => rows.filter((row) => row.pair), [rows]);
  const unresolved = useMemo(() => rows.filter((row) => !row.pair), [rows]);

  return {
    name,
    rows: resolved,
    unresolved,
    loading,
    visible: !dismissed && tokens.length > 0,
    dismiss: () => setDismissed(true),
  };
}
