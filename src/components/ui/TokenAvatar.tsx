import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { CHAINS } from '@/data/chains';
import type { ChainId } from '@/data/types';

interface TokenAvatarProps {
  symbol: string;
  chain?: ChainId;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Real logo from the market provider, when it has one. */
  src?: string;
}

const SIZES = {
  sm: { box: 'h-6 w-6 text-[9px]', dot: 'h-2.5 w-2.5 -right-0.5 -bottom-0.5' },
  md: { box: 'h-8 w-8 text-[11px]', dot: 'h-3 w-3 -right-0.5 -bottom-0.5' },
  lg: { box: 'h-11 w-11 text-sm', dot: 'h-4 w-4 -right-1 -bottom-1' },
};

/**
 * Identity mark for a token.
 *
 * Uses the provider's logo when one exists, and falls back to a deterministic
 * gradient derived from the symbol itself. Long-tail DEX token logos are
 * unreliable — plenty 404 — and a grid of broken images looks far worse than
 * none, so a failed load silently reverts to the generated mark rather than
 * leaving a hole.
 */
export function TokenAvatar({ symbol, chain, size = 'md', className, src }: TokenAvatarProps) {
  const [failed, setFailed] = useState(false);
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
      {src && !failed ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className={cn(
            'rounded-full object-cover ring-1 ring-inset ring-white/12',
            sizing.box,
          )}
        />
      ) : (
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
      )}

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
