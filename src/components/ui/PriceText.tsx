import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { usePriceFlash } from '@/hooks/usePriceFlash';

interface PriceTextProps {
  /** Always in USD; conversion happens here. */
  usd: number;
  className?: string;
  /** Flash green/red when the value moves. Off for static figures. */
  live?: boolean;
}

/**
 * A price, rendered with the subscript-zero convention for sub-penny tokens.
 *
 * `$0.0₇4821` is compact and instantly comparable between rows, where
 * `$0.00000004821` is neither. The zero count is real `<sub>` markup, and the
 * accessible label carries the full expanded number so screen readers and
 * copy-paste both get the true value.
 */
export function PriceText({ usd, className, live = false }: PriceTextProps) {
  const { price, priceText } = useCurrency();
  const flash = usePriceFlash(live ? usd : 0);
  const { lead, zeros, digits } = price(usd);

  return (
    <span
      title={priceText(usd)}
      className={cn(
        'tnum rounded-xs px-1 -mx-1 font-mono transition-colors',
        flash === 'up' && 'tick-up',
        flash === 'down' && 'tick-down',
        className,
      )}
    >
      <span aria-hidden="true">
        {lead}
        {zeros > 0 && (
          <sub className="text-[0.7em] font-semibold tracking-tight opacity-80">
            {zeros}
          </sub>
        )}
        {digits}
      </span>
      <span className="sr-only">{priceText(usd)}</span>
    </span>
  );
}
