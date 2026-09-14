import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const VARIANTS: Record<Variant, string> = {
  // The one saturated surface in the product — reserved for the single most
  // important action on any given screen.
  primary:
    'bg-brand-500 text-canvas font-semibold hover:bg-brand-400 active:bg-brand-600 shadow-[0_0_24px_-6px_var(--color-brand-500)] hover:shadow-[0_0_32px_-4px_var(--color-brand-500)]',
  secondary:
    'bg-raised text-ink border border-line-strong hover:bg-overlay hover:border-ink-dim',
  ghost:
    'text-ink-mid hover:text-ink hover:bg-raised',
  outline:
    'border border-line-strong text-ink-mid hover:text-ink hover:border-brand-500/60 hover:bg-brand-500/5',
  danger:
    'bg-down/12 text-down border border-down/30 hover:bg-down/20',
};

const SIZES: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5 rounded-sm',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-md',
  lg: 'h-11 px-5 text-sm gap-2 rounded-lg',
  icon: 'h-9 w-9 rounded-md',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap font-medium',
        'transition-all duration-150 ease-[var(--ease-out-quint)]',
        'disabled:pointer-events-none disabled:opacity-40',
        'active:scale-[0.98]',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
