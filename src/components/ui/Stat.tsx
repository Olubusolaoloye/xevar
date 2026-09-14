import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatProps {
  label: string;
  value: ReactNode;
  /** Small supporting line beneath the value — a delta, a count, a unit. */
  detail?: ReactNode;
  icon?: ReactNode;
  className?: string;
  align?: 'left' | 'right';
}

/**
 * One labelled figure.
 *
 * The label sits *above* the value in small caps, so a row of these scans as a
 * table of numbers rather than a paragraph of words — the value is what the eye
 * should land on first.
 */
export function Stat({ label, value, detail, icon, className, align = 'left' }: StatProps) {
  return (
    <div className={cn('min-w-0', align === 'right' && 'text-right', className)}>
      <div
        className={cn(
          'flex items-center gap-1.5',
          align === 'right' && 'justify-end',
        )}
      >
        {icon && <span className="text-ink-dim">{icon}</span>}
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-low">
          {label}
        </p>
      </div>
      <p className="tnum mt-1 truncate font-mono text-base font-semibold text-ink">
        {value}
      </p>
      {detail && <div className="mt-0.5 text-xs text-ink-low">{detail}</div>}
    </div>
  );
}
