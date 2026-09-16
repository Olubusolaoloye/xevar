import { supabase, TABLES } from '@/lib/supabase';
import type { Alert, AlertMetric, ChainId } from '@/data/types';
import type { AlertEvent } from '@/store/useAlertStore';

/**
 * Alerts stored on the server, for signed-in accounts.
 *
 * The distinction that matters: a local alert is evaluated by the tab that
 * created it, so it only fires while somebody is already looking at the price.
 * A server alert is evaluated every minute by the dispatcher whether or not
 * anything is open, which is what lets it reach a phone.
 *
 * Signed-out visitors keep their local alerts untouched. There is no way to
 * push to a device the app has never met, and taking a working feature away
 * from everyone without an account to tidy up the code would be a poor trade.
 */

interface AlertRow {
  id: string;
  pair_id: string;
  pair_label: string;
  chain: string;
  metric: string;
  comparator: string;
  threshold: number;
  enabled: boolean;
  created_at: string;
  last_fired_at: string | null;
}

interface DeliveryRow {
  id: string;
  alert_id: string | null;
  pair_id: string;
  pair_label: string;
  metric: string;
  comparator: string;
  threshold: number;
  value: number;
  fired_at: string;
  push_sent: boolean;
  email_sent: boolean;
  note: string | null;
  read: boolean;
}

function toAlert(row: AlertRow): Alert {
  return {
    id: row.id,
    pairId: row.pair_id,
    pairLabel: row.pair_label,
    chain: row.chain as ChainId,
    metric: row.metric as AlertMetric,
    comparator: row.comparator as Alert['comparator'],
    threshold: row.threshold,
    enabled: row.enabled,
    createdAt: Date.parse(row.created_at),
    triggeredAt: row.last_fired_at ? Date.parse(row.last_fired_at) : undefined,
  };
}

/** A delivery is the server's version of a fired event. */
function toEvent(row: DeliveryRow): AlertEvent {
  return {
    id: row.id,
    alertId: row.alert_id ?? row.id,
    pairId: row.pair_id,
    pairLabel: row.pair_label,
    metric: row.metric as AlertMetric,
    comparator: row.comparator as Alert['comparator'],
    threshold: row.threshold,
    value: row.value,
    at: Date.parse(row.fired_at),
    read: row.read,
    /** How it actually reached them, which only a server alert can report. */
    delivery: {
      push: row.push_sent,
      email: row.email_sent,
      note: row.note ?? undefined,
    },
  };
}

export const alertBackend = {
  async list(): Promise<{ alerts: Alert[]; events: AlertEvent[] } | null> {
    if (!supabase) return null;

    const [alertResult, deliveryResult] = await Promise.all([
      supabase
        .from(TABLES.alerts)
        .select('id,pair_id,pair_label,chain,metric,comparator,threshold,enabled,created_at,last_fired_at')
        .order('created_at', { ascending: false }),
      supabase
        .from(TABLES.alertDeliveries)
        .select('id,alert_id,pair_id,pair_label,metric,comparator,threshold,value,fired_at,push_sent,email_sent,note,read')
        .order('fired_at', { ascending: false })
        .limit(50),
    ]);

    // A failed read returns null rather than empty lists: blanking somebody's
    // alerts because the network hiccuped would look exactly like losing them.
    if (alertResult.error) return null;

    return {
      alerts: ((alertResult.data ?? []) as AlertRow[]).map(toAlert),
      events: ((deliveryResult.data ?? []) as DeliveryRow[]).map(toEvent),
    };
  },

  async add(
    userId: string,
    alert: Omit<Alert, 'id' | 'createdAt'>,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!supabase) return { ok: false, error: 'No backend is configured.' };

    const { error } = await supabase.from(TABLES.alerts).insert({
      user_id: userId,
      pair_id: alert.pairId,
      pair_label: alert.pairLabel,
      chain: alert.chain,
      metric: alert.metric,
      comparator: alert.comparator,
      threshold: alert.threshold,
      enabled: alert.enabled,
    });

    return error ? { ok: false, error: 'Could not save that alert.' } : { ok: true };
  },

  async toggle(id: string, enabled: boolean) {
    if (!supabase) return;
    // The database re-arms the alert when it is switched back on, so a
    // condition that was already true while it was off does not fire the
    // instant it returns.
    await supabase.from(TABLES.alerts).update({ enabled }).eq('id', id);
  },

  async remove(id: string) {
    if (!supabase) return;
    await supabase.from(TABLES.alerts).delete().eq('id', id);
  },

  async markEventsRead() {
    if (!supabase) return;
    await supabase.from(TABLES.alertDeliveries).update({ read: true }).eq('read', false);
  },

  async clearEvents() {
    if (!supabase) return;
    // Bounded by the owner's own RLS policy: this deletes their rows, nobody
    // else's, whatever the filter says.
    await supabase.from(TABLES.alertDeliveries).delete().neq('id', '');
  },
};
