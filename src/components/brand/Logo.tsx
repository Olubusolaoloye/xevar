import { cn } from '@/lib/utils';

/**
 * The PanScreener mark.
 *
 * The glass head of the magnifier, cropped from the full artwork in
 * public/panlogo.png. The handle is dropped on purpose: at the sizes this
 * renders — 22px in the top bar, 34px in the rail — a long diagonal handle
 * costs most of the box and leaves the bars, which are the recognisable part,
 * a few pixels tall.
 *
 * Served at 128px so it stays sharp on a 3x display, and as PNG rather than
 * the source file because panlogo.png is 1.2MB and this is on every page.
 */
export function LogoMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}panlogo-mark.png`}
      width={size}
      height={size}
      alt=""
      // The wordmark beside it already names the product; an alt here would
      // have a screen reader announce it twice.
      aria-hidden="true"
      decoding="async"
      className={cn('shrink-0 select-none', className)}
      style={{ width: size, height: size }}
    />
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
