import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { direction, formatPercent } from '@/lib/format';

interface ChangeValueProps {
  value: number;
  className?: string;
  /** Show a directional arrow alongside the number. */
  arrow?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** Render on a tinted chip rather than as bare text. */
  chip?: boolean;
}

const SIZES = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-lg font-semibold',
};

/**
 * A signed percentage change.
 *
 * Colour is never the only signal: the sign is always printed, and the optional
 * arrow adds a third redundant cue. Roughly one in twelve men has some degree
 * of red-green colour blindness, which is precisely the axis a naive
 * gain/loss palette relies on.
 */
export function ChangeValue({
  value,
  className,
  arrow = false,
  size = 'md',
  chip = false,
}: ChangeValueProps) {
  const dir = direction(value);
  const Icon = dir === 'up' ? ArrowUp : ArrowDown;

  return (
    <span
      className={cn(
        'tnum inline-flex items-center gap-0.5 font-mono tabular-nums',
        dir === 'up' && 'text-up',
        dir === 'down' && 'text-down',
        dir === 'flat' && 'text-ink-low',
        chip && 'rounded-xs px-1.5 py-0.5',
        chip && dir === 'up' && 'bg-up/10',
        chip && dir === 'down' && 'bg-down/10',
        chip && dir === 'flat' && 'bg-raised',
        SIZES[size],
        className,
      )}
    >
      {arrow && dir !== 'flat' && <Icon className="h-3 w-3" strokeWidth={2.5} />}
      {formatPercent(value)}
    </span>
  );
}
