import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { CHAINS } from '@/data/chains';
import type { ChainId } from '@/data/types';

interface TokenAvatarProps {
  symbol: string;
  chain?: ChainId;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: { box: 'h-6 w-6 text-[9px]', dot: 'h-2.5 w-2.5 -right-0.5 -bottom-0.5' },
  md: { box: 'h-8 w-8 text-[11px]', dot: 'h-3 w-3 -right-0.5 -bottom-0.5' },
  lg: { box: 'h-11 w-11 text-sm', dot: 'h-4 w-4 -right-1 -bottom-1' },
};

/**
 * Identity mark for a token.
 *
 * Real logo URLs for long-tail DEX tokens are unreliable — most 404, and a grid
 * of broken images looks far worse than no images at all. Instead each token
 * gets a deterministic gradient derived from its own symbol, so the same token
 * always looks the same and adjacent rows stay visually distinct.
 */
export function TokenAvatar({ symbol, chain, size = 'md', className }: TokenAvatarProps) {
  const gradient = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) {
      hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0;
    }
    const hue = hash % 360;
    // Second hue offset by a fixed angle keeps every pairing harmonious.
    return `linear-gradient(135deg, hsl(${hue} 62% 46%), hsl(${(hue + 48) % 360} 58% 32%))`;
  }, [symbol]);

  const sizing = SIZES[size];

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        style={{ backgroundImage: gradient }}
        className={cn(
          'inline-flex items-center justify-center rounded-full',
          'font-display font-bold uppercase tracking-tight text-white/95',
          'ring-1 ring-inset ring-white/12',
          sizing.box,
        )}
      >
        {symbol.slice(0, 3)}
      </span>

      {chain && (
        <span
          title={CHAINS[chain].name}
          style={{ backgroundColor: CHAINS[chain].colorVar }}
          className={cn(
            'absolute rounded-full ring-2 ring-surface',
            sizing.dot,
          )}
        />
      )}
    </span>
  );
}
