import { useEffect, useState, type ReactNode } from 'react';
import { LogOut, Mail, ShieldAlert, ShieldCheck } from 'lucide-react';
import { hasBackend } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';

/**
 * Admin sign-in.
 *
 * A magic link rather than a password: there is no secret to store, transmit,
 * reuse or leak, and a link that expires is a smaller target than a password
 * that does not.
 *
 * The important part is what is NOT here. This component decides what to
 * render; it does not decide who may write. That is enforced by row-level
 * security in Postgres, so a modified bundle that skipped this screen entirely
 * would still have every write rejected by the database.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const { email, isAdmin, ready, init, signIn, signOut } = useAuthStore();

  const [value, setValue] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    init();
  }, [init]);

  // Without a backend there is nothing global to protect: settings are local to
  // this browser, so a gate would be theatre.
  if (!hasBackend) {
    return (
      <>
        <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
          <p className="flex items-start gap-2 rounded-md border border-warn/25 bg-warn/10 px-3.5 py-3 text-[11px] leading-relaxed text-warn">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            No backend is configured, so these settings are stored in this
            browser only and are not shared with anyone else. Set
            VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to make them global.
          </p>
        </div>
        {children}
      </>
    );
  }

  if (!ready) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-sm text-ink-low">Checking your session…</p>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 pt-6 sm:px-6">
          <p className="flex items-center gap-2 text-[11px] text-ink-low">
            <ShieldCheck className="h-3.5 w-3.5 text-up" />
            Signed in as <span className="font-mono text-ink-mid">{email}</span>
          </p>
          <Button size="sm" variant="ghost" onClick={() => void signOut()}>
            <LogOut className="h-3 w-3" />
            Sign out
          </Button>
        </div>
        {children}
      </>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await signIn(value);
    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? 'Could not send the link.');
      return;
    }
    setSent(true);
  };

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-20">
      <Panel elevation="lifted" className="overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <p className="font-display text-sm font-semibold text-ink">Admin</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-low">
            {email
              ? 'That account is signed in but is not the admin.'
              : 'Sign in to manage listings, adverts and settings.'}
          </p>
        </div>

        <div className="space-y-3 p-5">
          {sent ? (
            <div className="rounded-md border border-up/25 bg-up/8 px-3.5 py-3">
              <p className="text-sm font-medium text-up">Check your inbox</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-mid">
                If that address is the admin, a sign-in link is on its way. Open
                it on any device and you will be signed in there.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="admin-email" className="mb-1.5 block text-xs font-medium text-ink-mid">
                  Admin email
                </label>
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  value={value}
                  autoFocus
                  onChange={(e) => {
                    setValue(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && void submit()}
                  icon={<Mail className="h-3.5 w-3.5" />}
                  placeholder="you@example.com"
                />
              </div>

              {error && (
                <p className="rounded-sm border border-down/25 bg-down/10 px-3 py-2 text-xs text-down">
                  {error}
                </p>
              )}

              <Button
                variant="primary"
                size="lg"
                className="w-full"
                disabled={busy || value.trim().length < 3}
                onClick={() => void submit()}
              >
                {busy ? 'Sending…' : 'Email me a sign-in link'}
              </Button>
            </>
          )}

          {email && !isAdmin && (
            <Button variant="ghost" size="sm" className="w-full" onClick={() => void signOut()}>
              Sign out of {email}
            </Button>
          )}

          <p className="flex items-start gap-2 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-dim">
            <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-up" />
            One address is allowed to write, and that rule lives in the database.
            Editing the app in your browser cannot get around it — every write is
            checked server-side before it is accepted.
          </p>
        </div>
      </Panel>
    </div>
  );
}
