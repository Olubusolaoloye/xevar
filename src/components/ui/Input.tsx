import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
  /** Rendered inside the field on the right — a unit, a clear button. */
  suffix?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, suffix, ...props }, ref) => (
    <div className="relative flex items-center">
      {icon && (
        <span className="pointer-events-none absolute left-2.5 text-ink-dim">{icon}</span>
      )}
      <input
        ref={ref}
        className={cn(
          'h-9 w-full rounded-md border border-line bg-sunken text-sm text-ink',
          'placeholder:text-ink-dim',
          'transition-colors duration-150',
          'hover:border-line-strong',
          'focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/15',
          icon ? 'pl-8' : 'pl-3',
          suffix ? 'pr-9' : 'pr-3',
          className,
        )}
        {...props}
      />
      {suffix && <span className="absolute right-2.5 text-ink-low">{suffix}</span>}
    </div>
  ),
);
Input.displayName = 'Input';
