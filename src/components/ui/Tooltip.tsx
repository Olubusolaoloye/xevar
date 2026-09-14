import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
}

/**
 * A lightweight hover/focus tooltip.
 *
 * Deliberately CSS-positioned rather than portalled: every use in this app is
 * inside a scroll container where a portalled tooltip would need continuous
 * position syncing to stay attached.
 */
export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={cn(
            'pointer-events-none absolute left-1/2 z-50 w-max max-w-[240px] -translate-x-1/2',
            'rounded-md border border-line-strong bg-overlay px-2.5 py-1.5',
            'text-xs leading-relaxed font-normal text-ink-mid shadow-popover',
            side === 'top' ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]',
            className,
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
