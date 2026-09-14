import { useState } from 'react';
import { Activity, Download, RefreshCw, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatAge } from '@/lib/format';
import { useMarketStore } from '@/store/useMarketStore';
import { hasBackend } from '@/lib/supabase';
import { useAdminStore } from '@/store/useAdminStore';
import { useListingStore, type Listing } from '@/store/useListingStore';
import { Button } from '@/components/ui/Button';
import { PanelHeader } from '@/components/ui/Panel';
import type { FeedStatus } from '@/data/types';

const STATUS_COPY: Record<FeedStatus, { label: string; detail: string; tone: string }> = {
  connecting: {
    label: 'Connecting',
    detail: 'Fetching listed tokens from DexScreener.',
    tone: 'text-warn',
  },
  live: {
    label: 'Live',
    detail: 'Real on-chain pool prices, refreshed every 30 seconds.',
    tone: 'text-brand-500',
  },
  stale: {
    label: 'Cached',
    detail:
      'The last refresh failed. These are the most recent values received, not live ones.',
    tone: 'text-warn',
  },
  offline: {
    label: 'Unavailable',
    detail:
      'The market API could not be reached. Check whether a proxy, VPN or DNS filter is blocking api.dexscreener.com.',
    tone: 'text-down',
  },
};

/**
 * Feed diagnostics.
 *
 * Exists so "the prices look wrong" is a question with an answer rather than a
 * hunch. It states plainly whether numbers are live, how old they are, how many
 * listings actually resolved to a pool, and which ones did not.
 */
export function FeedDiagnostics() {
  const status = useMarketStore((s) => s.status);
  const updatedAt = useMarketStore((s) => s.updatedAt);
  const pairs = useMarketStore((s) => s.pairs);
  const refresh = useMarketStore((s) => s.refresh);

  const pollSeconds = useAdminStore((s) => s.pollSeconds);
  const tokens = useListingStore((s) => s.tokens);
  const replaceAll = useListingStore((s) => s.replaceAll);

  const [importError, setImportError] = useState<string | null>(null);

  const copy = STATUS_COPY[status];
  const resolved = tokens.filter((t) =>
    pairs.some((p) => p.tracked?.tokenId === t.id),
  ).length;
  const missing = tokens.length - resolved;

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(tokens, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'panscreener-tokens.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const importJson = (file: File) => {
    file
      .text()
      .then((text) => {
        const parsed = JSON.parse(text) as Listing[];
        if (!Array.isArray(parsed)) throw new Error('not a list');
        // Validate before replacing: a malformed import would otherwise wipe
        // the board and leave nothing to recover from.
        const valid = parsed.filter(
          (t) => t && typeof t.symbol === 'string' && typeof t.chain === 'string',
        );
        if (valid.length === 0) throw new Error('no usable entries');
        replaceAll(valid);
        setImportError(null);
      })
      .catch(() => setImportError('That file is not a valid token list.'));
  };

  return (
    <div>
      <PanelHeader
        title="Feed status"
        subtitle="Where the numbers come from"
        icon={<Activity className="h-4 w-4" />}
        action={
          <Button size="sm" variant="outline" onClick={refresh}>
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
        }
      />

      <div className="space-y-3 p-4">
        <div className="rounded-md border border-line bg-sunken px-3.5 py-3">
          <p className={cn('font-display text-sm font-semibold', copy.tone)}>
            {copy.label}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-mid">{copy.detail}</p>
          <p className="mt-1.5 font-mono text-[11px] text-ink-dim">
            Last update {formatAge(updatedAt)} ago · DexScreener · polls every{' '}
            {pollSeconds}s
          </p>
        </div>

        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-line bg-line">
          {[
            { label: 'Listed', value: tokens.length, tone: 'text-ink' },
            { label: 'Resolved', value: resolved, tone: 'text-up' },
            {
              label: 'Missing',
              value: missing,
              tone: missing > 0 ? 'text-warn' : 'text-ink-low',
            },
          ].map((stat) => (
            <div key={stat.label} className="bg-surface px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-ink-low">
                {stat.label}
              </p>
              <p className={cn('tnum mt-0.5 font-mono text-lg font-semibold', stat.tone)}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {missing > 0 && (
          <p className="rounded-sm border border-warn/25 bg-warn/10 px-3 py-2 text-[11px] leading-relaxed text-warn">
            {missing} listed {missing === 1 ? 'token has' : 'tokens have'} no pool
            on the live feed. Either the ticker matched nothing on that network, or
            the token has no DEX liquidity. Pin its contract address to be sure.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <Button size="sm" variant="outline" onClick={exportJson}>
            <Download className="h-3 w-3" />
            Export list
          </Button>

          <label className="inline-flex">
            <input
              type="file"
              accept="application/json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) importJson(file);
                event.target.value = '';
              }}
            />
            <span className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-sm border border-line-strong px-2.5 text-xs font-medium text-ink-mid transition-colors hover:border-brand-500/60 hover:text-ink">
              <Upload className="h-3 w-3" />
              Import list
            </span>
          </label>
        </div>

        {importError && <p className="text-xs text-down">{importError}</p>}

        <p className="text-[11px] leading-relaxed text-ink-dim">
          The listings live in this browser only. Export it to move it to
          another device or to keep a backup.
        </p>
      </div>
    </div>
  );
}
