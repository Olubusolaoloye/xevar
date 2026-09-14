import { RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import { useVersionCheck } from '@/hooks/useVersionCheck';
import { Button } from '@/components/ui/Button';

/**
 * Offers a reload when a newer build is on the server.
 *
 * Deliberately not automatic: reloading out from under someone who is midway
 * through a calculation or a form is worse than letting them finish on a
 * slightly older build. Dismissing it is honoured for the rest of the session.
 */
export function UpdateBanner() {
  const { updateReady, reload } = useVersionCheck();
  const [dismissed, setDismissed] = useState(false);

  if (!updateReady || dismissed) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-20 z-90 mx-auto flex w-[min(420px,calc(100%-2rem))] items-center gap-3 rounded-lg border border-brand-500/30 bg-overlay px-4 py-3 shadow-popover lg:bottom-6"
    >
      <RefreshCw className="h-4 w-4 shrink-0 text-brand-500" />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">A new version is available</p>
        <p className="text-[11px] text-ink-low">
          Reload to pick up the latest build.
        </p>
      </div>

      <Button size="sm" variant="primary" onClick={reload}>
        Reload
      </Button>

      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 rounded-sm p-1 text-ink-dim transition-colors hover:text-ink"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
