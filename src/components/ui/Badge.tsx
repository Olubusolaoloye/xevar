import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'brand' | 'up' | 'down' | 'warn' | 'info';

const TONES: Record<Tone, string> = {
  neutral: 'bg-raised text-ink-mid border-line-strong',
  brand: 'bg-brand-500/10 text-brand-500 border-brand-500/25',
  up: 'bg-up/10 text-up border-up/25',
  down: 'bg-down/10 text-down border-down/25',
  warn: 'bg-warn/10 text-warn border-warn/25',
  info: 'bg-info/10 text-info border-info/25',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-xs border px-1.5 py-0.5',
        'text-[10px] font-semibold uppercase tracking-wider',
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
