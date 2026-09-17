import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuthStore } from '@/store/useAuthStore';
import type { Alert, AlertMetric, Pair } from '@/data/types';

/* -------------------------------------------------------------------------- */
/* Firing history                                                             */
/* -------------------------------------------------------------------------- */

export interface AlertEvent {
  id: string;
  alertId: string;
  pairId: string;
  pairLabel: string;
  metric: AlertMetric;
  comparator: 'above' | 'below';
  threshold: number;
  /** The value that crossed the threshold, recorded at the moment it did. */
  value: number;
  at: number;
  read: boolean;
  /**
   * How the server actually delivered it.
   *
   * Only present on alerts evaluated server-side — a local alert has no
   * channels to report, and saying "push: false" about one would suggest a
   * delivery was attempted and failed rather than never applying.
   */
  delivery?: {
    push: boolean;
    email: boolean;
    /** Why a channel did not go out, when one did not. */
    note?: string;
  };
}

/** Oldest events past this count are dropped — this is a log, not an archive. */
const MAX_EVENTS = 50;

export const ALERT_METRIC_LABEL: Record<AlertMetric, string> = {
  price: 'Price',
  marketCap: 'Market cap',
  change24h: '24h change',
  liquidity: 'Liquidity',
  volume24h: '24h volume',
};

/** Read the value an alert watches off a pair. */
export function readMetric(pair: Pair, metric: AlertMetric): number {
  switch (metric) {
    case 'price':
      return pair.priceUsd;
    case 'marketCap':
      return pair.marketCap;
    case 'change24h':
      return pair.change.h24;
    case 'liquidity':
      return pair.liquidityUsd;
    case 'volume24h':
      return pair.volume.h24;
  }
}

/**
 * How a threshold for this metric should be written.
 *
 * `percent` is the odd one out — every other metric is an amount of money.
 * Price gets its own treatment because a memecoin trades at 0.00000004 and a
 * compact "$0.0" would round the whole thing away.
 */
export function metricFormat(metric: AlertMetric): 'percent' | 'price' | 'money' {
  if (metric === 'change24h') return 'percent';
  if (metric === 'price') return 'price';
  return 'money';
}

/**
 * Whether the provider actually reported this metric.
 *
 * Only price and market cap treat zero as absent, and the distinction is the
 * point. DexScreener sends 0 when it has neither a market cap nor an FDV, so a
 * "market cap below 5,000,000" alert would fire the instant it saw any token
 * it has no figure for. Liquidity, volume and 24h change are different: zero
 * liquidity is a drained pool and zero volume is a day with no trades, and an
 * alert watching for either is watching for exactly that.
 */
export function metricIsReported(metric: AlertMetric, value: number): boolean {
  if (!Number.isFinite(value)) return false;
  if (metric === 'price' || metric === 'marketCap') return value > 0;
  return true;
}

/** Whether a value satisfies an alert's condition right now. */
export function conditionMet(alert: Alert, value: number): boolean {
  return alert.comparator === 'above'
    ? value > alert.threshold
    : value < alert.threshold;
}

interface AlertState {
  alerts: Alert[];
  events: AlertEvent[];
  /**
   * Whether each alert's condition was satisfied at the last evaluation.
   *
   * This is what makes firing edge-triggered rather than level-triggered: an
   * alert fires on the transition into its condition, then stays quiet until
   * the condition clears and is entered again. Without it, a price sitting one
   * cent above a threshold would fire on every single poll.
   *
   * Deliberately not persisted. On a fresh load nothing has been "seen" yet,
   * and a condition that is already true then is a state, not an event — the
   * list shows it as met without claiming it just happened.
   */
  met: Record<string, boolean>;

  /**
   * Whether the server owns evaluation for this session.
   *
   * True once a signed-in account's alerts have been loaded from Postgres.
   * While it is true this store stops evaluating locally — the dispatcher is
   * already doing it every minute, and both running would fire twice for the
   * same crossing: once as a push and once as a desktop notice.
   */
  serverMode: boolean;

  addAlert: (alert: Omit<Alert, 'id' | 'createdAt'>) => void;
  toggleAlert: (id: string) => void;
  removeAlert: (id: string) => void;

  /** Check every enabled alert against the current board. */
  evaluate: (pairs: Pair[]) => void;

  markEventsRead: () => void;
  clearEvents: () => void;
}

/**
 * Ask the browser to show a notification, if the user has allowed it.
 *
 * Best-effort on purpose: permission may be denied, the API may be missing
 * (older browsers, insecure origins), and a page in the background may have
 * its notifications suppressed by the OS. None of that should break firing —
 * the in-app event log is the source of truth and always records the event.
 */
function notify(event: AlertEvent, body: string) {
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    new Notification(`${event.pairLabel} — alert`, {
      body,
      tag: event.alertId, // replaces an earlier notice for the same alert
    });
  } catch {
    // A browser that throws here simply does not get desktop notifications.
  }
}

const id = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const useAlertStore = create<AlertState>()(
  persist(
    (set, get) => ({
      alerts: [],
      events: [],
      met: {},
      serverMode: false,

      addAlert: (alert) =>
        set((state) => ({
          alerts: [
            { ...alert, id: id('a'), createdAt: Date.now() },
            ...state.alerts,
          ],
        })),

      toggleAlert: (id) =>
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === id ? { ...a, enabled: !a.enabled } : a,
          ),
          // Re-arm on toggle: switching an alert back on should not
          // immediately fire for a condition that was true while it was off.
          met: { ...state.met, [id]: false },
        })),

      removeAlert: (id) =>
        set((state) => ({
          alerts: state.alerts.filter((a) => a.id !== id),
          events: state.events.filter((e) => e.alertId !== id),
        })),

      evaluate: (pairs) => {
        const { alerts, met, serverMode } = get();
        /* The dispatcher is evaluating these every minute against the same
           rules (data/alertRules.ts is shared verbatim), so evaluating again
           here would fire twice for one crossing — a push and a desktop
           notice, seconds apart, saying the same thing. */
        if (serverMode) return;
        if (alerts.length === 0 || pairs.length === 0) return;

        const nextMet: Record<string, boolean> = { ...met };
        const fired: AlertEvent[] = [];

        for (const alert of alerts) {
          if (!alert.enabled) {
            nextMet[alert.id] = false;
            continue;
          }

          const pair = pairs.find((p) => p.id === alert.pairId);
          if (!pair) {
            // The pair dropped off the board. Leave the previous state alone
            // rather than treating "unknown" as "condition cleared", which
            // would re-fire the moment it came back.
            continue;
          }

          const value = readMetric(pair, alert.metric);
          // An unreported metric is unknown, not zero. Leave the previous
          // state alone rather than treating it as a reading, for the same
          // reason a pair that drops off the board does not re-arm.
          if (!metricIsReported(alert.metric, value)) continue;

          const now = conditionMet(alert, value);
          const before = met[alert.id] ?? false;
          nextMet[alert.id] = now;

          // The edge: not satisfied last time, satisfied now.
          if (now && !before) {
            fired.push({
              id: id('e'),
              alertId: alert.id,
              pairId: alert.pairId,
              pairLabel: alert.pairLabel,
              metric: alert.metric,
              comparator: alert.comparator,
              threshold: alert.threshold,
              value,
              at: Date.now(),
              read: false,
            });
          }
        }

        if (fired.length === 0) {
          set({ met: nextMet });
          return;
        }

        const firedIds = new Set(fired.map((e) => e.alertId));
        set((state) => ({
          met: nextMet,
          events: [...fired, ...state.events].slice(0, MAX_EVENTS),
          alerts: state.alerts.map((a) =>
            firedIds.has(a.id) ? { ...a, triggeredAt: Date.now() } : a,
          ),
        }));

        for (const event of fired) {
          notify(
            event,
            `${event.metric} ${event.comparator} ${event.threshold}`,
          );
        }
      },

      markEventsRead: () =>
        set((state) => ({
          events: state.events.map((e) => ({ ...e, read: true })),
        })),

      clearEvents: () => set({ events: [] }),
    }),
    {
      name: 'panscreener.alerts',
      // `met` is deliberately excluded: see the field's comment.
      partialize: (state) => ({ alerts: state.alerts, events: state.events }),
    },
  ),
);

/** Count of alerts that have fired and not yet been looked at. */
export function selectUnreadCount(state: AlertState): number {
  return state.events.filter((e) => !e.read).length;
}

/* -------------------------------------------------------------------------- */
/* Server sync                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Hand evaluation to the server for a signed-in account, or take it back.
 *
 * Called whenever the session changes. Signing in replaces the local list with
 * the account's server alerts and stops local evaluation; signing out restores
 * whatever was persisted in this browser, which is the whole point of keeping
 * the local path alive.
 *
 * `serverMode` is only set once alerts have actually arrived. A failed load
 * leaves the store local, so a network blip degrades to "alerts still work in
 * this tab" rather than to "alerts silently stopped".
 */
export async function syncAlertsWithAccount(signedIn: boolean) {
  if (!signedIn) {
    useAlertStore.setState({ serverMode: false, met: {} });
    // The persisted local alerts are still in storage; rehydrate them so
    // signing out does not leave an empty list on screen.
    void useAlertStore.persist?.rehydrate?.();
    return;
  }

  const { alertBackend } = await import('./alertBackend');
  const loaded = await alertBackend.list();
  if (!loaded) return;

  useAlertStore.setState({
    alerts: loaded.alerts,
    events: loaded.events,
    serverMode: true,
    met: {},
  });
}

/** Re-read the account's alerts and firing history. */
export async function refreshServerAlerts() {
  if (!useAlertStore.getState().serverMode) return;
  const { alertBackend } = await import('./alertBackend');
  const loaded = await alertBackend.list();
  if (loaded) useAlertStore.setState({ alerts: loaded.alerts, events: loaded.events });
}

/* -------------------------------------------------------------------------- */
/* One set of actions, two destinations                                       */
/* -------------------------------------------------------------------------- */

/**
 * What the UI calls, regardless of where the alert actually lives.
 *
 * Without this every screen touching an alert would need to know whether the
 * session is signed in and branch on it, and the day one of them forgot would
 * be the day somebody's alert silently saved to the wrong place.
 */
export const alertActions = {
  async add(alert: Omit<Alert, 'id' | 'createdAt'>): Promise<{ ok: boolean; error?: string }> {
    if (!useAlertStore.getState().serverMode) {
      useAlertStore.getState().addAlert(alert);
      return { ok: true };
    }

    const userId = useAuthStore.getState().userId;
    if (!userId) return { ok: false, error: 'Sign in again to save this alert.' };

    const { alertBackend } = await import('./alertBackend');
    const result = await alertBackend.add(userId, alert);
    if (result.ok) await refreshServerAlerts();
    return result;
  },

  async toggle(id: string) {
    const state = useAlertStore.getState();
    if (!state.serverMode) return state.toggleAlert(id);

    const alert = state.alerts.find((a) => a.id === id);
    if (!alert) return;

    // Applied locally first so the switch moves under the finger; the refresh
    // below reconciles with whatever the database actually stored.
    useAlertStore.setState({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
    });

    const { alertBackend } = await import('./alertBackend');
    await alertBackend.toggle(id, !alert.enabled);
    await refreshServerAlerts();
  },

  async remove(id: string) {
    const state = useAlertStore.getState();
    if (!state.serverMode) return state.removeAlert(id);

    useAlertStore.setState({ alerts: state.alerts.filter((a) => a.id !== id) });
    const { alertBackend } = await import('./alertBackend');
    await alertBackend.remove(id);
    await refreshServerAlerts();
  },

  async markEventsRead() {
    const state = useAlertStore.getState();
    state.markEventsRead();
    if (!state.serverMode) return;
    const { alertBackend } = await import('./alertBackend');
    await alertBackend.markEventsRead();
  },

  async clearEvents() {
    const state = useAlertStore.getState();
    state.clearEvents();
    if (!state.serverMode) return;
    const { alertBackend } = await import('./alertBackend');
    await alertBackend.clearEvents();
  },
};
