import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Read-only star display. Fractional values fill the last star partially. */
export function Stars({
  value,
  size = 14,
  className,
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  const clamped = Math.min(5, Math.max(0, value));

  return (
    <span
      className={cn('inline-flex items-center gap-0.5', className)}
      role="img"
      aria-label={`${clamped.toFixed(1)} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        // How much of THIS star is filled: all, none, or the remainder.
        const fill = Math.min(1, Math.max(0, clamped - (star - 1)));
        return (
          <span key={star} className="relative inline-block" style={{ width: size, height: size }}>
            <Star
              className="absolute inset-0 text-line-strong"
              style={{ width: size, height: size }}
              aria-hidden
            />
            {fill > 0 && (
              // Clipped rather than opacity-faded: a half star should look
              // half filled, not wholly dim.
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
                aria-hidden
              >
                <Star
                  className="fill-brand-500 text-brand-500"
                  style={{ width: size, height: size }}
                />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

/** Interactive star picker. */
export function StarInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div
      className="inline-flex items-center gap-1"
      onMouseLeave={() => setHover(0)}
      role="radiogroup"
      aria-label="Your rating"
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
          disabled={disabled}
          onMouseEnter={() => setHover(star)}
          onFocus={() => setHover(star)}
          onClick={() => onChange(star)}
          className="rounded-sm p-0.5 transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Star
            className={cn(
              'h-6 w-6 transition-colors',
              star <= shown
                ? 'fill-brand-500 text-brand-500'
                : 'text-line-strong hover:text-ink-dim',
            )}
          />
        </button>
      ))}
    </div>
  );
}
