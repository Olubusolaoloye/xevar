import { useState } from 'react';
import { MIN_PASSWORD_LENGTH, useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';

interface AuthFormProps {
  /** Distinguishes the field ids when two forms are on one page. */
  idPrefix: string;
  /** What the primary button says in sign-up mode. */
  signUpLabel?: string;
  /** Shown above the tabs. */
  intro?: React.ReactNode;
  className?: string;
}

/**
 * Email and password, sign in or sign up.
 *
 * One component for every account in the product — developers submitting a
 * listing and readers posting a review are the same Supabase user, told apart
 * by what they are allowed to do rather than by which form they filled in.
 * Two separate account systems would mean two passwords for one person.
 *
 * The messages it shows are deliberately incurious: a wrong password and an
 * unknown address produce the same sentence, and signing up with an address
 * that already exists says the same thing as signing up with a new one. Each
 * of those distinctions, surfaced, turns the form into a way of asking the
 * product who has registered.
 */
export function AuthForm({
  idPrefix,
  signUpLabel = 'Create account',
  intro,
  className,
}: AuthFormProps) {
  const { signUp, signInWithPassword, resendConfirmation } = useAuthStore();

  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [resent, setResent] = useState(false);

  const ready = email.trim().length > 3 && password.length > 0 && !busy;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result =
      mode === 'up'
        ? await signUp(email, password)
        : await signInWithPassword(email, password);
    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? 'Something went wrong.');
      return;
    }
    if (mode === 'up' && 'needsConfirmation' in result && result.needsConfirmation) {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <Panel elevation="lifted" className={className}>
        <div className="space-y-3 p-6 text-center">
          <p className="font-display text-sm font-semibold text-ink">Check your inbox</p>
          <p className="text-xs leading-relaxed text-ink-low">
            If that address can be registered, a confirmation link is on its
            way. Open it and you will land back here, signed in.
          </p>

          {/* A way out, because this screen used to be one.

              The confirmation mail can genuinely fail to arrive — a project
              on the default mail service is rate-limited to a handful an hour
              and the rest are dropped — and the previous version of this
              screen left somebody staring at "check your inbox" with nothing
              to press. */}
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <Button
              size="sm"
              variant={resent ? 'primary' : 'outline'}
              disabled={busy || resent}
              onClick={() => {
                setBusy(true);
                void resendConfirmation(email).then((result) => {
                  setBusy(false);
                  if (result.ok) {
                    setResent(true);
                  } else {
                    setError(result.error ?? 'Could not send it again.');
                  }
                });
              }}
            >
              {resent ? 'Sent again' : busy ? 'Sending…' : 'Send it again'}
            </Button>

            <button
              type="button"
              onClick={() => {
                setSent(false);
                setResent(false);
                setError(null);
              }}
              className="text-[11px] text-ink-low underline underline-offset-2 hover:text-ink"
            >
              Use a different address
            </button>
          </div>

          {error && (
            <p className="rounded-sm border border-down/25 bg-down/10 px-3 py-2 text-xs text-down">
              {error}
            </p>
          )}
        </div>
      </Panel>
    );
  }

  return (
    <Panel elevation="lifted" className={className}>
      {intro}

      <div className="flex border-b border-line">
        {(['in', 'up'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setMode(value);
              setError(null);
            }}
            className={
              'flex-1 px-4 py-3 text-xs font-medium transition-colors ' +
              (mode === value
                ? 'border-b-2 border-brand-500 text-ink'
                : 'text-ink-low hover:text-ink-mid')
            }
          >
            {value === 'in' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>

      <div className="space-y-3 p-5">
        <div>
          <label
            htmlFor={`${idPrefix}-email`}
            className="mb-1.5 block text-xs font-medium text-ink-mid"
          >
            Email
          </label>
          <Input
            id={`${idPrefix}-email`}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            htmlFor={`${idPrefix}-password`}
            className="mb-1.5 block text-xs font-medium text-ink-mid"
          >
            Password
          </label>
          <Input
            id={`${idPrefix}-password`}
            type="password"
            autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && ready && void submit()}
          />
          {mode === 'up' && (
            <p className="mt-1 text-[11px] text-ink-dim">
              At least {MIN_PASSWORD_LENGTH} characters.
            </p>
          )}
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
          disabled={!ready}
          onClick={() => void submit()}
        >
          {busy ? 'Working…' : mode === 'up' ? signUpLabel : 'Sign in'}
        </Button>

        {/* Shown to everyone on the sign-in tab, never in response to a
            particular address. The error above says only "wrong email or
            password" on purpose — naming "this account is not confirmed"
            would answer whether an account exists — so this line carries the
            one explanation that message cannot. */}
        {mode === 'in' && (
          <p className="text-center text-[11px] leading-relaxed text-ink-dim">
            Just signed up and cannot get in? Your address may still need
            confirming — check your inbox, including spam.
          </p>
        )}
      </div>
    </Panel>
  );
}
