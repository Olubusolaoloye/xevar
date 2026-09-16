import { useEffect, useState } from 'react';
import { BellRing, Mail, Smartphone } from 'lucide-react';
import { hasBackend } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { useAdminStore } from '@/store/useAdminStore';
import { notifications, useNotificationStore } from '@/store/useNotificationStore';
import { AuthForm } from '@/components/auth/AuthForm';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PanelHeader } from '@/components/ui/Panel';
import { Toggle } from '@/components/ui/Toggle';

/**
 * Where alerts go.
 *
 * The honest framing this panel has to carry: a signed-out alert is only
 * checked while a PanScreener tab is open, which is the one moment you are
 * already watching the price. Signing in moves evaluation to the server, where
 * it runs every minute whether or not anything is open.
 */
export function NotificationPanel() {
  const email = useAuthStore((s) => s.email);
  const userId = useAuthStore((s) => s.userId);
  const vapidPublicKey = useAdminStore((s) => s.vapidPublicKey);

  const pushEnabled = useNotificationStore((s) => s.pushEnabled);
  const emailEnabled = useNotificationStore((s) => s.emailEnabled);
  const emailAddress = useNotificationStore((s) => s.emailAddress);
  const deviceSubscribed = useNotificationStore((s) => s.deviceSubscribed);
  const support = useNotificationStore((s) => s.support);
  const loading = useNotificationStore((s) => s.loading);
  const error = useNotificationStore((s) => s.error);

  const [address, setAddress] = useState(emailAddress ?? '');

  useEffect(() => {
    if (userId) void notifications.load(userId);
  }, [userId]);

  useEffect(() => setAddress(emailAddress ?? ''), [emailAddress]);

  if (!hasBackend) {
    return (
      <div>
        <PanelHeader title="Delivery" icon={<BellRing className="h-4 w-4" />} />
        <p className="px-4 py-5 text-xs leading-relaxed text-ink-low">
          Notifications need the backend. Alerts still work while a tab is open.
        </p>
      </div>
    );
  }

  if (!email || !userId) {
    return (
      <div>
        <PanelHeader
          title="Get alerts when the app is closed"
          subtitle="Sign in to deliver alerts to your devices"
          icon={<BellRing className="h-4 w-4 text-brand-500" />}
        />
        <div className="space-y-3 p-4">
          <p className="text-xs leading-relaxed text-ink-low">
            Your alerts currently run in this browser, so they can only fire
            while PanScreener is open — which is the one time you are already
            looking. Sign in and they move to the server, where they are checked
            every minute and pushed to your phone and inbox.
          </p>
          <AuthForm idPrefix="alerts" className="overflow-hidden" />
        </div>
      </div>
    );
  }

  const deviceLine = () => {
    if (support === 'needs-install') {
      return 'On iPhone and iPad, add PanScreener to your Home Screen first — Safari only allows notifications for installed web apps.';
    }
    if (support === 'denied') {
      return 'Notifications are blocked for this site. Allow them in your browser settings, then come back.';
    }
    if (support === 'unsupported') return 'This browser cannot receive push notifications.';
    return deviceSubscribed
      ? 'This device is registered. Alerts arrive even with PanScreener closed.'
      : 'This device is not registered yet.';
  };

  return (
    <div>
      <PanelHeader
        title="Delivery"
        subtitle="Checked every minute on the server"
        icon={<BellRing className="h-4 w-4 text-brand-500" />}
      />

      <div className="divide-y divide-line-soft">
        <div className="px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                <Smartphone className="h-3.5 w-3.5 text-ink-low" />
                This device
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-low">{deviceLine()}</p>
            </div>

            {support !== 'unsupported' && support !== 'needs-install' && (
              <Button
                size="sm"
                variant={deviceSubscribed ? 'outline' : 'primary'}
                disabled={loading || support === 'denied'}
                onClick={() =>
                  deviceSubscribed
                    ? void notifications.unsubscribeDevice()
                    : void notifications.subscribeDevice(userId, vapidPublicKey)
                }
                className="shrink-0"
              >
                {loading ? 'Working…' : deviceSubscribed ? 'Unregister' : 'Turn on'}
              </Button>
            )}
          </div>

          {error && (
            <p className="mt-2 rounded-sm border border-down/25 bg-down/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-down">
              {error}
            </p>
          )}
        </div>

        <div className="px-4 py-3.5">
          <Toggle
            checked={pushEnabled}
            onChange={(value) => void notifications.savePrefs(userId, { pushEnabled: value })}
            label="Push notifications"
            description="Applies to every device you have registered, not just this one."
          />
        </div>

        <div className="space-y-2.5 px-4 py-3.5">
          <Toggle
            checked={emailEnabled}
            onChange={(value) => void notifications.savePrefs(userId, { emailEnabled: value })}
            label="Email"
            description="A message per alert, with the figure that crossed."
          />

          {emailEnabled && (
            <div>
              <label
                htmlFor="alert-email"
                className="mb-1 flex items-center gap-1.5 text-[11px] text-ink-mid"
              >
                <Mail className="h-3 w-3" />
                Send to
              </label>
              <div className="flex gap-2">
                <Input
                  id="alert-email"
                  type="email"
                  value={address}
                  placeholder={email}
                  onChange={(event) => setAddress(event.target.value)}
                  className="min-w-0 flex-1"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={(address || null) === emailAddress}
                  onClick={() =>
                    void notifications.savePrefs(userId, { emailAddress: address || null })
                  }
                  className="shrink-0"
                >
                  Save
                </Button>
              </div>
              <p className="mt-1 text-[10px] text-ink-dim">
                Leave blank to use the address on your account.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
