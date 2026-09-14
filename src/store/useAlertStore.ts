import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
}

/** Oldest events past this count are dropped — this is a log, not an archive. */
const MAX_EVENTS = 50;

/** Read the value an alert watches off a pair. */
export function readMetric(pair: Pair, metric: AlertMetric): number {
  switch (metric) {
    case 'price':
      return pair.priceUsd;
    case 'change24h':
      return pair.change.h24;
    case 'liquidity':
      return pair.liquidityUsd;
    case 'volume24h':
      return pair.volume.h24;
  }
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
        const { alerts, met } = get();
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
          if (!Number.isFinite(value)) continue;

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
