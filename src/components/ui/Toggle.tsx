import { cn } from '@/lib/utils';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  className?: string;
}

export function Toggle({ checked, onChange, label, description, className }: ToggleProps) {
  const control = (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-200',
        checked
          ? 'border-brand-500/40 bg-brand-500/25'
          : 'border-line-strong bg-sunken',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all duration-200',
          'ease-[var(--ease-spring)]',
          checked ? 'left-[18px] bg-brand-500' : 'left-0.5 bg-ink-dim',
        )}
      />
    </button>
  );

  if (!label) return control;

  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {description && <p className="mt-0.5 text-xs text-ink-low">{description}</p>}
      </div>
      {control}
    </div>
  );
}
