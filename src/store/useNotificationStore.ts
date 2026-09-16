import { create } from 'zustand';
import { supabase, TABLES } from '@/lib/supabase';
import { disablePush, enablePush, pushEnabledHere, pushSupport, type PushSupport } from '@/lib/push';

/**
 * Notification channels for the signed-in account.
 *
 * Two different kinds of state live here and it is worth keeping them apart.
 * `pushEnabled` and `emailEnabled` are the account's wishes, stored in
 * Postgres and true on every device. `deviceSubscribed` is about this browser
 * alone — whether it holds a push subscription — and a person can perfectly
 * well want push while sitting at a machine that has never been asked.
 */

interface NotificationState {
  pushEnabled: boolean;
  emailEnabled: boolean;
  /** Null means "the address on the account". */
  emailAddress: string | null;
  /** Whether this particular browser is registered to receive push. */
  deviceSubscribed: boolean;
  support: PushSupport;
  loading: boolean;
  error: string | null;
}

export const useNotificationStore = create<NotificationState>(() => ({
  pushEnabled: true,
  emailEnabled: true,
  emailAddress: null,
  deviceSubscribed: false,
  support: 'unsupported',
  loading: false,
  error: null,
}));

export const notifications = {
  /** Read the account's preferences and this device's subscription state. */
  async load(userId: string) {
    useNotificationStore.setState({ loading: true, support: pushSupport() });

    const subscribed = await pushEnabledHere();

    if (!supabase) {
      useNotificationStore.setState({ loading: false, deviceSubscribed: subscribed });
      return;
    }

    const { data } = await supabase
      .from(TABLES.notificationPrefs)
      .select('push_enabled,email_enabled,email_address')
      .eq('user_id', userId)
      .maybeSingle();

    useNotificationStore.setState({
      // No row yet means both channels on. Somebody who set an alert without
      // ever opening settings wants to hear about it.
      pushEnabled: data?.push_enabled ?? true,
      emailEnabled: data?.email_enabled ?? true,
      emailAddress: data?.email_address ?? null,
      deviceSubscribed: subscribed,
      support: pushSupport(),
      loading: false,
    });
  },

  async savePrefs(
    userId: string,
    patch: { pushEnabled?: boolean; emailEnabled?: boolean; emailAddress?: string | null },
  ): Promise<{ ok: boolean; error?: string }> {
    const state = useNotificationStore.getState();
    const next = {
      push_enabled: patch.pushEnabled ?? state.pushEnabled,
      email_enabled: patch.emailEnabled ?? state.emailEnabled,
      email_address:
        patch.emailAddress === undefined ? state.emailAddress : patch.emailAddress || null,
    };

    // Applied locally first so a toggle responds immediately rather than
    // waiting out a round trip; a failure below puts the error on screen.
    useNotificationStore.setState({
      pushEnabled: next.push_enabled,
      emailEnabled: next.email_enabled,
      emailAddress: next.email_address,
    });

    if (!supabase) return { ok: true };

    const { error } = await supabase
      .from(TABLES.notificationPrefs)
      .upsert({ user_id: userId, ...next }, { onConflict: 'user_id' });

    if (error) {
      useNotificationStore.setState({ error: 'Could not save your notification settings.' });
      return { ok: false, error: error.message };
    }
    useNotificationStore.setState({ error: null });
    return { ok: true };
  },

  /** Ask this browser for permission and register it. */
  async subscribeDevice(userId: string, vapidPublicKey: string) {
    useNotificationStore.setState({ loading: true, error: null });
    const result = await enablePush(userId, vapidPublicKey);
    useNotificationStore.setState({
      loading: false,
      deviceSubscribed: result.ok,
      support: pushSupport(),
      error: result.ok ? null : (result.error ?? 'Could not enable notifications.'),
    });
    // Turning a device on is also a statement that push is wanted at all.
    if (result.ok) await notifications.savePrefs(userId, { pushEnabled: true });
    return result;
  },

  async unsubscribeDevice() {
    useNotificationStore.setState({ loading: true });
    await disablePush();
    useNotificationStore.setState({ loading: false, deviceSubscribed: false });
  },
};
