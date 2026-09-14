import { createClient } from '@supabase/supabase-js';

/**
 * The Supabase client.
 *
 * Both values are read from the environment and are safe to expose: the
 * publishable (anon) key is designed to sit in a browser bundle. It grants
 * exactly what row-level security allows and nothing more, which for this
 * project is "read everything, write nothing unless you are the allowlisted
 * admin". The key is not a secret; the policies are the security boundary.
 *
 * A service-role key would be a secret, and must never appear in this file or
 * anywhere else the client can reach.
 */
const url = import.meta.env.VITE_SUPABASE_URL ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

/**
 * Whether a backend is configured at all.
 *
 * The app has to work without one: a fork, a local checkout with no .env, or a
 * misconfigured deploy should still render the market board rather than a
 * blank page. Where this is false the app falls back to local-only storage and
 * says so in admin.
 */
export const hasBackend = Boolean(url && anonKey);

export const supabase = hasBackend
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // The magic link comes back as a URL fragment; this consumes it.
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Table and function names, defined once.
 *
 * Every name carries a `ps_` prefix because a Supabase project can host more
 * than one app in the same `public` schema, and bare names like `listings` or
 * `is_admin` are exactly the names a second app would claim too. Keeping them
 * here rather than inline means the prefix cannot drift out of step with
 * supabase/001_panscreener.sql one call site at a time.
 */
export const TABLES = {
  listings: 'ps_listings',
  adSlides: 'ps_ad_slides',
  appSettings: 'ps_app_settings',
} as const;

/** The server-side admin check. Admin status is never decided in the client. */
export const IS_ADMIN_RPC = 'ps_is_admin';

/** Row shapes, mirroring supabase/001_panscreener.sql. */
export interface ListingRow {
  id: string;
  chain: string;
  symbol: string;
  address: string | null;
  pair_address: string | null;
  label: string | null;
  category: string;
  note: string | null;
  logo_url: string | null;
  cover_url: string | null;
  blurb: string | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
  featured: boolean;
  position: number;
  created_at: string;
}

export interface AdSlideRow {
  id: string;
  eyebrow: string | null;
  title: string;
  body: string | null;
  cta_label: string | null;
  cta_href: string | null;
  image_url: string | null;
  sponsored: boolean;
  enabled: boolean;
  position: number;
}

export interface AppSettingsRow {
  id: number;
  poll_seconds: number;
  verdict_name: string;
  verdict_url_template: string;
  verdict_enabled: boolean;
}
