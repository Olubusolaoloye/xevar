import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The structural container for every region of the app.
 *
 * One component, three elevations. Consistency here is what makes the layout
 * read as a designed system rather than a pile of boxes.
 */
export const Panel = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & { elevation?: 'flat' | 'raised' | 'lifted' }
>(({ className, elevation = 'flat', ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-lg border border-line bg-surface',
      elevation === 'raised' && 'shadow-panel',
      elevation === 'lifted' && 'shadow-lifted border-line-strong',
      className,
    )}
    {...props}
  />
));
Panel.displayName = 'Panel';

// `title` is widened to ReactNode, so the DOM attribute of the same name is
// omitted rather than shadowed.
interface PanelHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Rendered flush right — actions, filters, a timeframe switch. */
  action?: ReactNode;
  icon?: ReactNode;
}

export function PanelHeader({
  title,
  subtitle,
  action,
  icon,
  className,
  ...props
}: PanelHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-b border-line px-4 py-3',
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && <span className="shrink-0 text-ink-low">{icon}</span>}
        <div className="min-w-0">
          <h2 className="truncate font-display text-sm font-semibold tracking-tight text-ink">
            {title}
          </h2>
          {subtitle && (
            <p className="truncate text-xs text-ink-low">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-1.5">{action}</div>}
    </div>
  );
}

export function PanelBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4', className)} {...props} />;
}
