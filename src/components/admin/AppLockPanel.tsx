import { useEffect, useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { DEFAULT_LOCK_MESSAGE, DEFAULT_LOCK_TITLE } from '@/data/appLock';
import { adminBackend, useAdminStore } from '@/store/useAdminStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PanelHeader } from '@/components/ui/Panel';

/**
 * Close the app.
 *
 * Confirmed rather than a bare toggle, because this is the one control here
 * that takes the product away from everybody at once, and a switch that big
 * should cost more than a stray tap.
 */
export function AppLockPanel() {
  const locked = useAdminStore((s) => s.locked);
  const storedTitle = useAdminStore((s) => s.lockTitle);
  const storedMessage = useAdminStore((s) => s.lockMessage);

  const [title, setTitle] = useState(storedTitle);
  const [message, setMessage] = useState(storedMessage);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Another admin session, or another device, changes it. Adopt it.
  useEffect(() => setTitle(storedTitle), [storedTitle]);
  useEffect(() => setMessage(storedMessage), [storedMessage]);

  const dirty = title !== storedTitle || message !== storedMessage;

  const run = async (patch: Parameters<typeof adminBackend.setLock>[0]) => {
    setBusy(true);
    setError(null);
    const result = await adminBackend.setLock(patch);
    setBusy(false);
    setConfirming(false);
    if (result && !result.ok) setError(result.error);
  };

  return (
    <div>
      <PanelHeader
        title="Availability"
        subtitle={locked ? 'The app is closed' : 'The app is open'}
        icon={
          locked ? (
            <Lock className="h-4 w-4 text-warn" />
          ) : (
            <Unlock className="h-4 w-4" />
          )
        }
      />

      <div className="space-y-3 p-4">
        <div
          className={
            locked
              ? 'rounded-sm border border-warn/25 bg-warn/10 px-3 py-2.5 text-xs leading-relaxed text-warn'
              : 'rounded-sm border border-line bg-sunken px-3 py-2.5 text-xs leading-relaxed text-ink-low'
          }
        >
          {locked ? (
            <>
              Everyone except you sees the coming-soon screen. The board,
              adverts and reviews are also unreadable through the API while
              this is on — the lock is enforced by the database, not just by
              the page.
            </>
          ) : (
            <>
              Closing the app shows a coming-soon screen to every visitor and
              makes the board unreadable through the API. You keep full access,
              and the sign-in and admin screens stay reachable so you can
              reopen it.
            </>
          )}
        </div>

        <div>
          <label htmlFor="lock-title" className="mb-1 block text-[11px] text-ink-mid">
            Headline
          </label>
          <Input
            id="lock-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={DEFAULT_LOCK_TITLE}
          />
        </div>

        <div>
          <label htmlFor="lock-message" className="mb-1 block text-[11px] text-ink-mid">
            Message
          </label>
          <textarea
            id="lock-message"
            value={message}
            rows={3}
            maxLength={280}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={DEFAULT_LOCK_MESSAGE}
            className="w-full resize-y rounded-md border border-line bg-sunken px-2.5 py-2 text-xs text-ink placeholder:text-ink-dim focus:border-brand-500/50 focus:outline-none"
          />
        </div>

        {dirty && (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => void run({ title, message })}
          >
            {busy ? 'Saving…' : 'Save wording'}
          </Button>
        )}

        {error && (
          <p className="rounded-sm border border-down/25 bg-down/10 px-3 py-2 text-xs text-down">
            {error}
          </p>
        )}

        <div className="border-t border-line pt-3">
          {locked ? (
            <Button
              size="sm"
              variant="primary"
              disabled={busy}
              onClick={() => void run({ locked: false })}
            >
              <Unlock className="h-3.5 w-3.5" />
              {busy ? 'Working…' : 'Reopen the app'}
            </Button>
          ) : confirming ? (
            <div className="space-y-2">
              <p className="text-xs leading-relaxed text-ink-mid">
                This closes PanScreener for every visitor immediately. Sure?
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy}
                  onClick={() => void run({ locked: true })}
                >
                  {busy ? 'Closing…' : 'Close the app'}
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
              <Lock className="h-3.5 w-3.5" />
              Close the app
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
