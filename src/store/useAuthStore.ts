import { create } from 'zustand';
import { hasBackend, supabase, IS_ADMIN_RPC } from '@/lib/supabase';

/** Shortest password this form will submit. Supabase enforces its own floor
 *  server-side too; this is the stricter of the two, checked early so the user
 *  finds out before a round trip. */
export const MIN_PASSWORD_LENGTH = 10;

interface AuthState {
  email: string | null;
  /** True once the initial session lookup has finished. */
  ready: boolean;
  /**
   * Whether this account may write.
   *
   * Determined by asking the database, never by comparing an email in the
   * client. The client's answer is a convenience for hiding controls; the
   * database's answer is the one that governs what actually happens.
   */
  isAdmin: boolean;

  init: () => void;
  signInWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  sendLink: (email: string) => Promise<{ ok: boolean; error?: string }>;
  changePassword: (password: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

let unsubscribe: (() => void) | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  email: null,
  ready: !hasBackend,
  isAdmin: false,

  init: () => {
    if (!supabase || unsubscribe) return;

    const resolve = async (email: string | null) => {
      if (!email) {
        set({ email: null, isAdmin: false, ready: true });
        return;
      }

      // Ask Postgres whether this session is the admin. Deciding it here from
      // the email string would be a client-side check that a modified bundle
      // could flip; the database function is authoritative.
      const { data, error } = await supabase.rpc(IS_ADMIN_RPC);
      set({ email, isAdmin: error ? false : Boolean(data), ready: true });
    };

    void supabase.auth
      .getSession()
      .then(({ data }) => resolve(data.session?.user.email ?? null));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void resolve(session?.user.email ?? null);
    });
    unsubscribe = () => listener.subscription.unsubscribe();
  },

  signInWithPassword: async (email, password) => {
    if (!supabase) return { ok: false, error: 'No backend is configured.' };

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      // One message for both a wrong address and a wrong password. Saying
      // which was wrong would confirm whether an account exists, turning this
      // form into an account-enumeration oracle.
      return { ok: false, error: 'Wrong email or password.' };
    }
    return { ok: true };
  },

  sendLink: async (email) => {
    if (!supabase) return { ok: false, error: 'No backend is configured.' };

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        // Come back to the admin screen, wherever the app is hosted.
        emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}admin`,
        // Never create an account for an unknown address. Without this, anyone
        // could sign up — they still could not write anything, but a stranger
        // holding a session on the admin screen is needless noise.
        shouldCreateUser: false,
      },
    });

    if (error) {
      return {
        ok: false,
        error: 'Could not send a sign-in link. Check the address and try again.',
      };
    }
    return { ok: true };
  },

  changePassword: async (password) => {
    if (!supabase) return { ok: false, error: 'No backend is configured.' };
    if (password.length < MIN_PASSWORD_LENGTH) {
      return {
        ok: false,
        error: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
      };
    }

    // Acts on the caller's own session — there is no user id to pass and no
    // way to aim this at another account.
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      // Surfaced as-is: this one is not an enumeration risk (you are already
      // signed in) and the reason is usually actionable, e.g. a password the
      // server rejected as too weak or one already in use.
      return { ok: false, error: error.message };
    }
    return { ok: true };
  },

  signOut: async () => {
    await supabase?.auth.signOut();
    set({ email: null, isAdmin: false });
    void get();
  },
}));
