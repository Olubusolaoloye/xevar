import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * The PanScreener mark.
 *
 * A scanning aperture over a rising series, reading simultaneously as a
 * viewfinder (the "screening") and as a chart (the subject). The crimson frame
 * around a golden field mirrors the construction of the Blin brand artwork.
 * It resolves cleanly at 16px, which is the only size test a mark has to pass.
 */
export function LogoMark({ className, size = 28 }: { className?: string; size?: number }) {
  const gradientId = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={cn('shrink-0', className)}
      role="img"
      aria-label="PanScreener"
    >
      <defs>
        <linearGradient id={gradientId} x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--color-brand-600)" />
          <stop offset="1" stopColor="var(--color-brand-300)" />
        </linearGradient>
      </defs>

      {/* Aperture body */}
      <rect
        x="1.25"
        y="1.25"
        width="29.5"
        height="29.5"
        rx="8.75"
        stroke="var(--color-accent-500)"
        strokeWidth="2.5"
        opacity="0.85"
      />

      {/* Ascending series */}
      <rect x="8" y="18" width="3.5" height="7" rx="1.75" fill="var(--color-brand-600)" />
      <rect x="14.25" y="13" width="3.5" height="12" rx="1.75" fill="var(--color-brand-500)" />
      <rect
        x="20.5"
        y="7"
        width="3.5"
        height="18"
        rx="1.75"
        style={{ fill: `url(#${gradientId})` }}
      />
    </svg>
  );
}

interface WordmarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Render the mark only, for the collapsed navigation rail. */
  markOnly?: boolean;
}

const TEXT_SIZE = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
};

const MARK_SIZE = { sm: 22, md: 26, lg: 34 };

export function Wordmark({ className, size = 'md', markOnly = false }: WordmarkProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark size={MARK_SIZE[size]} />
      {!markOnly && (
        <span
          className={cn(
            'font-display font-bold tracking-[-0.02em] text-ink',
            TEXT_SIZE[size],
          )}
        >
          Pan
          <span className="text-brand-500">Screener</span>
        </span>
      )}
    </span>
  );
}
