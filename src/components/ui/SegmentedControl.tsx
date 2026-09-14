import { cn } from '@/lib/utils';

interface Option<T extends string> {
  value: T;
  label: string;
  title?: string;
}

interface SegmentedControlProps<T extends string> {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * A compact exclusive choice — timeframes, chart ranges, density.
 *
 * Implemented as a real radio group rather than styled buttons, so arrow-key
 * navigation between options works the way keyboard users expect.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'md',
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md border border-line bg-sunken p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="radio"
            aria-checked={active}
            title={option.title ?? option.label}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-sm font-medium transition-all duration-150',
              size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
              active
                ? 'bg-raised text-ink shadow-panel'
                : 'text-ink-low hover:text-ink-mid',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
