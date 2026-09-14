import { ExternalLink, ShieldQuestion } from 'lucide-react';
import { truncateAddress } from '@/lib/format';
import { buildVerdictUrl, useAdminStore } from '@/store/useAdminStore';
import { Button } from '@/components/ui/Button';
import { PanelHeader } from '@/components/ui/Panel';
import type { Pair } from '@/data/types';

/**
 * Contract verdict.
 *
 * PanScreener does not audit contracts and the market API exposes no safety
 * data, so rather than render checks it cannot substantiate, this hands off to
 * a dedicated verdict service for the exact token on the exact chain.
 *
 * The link is built from a template configured in admin. A hardcoded path would
 * be a guess at the provider's URL scheme, and a wrong guess means a dead link
 * on every token page — the template makes that a one-field fix instead.
 */
export function VerdictPanel({ pair }: { pair: Pair }) {
  const provider = useAdminStore((s) => s.provider);

  if (!provider.enabled || !provider.urlTemplate.trim()) {
    return (
      <div>
        <PanelHeader
          title="Contract verdict"
          icon={<ShieldQuestion className="h-4 w-4 text-ink-low" />}
        />
        <p className="px-4 py-4 text-[11px] leading-relaxed text-ink-low">
          No verdict provider is configured. Set one in Admin to link each token
          to a contract report.
        </p>
      </div>
    );
  }

  const url = buildVerdictUrl(provider, {
    address: pair.baseToken.address,
    chain: pair.chain,
    symbol: pair.baseToken.symbol,
    pairAddress: pair.pairAddress,
  });

  return (
    <div>
      <PanelHeader
        title="Contract verdict"
        subtitle={`Checked by ${provider.name}`}
        icon={<ShieldQuestion className="h-4 w-4 text-ink-low" />}
      />

      <div className="space-y-3 p-4">
        <div className="rounded-md border border-line bg-sunken px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-low">
            Token
          </p>
          <p className="mt-1 text-sm font-semibold text-ink">
            {pair.baseToken.symbol}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-ink-dim">
            {truncateAddress(pair.baseToken.address, 10, 8)}
          </p>
        </div>

        <a href={url} target="_blank" rel="noopener noreferrer" className="block">
          <Button variant="primary" size="lg" className="w-full">
            Open {provider.name} verdict
            <ExternalLink className="h-4 w-4" />
          </Button>
        </a>

        <p className="text-[11px] leading-relaxed text-ink-dim">
          Verdicts come from {provider.name}, not from PanScreener. Treat them as
          one input, not a guarantee — no automated scan catches every exploit.
        </p>
      </div>
    </div>
  );
}
