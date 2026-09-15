import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/Tooltip';

export type Winner = 'left' | 'right' | 'tie' | 'none';

/**
 * Decide which side wins a metric.
 *
 * `none` when either side has no figure. A missing number is not a low number,
 * and treating it as one would hand the comparison to whichever token the
 * provider happens to report more about.
 */
export function compareValues(
  left: number | null | undefined,
  right: number | null | undefined,
  higherIsBetter = true,
): Winner {
  if (left == null || right == null || !Number.isFinite(left) || !Number.isFinite(right)) {
    return 'none';
  }
  if (left === right) return 'tie';
  const leftWins = higherIsBetter ? left > right : left < right;
  return leftWins ? 'left' : 'right';
}

interface CompareRowProps {
  label: string;
  /** Why this metric matters, shown on hover. */
  hint?: string;
  leftValue: React.ReactNode;
  rightValue: React.ReactNode;
  /**
   * Which side to mark. Omit for rows where "better" is not a thing — a
   * network or an exchange name has no winner, and pretending otherwise turns
   * a fact into a recommendation.
   */
  winner?: Winner;
}

export function CompareRow({
  label,
  hint,
  leftValue,
  rightValue,
  winner = 'none',
}: CompareRowProps) {
  const cell = (side: 'left' | 'right') =>
    cn(
      'tnum min-w-0 px-4 py-2.5 font-mono text-sm',
      winner === side ? 'font-semibold text-ink' : 'text-ink-mid',
      side === 'left' ? 'text-right' : 'text-left',
    );

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-line-soft last:border-b-0">
      <div className={cell('left')}>
        <span className="inline-flex items-center gap-1.5">
          {winner === 'left' && (
            <span
              aria-label="Higher"
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500"
            />
          )}
          <span className="truncate">{leftValue}</span>
        </span>
      </div>

      <div className="px-3 py-2.5 text-center">
        {hint ? (
          <Tooltip content={hint}>
            <span className="cursor-help whitespace-nowrap border-b border-dotted border-line-strong text-[11px] text-ink-low">
              {label}
            </span>
          </Tooltip>
        ) : (
          <span className="whitespace-nowrap text-[11px] text-ink-low">{label}</span>
        )}
      </div>

      <div className={cell('right')}>
        <span className="inline-flex items-center gap-1.5">
          <span className="truncate">{rightValue}</span>
          {winner === 'right' && (
            <span
              aria-label="Higher"
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500"
            />
          )}
        </span>
      </div>
    </div>
  );
}

/** A labelled group of comparison rows. */
export function CompareSection({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="border-b border-line bg-sunken px-4 py-2">
        <p className="font-display text-xs font-semibold tracking-tight text-ink">
          {title}
        </p>
        {note && <p className="mt-0.5 text-[11px] leading-relaxed text-ink-dim">{note}</p>}
      </div>
      {children}
    </div>
  );
}
