/// <reference types="vite/client" />

/** Injected by Vite at build time — see `define` in vite.config.ts. */
declare const __BUILD_ID__: string;

interface ImportMetaEnv {
  /** Supabase project URL. Public. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase publishable (anon) key. Public by design — RLS is the boundary. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Asset base path, set by the deploy workflow. */
  readonly VITE_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
