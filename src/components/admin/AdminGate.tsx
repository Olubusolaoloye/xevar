import { useEffect, useState, type ReactNode } from 'react';
import { KeyRound, Lock, ShieldAlert } from 'lucide-react';
import { sha256 } from '@/lib/hash';
import { useAdminStore } from '@/store/useAdminStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';

/** Unlock lasts for the tab session, so a reload does not re-prompt. */
const SESSION_KEY = 'panscreener.admin.unlocked';

/**
 * Passphrase gate for the admin screen.
 *
 * On first visit it asks for a passphrase to set. After that it asks for the
 * same passphrase to unlock, comparing hashes rather than plaintext.
 *
 * This keeps the admin controls out of the way of anyone casually browsing the
 * app. It is deliberately described in the UI as exactly that and not as
 * security: everything here runs in the visitor's own browser, so the check can
 * be bypassed by anyone who wants to. The app is read-only — the worst case is
 * someone editing their own copy of the token list — but the honest framing
 * matters, and the note below says so rather than implying protection the code
 * cannot provide.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const passHash = useAdminStore((s) => s.passHash);
  const setPassHash = useAdminStore((s) => s.setPassHash);

  const [unlocked, setUnlocked] = useState(false);
  const [value, setValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSetup = passHash === null;

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === '1') setUnlocked(true);
    } catch {
      // Private browsing can throw on sessionStorage; just stay locked.
    }
  }, []);

  const submit = async () => {
    setError(null);

    if (isSetup) {
      if (value.length < 6) {
        setError('Use at least 6 characters.');
        return;
      }
      if (value !== confirm) {
        setError('The two entries do not match.');
        return;
      }
      setBusy(true);
      setPassHash(await sha256(value));
      setBusy(false);
    } else {
      setBusy(true);
      const matches = (await sha256(value)) === passHash;
      setBusy(false);
      if (!matches) {
        setError('That passphrase is not right.');
        setValue('');
        return;
      }
    }

    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      // Not fatal — the unlock simply will not survive a reload.
    }
    setUnlocked(true);
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-20">
      <Panel elevation="lifted" className="overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <p className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
            <Lock className="h-4 w-4 text-brand-500" />
            {isSetup ? 'Set an admin passphrase' : 'Admin'}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-low">
            {isSetup
              ? 'Choose a passphrase for this browser. It is stored as a hash, never as text.'
              : 'Enter the passphrase to manage tokens, adverts and feed settings.'}
          </p>
        </div>

        <div className="space-y-3 p-5">
          <div>
            <label htmlFor="admin-pass" className="mb-1.5 block text-xs font-medium text-ink-mid">
              Passphrase
            </label>
            <Input
              id="admin-pass"
              type="password"
              value={value}
              autoFocus
              autoComplete={isSetup ? 'new-password' : 'current-password'}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && !isSetup && void submit()}
              icon={<KeyRound className="h-3.5 w-3.5" />}
            />
          </div>

          {isSetup && (
            <div>
              <label htmlFor="admin-confirm" className="mb-1.5 block text-xs font-medium text-ink-mid">
                Confirm
              </label>
              <Input
                id="admin-confirm"
                type="password"
                value={confirm}
                autoComplete="new-password"
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && void submit()}
              />
            </div>
          )}

          {error && (
            <p className="rounded-sm border border-down/25 bg-down/10 px-3 py-2 text-xs text-down">
              {error}
            </p>
          )}

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={busy || value.length === 0}
            onClick={() => void submit()}
          >
            {isSetup ? 'Set passphrase' : 'Unlock'}
          </Button>

          <p className="flex items-start gap-2 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-dim">
            <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0 text-warn" />
            This keeps the admin controls out of the way — it is not security.
            Everything runs in your browser, so the check can be bypassed by
            anyone determined. Nothing here can move funds; the app is read-only.
            Real access control needs these settings to live behind a server.
          </p>
        </div>
      </Panel>
    </div>
  );
}
