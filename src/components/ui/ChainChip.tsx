import { cn } from '@/lib/utils';
import { CHAINS } from '@/data/chains';
import type { ChainId } from '@/data/types';

interface ChainChipProps {
  chain: ChainId;
  className?: string;
  /** Hide the label, leaving only the colour dot. */
  compact?: boolean;
}

/** Network identity, tinted with the chain's own colour token. */
export function ChainChip({ chain, className, compact = false }: ChainChipProps) {
  const meta = CHAINS[chain];

  return (
    <span
      title={meta.name}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-xs border px-1.5 py-0.5',
        'text-[10px] font-semibold uppercase tracking-wider',
        className,
      )}
      style={{
        color: meta.colorVar,
        // `color-mix` derives the tint and border straight from the chain hue,
        // so adding a network needs one token and nothing else.
        backgroundColor: `color-mix(in srgb, ${meta.colorVar} 12%, transparent)`,
        borderColor: `color-mix(in srgb, ${meta.colorVar} 28%, transparent)`,
      }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: meta.colorVar }}
      />
      {!compact && meta.short}
    </span>
  );
}
