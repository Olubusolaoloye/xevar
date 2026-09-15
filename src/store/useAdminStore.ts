import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { hasBackend, supabase, TABLES, type AdSlideRow, type AppSettingsRow } from '@/lib/supabase';
import { parseCuratedTokens, type CuratedEntry } from '@/data/curatedList';

/**
 * A slide in the hero carousel.
 *
 * These are promotional placements, so they carry an explicit `sponsored` flag.
 * Paid content that does not look like paid content is the kind of thing that
 * costs a product its credibility, and in a market app it can mislead someone
 * into a position.
 */
export interface AdSlide {
  id: string;
  eyebrow?: string;
  title: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  /** Optional background image URL. */
  imageUrl?: string;
  sponsored: boolean;
  enabled: boolean;
  order: number;
}

/**
 * External contract-verdict provider.
 *
 * PanScreener does not audit contracts, and the market API exposes no safety
 * data, so verdicts come from a dedicated service. The URL is a template rather
 * than a hardcoded scheme because the provider's exact path format cannot be
 * confirmed from here — getting it wrong would send users to a dead link on
 * every token page.
 *
 * Placeholders: {address} {chain} {symbol} {pairAddress}
 */
export interface VerdictProvider {
  name: string;
  urlTemplate: string;
  enabled: boolean;
}

/**
 * Resolve a provider template for one token.
 *
 * Values are URL-encoded, so an odd symbol cannot break the link or inject
 * extra path segments.
 */
export function buildVerdictUrl(
  provider: VerdictProvider,
  token: { address: string; chain: string; symbol: string; pairAddress: string },
): string {
  return provider.urlTemplate
    .replace(/\{address\}/g, encodeURIComponent(token.address))
    .replace(/\{chain\}/g, encodeURIComponent(token.chain))
    .replace(/\{symbol\}/g, encodeURIComponent(token.symbol))
    .replace(/\{pairAddress\}/g, encodeURIComponent(token.pairAddress));
}

const DEFAULT_PROVIDER: VerdictProvider = {
  name: 'FatDev',
  // A starting guess, not a verified scheme — the admin screen shows a live
  // preview of the resulting link precisely so this can be corrected on sight.
  urlTemplate: 'https://fatdev.org/token/{address}',
  enabled: true,
};

/** The list's title until an admin renames it. */
export const DEFAULT_CURATED_NAME = 'SMC DAO';

const DEFAULT_SLIDES: AdSlide[] = [
  {
    id: 'slide-default',
    eyebrow: 'Live across 8 networks',
    title: 'Every pair. Every chain. One board.',
    body: 'PanScreener streams live DEX markets into a single instrument — price, depth, flow and risk signals, side by side, updating as they move.',
    ctaLabel: 'Open the screener',
    ctaHref: '/screener',
    sponsored: false,
    enabled: true,
    order: 0,
  },
];

interface AdminState {
  /**
   * SHA-256 of the passphrase. The plaintext is never stored, so reading
   * localStorage does not hand over the passphrase itself.
   */
  passHash: string | null;
  slides: AdSlide[];
  provider: VerdictProvider;
  /** How often the board refreshes, in seconds. */
  pollSeconds: number;
  /** Title of the curated watchlist every visitor sees once. */
  curatedName: string;
  /** Its members, by contract address. See data/curatedList.ts. */
  curatedTokens: CuratedEntry[];

  setPassHash: (hash: string | null) => void;
  addSlide: (slide: Omit<AdSlide, 'id' | 'order'>) => void;
  updateSlide: (id: string, patch: Partial<Omit<AdSlide, 'id'>>) => void;
  removeSlide: (id: string) => void;
  moveSlide: (id: string, direction: -1 | 1) => void;
  setProvider: (patch: Partial<VerdictProvider>) => void;
  setPollSeconds: (seconds: number) => void;
  setCuratedList: (patch: { name?: string; tokens?: CuratedEntry[] }) => void;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      passHash: null,
      slides: DEFAULT_SLIDES,
      provider: DEFAULT_PROVIDER,
      pollSeconds: 15,
      curatedName: DEFAULT_CURATED_NAME,
      // Empty without a backend. The roster is operator data, not a default:
      // seeding addresses into the bundle would put them on the watchlist of
      // anyone who self-hosts this, with no way for them to have chosen it.
      curatedTokens: [],

      setPassHash: (passHash) => set({ passHash }),

      addSlide: (slide) =>
        set((state) => ({
          slides: [
            ...state.slides,
            {
              ...slide,
              id: `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
              order: state.slides.length,
            },
          ],
        })),

      updateSlide: (id, patch) =>
        set((state) => ({
          slides: state.slides.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        })),

      removeSlide: (id) =>
        set((state) => ({ slides: state.slides.filter((s) => s.id !== id) })),

      moveSlide: (id, direction) =>
        set((state) => {
          const sorted = [...state.slides].sort((a, b) => a.order - b.order);
          const index = sorted.findIndex((s) => s.id === id);
          const target = index + direction;
          if (index < 0 || target < 0 || target >= sorted.length) return state;

          [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
          return { slides: sorted.map((s, i) => ({ ...s, order: i })) };
        }),

      setProvider: (patch) =>
        set((state) => ({ provider: { ...state.provider, ...patch } })),

      // Clamped: below 10s a public API starts rate-limiting, above 120s the
      // board stops feeling live.
      setPollSeconds: (seconds) =>
        set({ pollSeconds: Math.min(120, Math.max(10, Math.round(seconds))) }),

      setCuratedList: ({ name, tokens }) =>
        set((state) => ({
          curatedName: name ?? state.curatedName,
          curatedTokens: tokens ?? state.curatedTokens,
        })),
    }),
    { name: 'panscreener.admin' },
  ),
);


/* -------------------------------------------------------------------------- */
/* Backend sync                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Slides and settings live in Postgres when a backend is configured, so an
 * edit on one device shows up on every other one. Without a backend the
 * persisted local store above stays in charge.
 */

function slideFromRow(row: AdSlideRow): AdSlide {
  return {
    id: row.id,
    eyebrow: row.eyebrow ?? undefined,
    title: row.title,
    body: row.body ?? undefined,
    ctaLabel: row.cta_label ?? undefined,
    ctaHref: row.cta_href ?? undefined,
    imageUrl: row.image_url ?? undefined,
    sponsored: row.sponsored,
    enabled: row.enabled,
    order: row.position,
  };
}

function slideToRow(slide: Partial<AdSlide>) {
  const row: Record<string, unknown> = {};
  const put = (key: string, value: unknown) => {
    if (value !== undefined) row[key] = value === '' ? null : value;
  };
  put('eyebrow', slide.eyebrow ?? null);
  put('title', slide.title);
  put('body', slide.body ?? null);
  put('cta_label', slide.ctaLabel ?? null);
  put('cta_href', slide.ctaHref ?? null);
  put('image_url', slide.imageUrl ?? null);
  put('sponsored', slide.sponsored);
  put('enabled', slide.enabled);
  put('position', slide.order);
  return row;
}

let slideChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
let settingsChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;

export function startAdminSync() {
  if (!supabase || slideChannel) return;

  const loadSlides = async () => {
    const { data, error } = await supabase!
      .from(TABLES.adSlides)
      .select('*')
      .order('position', { ascending: true });
    if (error || !data) return;
    useAdminStore.setState({ slides: (data as AdSlideRow[]).map(slideFromRow) });
  };

  const loadSettings = async () => {
    const { data, error } = await supabase!
      .from(TABLES.appSettings)
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) return;

    const row = data as AppSettingsRow;
    useAdminStore.setState({
      pollSeconds: row.poll_seconds,
      provider: {
        name: row.verdict_name,
        urlTemplate: row.verdict_url_template,
        enabled: row.verdict_enabled,
      },
      // Tolerant of a project that has not run migration 003 yet: the columns
      // come back undefined, the list is empty, and the watchlist simply shows
      // nothing extra rather than throwing on every page load.
      curatedName: row.curated_list_name || DEFAULT_CURATED_NAME,
      curatedTokens: parseCuratedTokens(row.curated_list_tokens),
    });
  };

  void loadSlides();
  void loadSettings();

  slideChannel = supabase
    .channel('slides-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.adSlides },
        () => void loadSlides())
    .subscribe();

  settingsChannel = supabase
    .channel('settings-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.appSettings },
        () => void loadSettings())
    .subscribe();
}

export function stopAdminSync() {
  if (!supabase) return;
  if (slideChannel) {
    void supabase.removeChannel(slideChannel);
    slideChannel = null;
  }
  if (settingsChannel) {
    void supabase.removeChannel(settingsChannel);
    settingsChannel = null;
  }
}

export const adminBackend = {
  enabled: hasBackend,

  async addSlide(slide: Omit<AdSlide, 'id' | 'order'>) {
    if (!supabase) return useAdminStore.getState().addSlide(slide);
    const count = useAdminStore.getState().slides.length;
    await supabase.from(TABLES.adSlides).insert({ ...slideToRow(slide), position: count });
  },

  async updateSlide(id: string, patch: Partial<AdSlide>) {
    if (!supabase) return useAdminStore.getState().updateSlide(id, patch);
    await supabase.from(TABLES.adSlides).update(slideToRow(patch)).eq('id', id);
  },

  async removeSlide(id: string) {
    if (!supabase) return useAdminStore.getState().removeSlide(id);
    await supabase.from(TABLES.adSlides).delete().eq('id', id);
  },

  async moveSlide(id: string, direction: -1 | 1) {
    if (!supabase) return useAdminStore.getState().moveSlide(id, direction);

    const ordered = [...useAdminStore.getState().slides].sort((a, b) => a.order - b.order);
    const index = ordered.findIndex((s) => s.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;

    await Promise.all([
      supabase.from(TABLES.adSlides).update({ position: target }).eq('id', ordered[index].id),
      supabase.from(TABLES.adSlides).update({ position: index }).eq('id', ordered[target].id),
    ]);
  },

  async setProvider(patch: Partial<VerdictProvider>) {
    if (!supabase) return useAdminStore.getState().setProvider(patch);
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.verdict_name = patch.name;
    if (patch.urlTemplate !== undefined) row.verdict_url_template = patch.urlTemplate;
    if (patch.enabled !== undefined) row.verdict_enabled = patch.enabled;
    await supabase.from(TABLES.appSettings).update(row).eq('id', 1);
  },

  async setCuratedList(patch: { name?: string; tokens?: CuratedEntry[] }) {
    if (!supabase) return useAdminStore.getState().setCuratedList(patch);
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.curated_list_name = patch.name.trim() || DEFAULT_CURATED_NAME;
    if (patch.tokens !== undefined) row.curated_list_tokens = patch.tokens;
    if (Object.keys(row).length === 0) return;
    const { error } = await supabase.from(TABLES.appSettings).update(row).eq('id', 1);
    return error ? { ok: false as const, error: error.message } : { ok: true as const };
  },

  async setPollSeconds(seconds: number) {
    const clamped = Math.min(120, Math.max(10, Math.round(seconds)));
    if (!supabase) return useAdminStore.getState().setPollSeconds(clamped);
    await supabase.from(TABLES.appSettings).update({ poll_seconds: clamped }).eq('id', 1);
  },
};
