import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { MIN_PASSWORD_LENGTH, useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

/**
 * Change the signed-in account's password.
 *
 * Exists so the first password — which someone else necessarily chose, since
 * the account had none — does not have to stay the password. It acts on the
 * caller's own session, so there is no account to aim it at but your own.
 */
export function ChangePassword() {
  const changePassword = useAuthStore((s) => s.changePassword);

  const [open, setOpen] = useState(false);
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const tooShort = next.length > 0 && next.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit =
    next.length >= MIN_PASSWORD_LENGTH && next === confirm && !busy;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await changePassword(next);
    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? 'Could not change the password.');
      return;
    }
    setNext('');
    setConfirm('');
    setDone(true);
    setOpen(false);
  };

  if (!open) {
    return (
      <div className="mx-auto max-w-5xl px-4 pt-3 sm:px-6">
        {done ? (
          <p className="text-[11px] text-up">Password changed.</p>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 text-[11px] text-ink-dim transition-colors hover:text-ink-mid"
          >
            <KeyRound className="h-3 w-3" />
            Change password
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pt-3 sm:px-6">
      <div className="space-y-3 rounded-md border border-line bg-surface px-4 py-3.5">
        <p className="text-xs font-medium text-ink-mid">Change password</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="pw-next" className="mb-1.5 block text-[11px] text-ink-low">
              New password
            </label>
            <Input
              id="pw-next"
              type="password"
              autoComplete="new-password"
              value={next}
              autoFocus
              onChange={(e) => {
                setNext(e.target.value);
                setError(null);
              }}
            />
          </div>
          <div>
            <label htmlFor="pw-confirm" className="mb-1.5 block text-[11px] text-ink-low">
              Confirm
            </label>
            <Input
              id="pw-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && canSubmit && void submit()}
            />
          </div>
        </div>

        {tooShort && (
          <p className="text-[11px] text-ink-dim">
            At least {MIN_PASSWORD_LENGTH} characters.
          </p>
        )}
        {mismatch && (
          <p className="text-[11px] text-down">Those two do not match.</p>
        )}
        {error && (
          <p className="rounded-sm border border-down/25 bg-down/10 px-3 py-2 text-xs text-down">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button size="sm" variant="primary" disabled={!canSubmit} onClick={() => void submit()}>
            {busy ? 'Saving…' : 'Save password'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setOpen(false);
              setNext('');
              setConfirm('');
              setError(null);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
