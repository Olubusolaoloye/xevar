import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * The state a screener spends more time in than anyone expects — someone always
 * over-filters. It should explain what happened and offer the way out, not just
 * show an empty box.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-16 text-center',
        className,
      )}
    >
      {icon && (
        <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-sunken text-ink-dim">
          {icon}
        </div>
      )}
      <div className="max-w-sm">
        <p className="font-display text-sm font-semibold text-ink">{title}</p>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-ink-low">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
