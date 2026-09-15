import { Clock } from 'lucide-react';
import { Wordmark } from '@/components/brand/Logo';
import { useAdminStore } from '@/store/useAdminStore';

/**
 * The closed sign.
 *
 * Deliberately outside the application shell: no navigation, no search, no
 * market feed. A closed app that still renders its own chrome invites people
 * to press things, and every one of those presses is a route that has to
 * refuse them individually.
 *
 * There is no way out of it and no link to one. The operator gets back in by
 * going to /account or /admin directly, which stay reachable while the app is
 * closed — see data/appLock.ts. A visible "operator sign-in" link only tells
 * every visitor where the door is, and the people who need it already know.
 */
export function ComingSoon() {
  const title = useAdminStore((s) => s.lockTitle);
  const message = useAdminStore((s) => s.lockMessage);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-canvas px-6 text-center">
      {/* The same aurora the hero uses, so a closed product still looks like
          the product rather than an error page. */}
      <div
        aria-hidden
        className="aurora pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-brand-500/12 blur-[120px]"
      />
      <div aria-hidden className="grid-paper pointer-events-none absolute inset-0 opacity-40" />

      <div className="relative z-10 flex max-w-md flex-col items-center">
        <Wordmark />

        {/* The chip needs a block-level parent. On its own an inline-flex
            element is still an inline box, so it sat on the same line as the
            wordmark and the top margin did nothing. */}
        <div className="mt-9">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/25 bg-brand-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-500">
            <Clock className="h-3 w-3" />
            {title}
          </span>
        </div>

        <p className="mt-5 text-pretty text-sm leading-relaxed text-ink-mid">
          {message}
        </p>
      </div>

    </div>
  );
}
