import { NavLink } from 'react-router-dom';
import { LogIn, ShieldCheck, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hasBackend } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * The account row at the foot of the navigation.
 *
 * One control with two faces: an invitation when signed out, an identity when
 * signed in. Both go to the same screen, so there is one place to sign in,
 * sign out or change a password rather than a sign-in form hidden inside
 * whichever feature happens to need one.
 *
 * The handle shown is the part of the address before the @ — the same
 * shortening the review list uses, so somebody recognises their own comments
 * as theirs. A full address in a sidebar is also the one thing on screen worth
 * shoulder-surfing.
 */
export function AccountLink({ collapsed = false }: { collapsed?: boolean }) {
  const email = useAuthStore((s) => s.email);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const ready = useAuthStore((s) => s.ready);

  // Without a backend there are no accounts to sign in to, and a button that
  // leads to a page explaining that is worse than no button.
  if (!hasBackend) return null;

  const handle = email ? email.split('@')[0] : null;

  return (
    <NavLink
      to="/account"
      title={collapsed ? (handle ?? 'Sign in') : undefined}
      aria-label={handle ? `Account: ${handle}` : 'Sign in or create an account'}
      className={({ isActive }) =>
        cn(
          'flex items-center rounded-md text-sm font-medium transition-colors duration-150',
          collapsed ? 'h-9 w-9 justify-center' : 'h-9 gap-2.5 px-2.5',
          isActive
            ? 'bg-raised text-ink'
            : handle
              ? 'text-ink-low hover:bg-raised hover:text-ink'
              // Signed out it is the one thing here worth pressing, so it
              // carries the brand rather than sitting at the same weight as
              // Settings beside it.
              : 'bg-brand-500/10 text-brand-500 hover:bg-brand-500/15',
        )
      }
    >
      {handle ? (
        isAdmin ? (
          <ShieldCheck className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
        ) : (
          <UserRound className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
        )
      ) : (
        <LogIn className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
      )}

      {!collapsed && (
        <>
          {/* `ready` guards a flash of "Sign in" on every load before the
              stored session has been read back. */}
          <span className="truncate">
            {!ready ? ' ' : (handle ?? 'Sign in')}
          </span>
          {handle && isAdmin && (
            <span className="ml-auto shrink-0 rounded-xs bg-brand-500/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-brand-500">
              Admin
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}
