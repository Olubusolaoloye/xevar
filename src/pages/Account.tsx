import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Code2, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { hasBackend } from '@/lib/supabase';
import { MIN_PASSWORD_LENGTH, useAuthStore } from '@/store/useAuthStore';
import { AuthForm } from '@/components/auth/AuthForm';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { PageHeader } from '@/components/layout/PageHeader';

function ChangePassword() {
  const changePassword = useAuthStore((s) => s.changePassword);

  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await changePassword(password);
    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? 'Could not change your password.');
      return;
    }
    setPassword('');
    setDone(true);
    setTimeout(() => setDone(false), 3000);
  };

  return (
    <div className="space-y-3 p-4">
      <div>
        <label htmlFor="acct-password" className="mb-1.5 block text-xs font-medium text-ink-mid">
          New password
        </label>
        <Input
          id="acct-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && password.length >= MIN_PASSWORD_LENGTH && void submit()}
        />
        <p className="mt-1 text-[11px] text-ink-dim">
          At least {MIN_PASSWORD_LENGTH} characters.
        </p>
      </div>

      {error && (
        <p className="rounded-sm border border-down/25 bg-down/10 px-3 py-2 text-xs text-down">
          {error}
        </p>
      )}

      <Button
        size="sm"
        variant={done ? 'primary' : 'secondary'}
        disabled={busy || password.length < MIN_PASSWORD_LENGTH}
        onClick={() => void submit()}
      >
        {done ? 'Password changed' : busy ? 'Saving…' : 'Change password'}
      </Button>
    </div>
  );
}

/**
 * The account screen.
 *
 * One place to sign in, sign out or change a password. Before this, the only
 * sign-in forms were the ones embedded in whichever feature happened to need
 * an account — the developer screen and, later, the community panel — so
 * somebody who simply wanted to log in had to go and find a feature that would
 * ask them to.
 */
export function Account() {
  const email = useAuthStore((s) => s.email);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const ready = useAuthStore((s) => s.ready);
  const signOut = useAuthStore((s) => s.signOut);

  if (!hasBackend) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={<UserRound className="h-5 w-5" />}
          title="Accounts need the backend"
          description="This build has no Supabase project configured, so there is nothing to sign in to. Everything that does not need an account still works."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <PageHeader
        eyebrow="Account"
        title={email ? 'Your account' : 'Sign in'}
        description={
          email
            ? 'One account across PanScreener — rating tokens, and submitting a listing as a developer.'
            : 'One account across PanScreener. Rate and review tokens, and submit your own listing as a developer.'
        }
      />

      {!ready ? (
        <p className="mt-6 text-center text-sm text-ink-low">Checking your session…</p>
      ) : !email ? (
        <AuthForm idPrefix="acct" className="mx-auto mt-6 max-w-md overflow-hidden" />
      ) : (
        <div className="mt-5 space-y-4">
          <Panel className="overflow-hidden">
            <PanelHeader
              title="Signed in"
              icon={
                isAdmin ? (
                  <ShieldCheck className="h-4 w-4 text-brand-500" />
                ) : (
                  <UserRound className="h-4 w-4" />
                )
              }
              action={
                <Button size="sm" variant="outline" onClick={() => void signOut()}>
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </Button>
              }
            />
            <div className="flex flex-wrap items-center gap-2 px-4 py-3.5">
              <span className="truncate text-sm text-ink">{email}</span>
              {isAdmin && <Badge tone="up">Admin</Badge>}
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHeader title="Password" subtitle="Change it whenever you like" />
            <ChangePassword />
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHeader
              title="Listing a token?"
              subtitle="Submit your project with the same account"
              icon={<Code2 className="h-4 w-4" />}
              action={
                <Link to="/developer">
                  <Button size="sm" variant="ghost">
                    Open
                  </Button>
                </Link>
              }
            />
          </Panel>
        </div>
      )}
    </div>
  );
}
