/**
 * Alert dispatch.
 *
 * Runs on a schedule, evaluates every enabled alert against live prices, and
 * delivers the ones that just crossed by Web Push and email.
 *
 * This exists because an alert evaluated in the browser is only an alert while
 * a tab is open, which is the one time you are already looking at the price.
 *
 * `rules.ts` beside this file is a byte-for-byte copy of src/data/alertRules.ts
 * in the app, deployed together, so the server cannot disagree with the app
 * about what "fired" means.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import {
  ALERT_METRIC_TEXT,
  evaluateAlert,
  metricFormatOf,
  type AlertMetricName,
  type AlertComparatorName,
  type AlertReadable,
} from './rules.ts';

const DEX_BASE = 'https://api.dexscreener.com';
/** The pairs endpoint takes a comma-separated list; this is its documented cap. */
const PAIR_BATCH = 30;
/** Consecutive push failures before a subscription is considered dead. */
const MAX_PUSH_FAILURES = 5;

interface AlertRow {
  id: string;
  user_id: string;
  pair_id: string;
  pair_label: string;
  chain: string;
  metric: AlertMetricName;
  comparator: AlertComparatorName;
  threshold: number;
  enabled: boolean;
  condition_met: boolean;
}

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  // Injected by the platform. Bypasses RLS, which is what lets one run read
  // every user's alerts — and why the secret check below is not optional.
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

/* -------------------------------------------------------------------------- */
/* VAPID keys                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Fetch the VAPID keypair, generating it on first run.
 *
 * Generated here rather than handed in, so the private half is created inside
 * the platform that uses it and no copy exists anywhere else — not in a
 * dashboard field, not in a chat log, not on anybody's laptop. The public half
 * is not a secret: it goes into app settings, where the browser reads it to
 * subscribe.
 */
async function vapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const { data: stored } = await admin.rpc('ps_vapid_private_key');
  const { data: settings } = await admin
    .from('ps_app_settings')
    .select('vapid_public_key')
    .eq('id', 1)
    .maybeSingle();

  if (stored && settings?.vapid_public_key) {
    return { publicKey: settings.vapid_public_key, privateKey: stored };
  }

  const generated = webpush.generateVAPIDKeys();
  await admin.rpc('ps_set_vapid_private_key', { key: generated.privateKey });
  await admin
    .from('ps_app_settings')
    .update({ vapid_public_key: generated.publicKey })
    .eq('id', 1);

  return generated;
}

/* -------------------------------------------------------------------------- */
/* Prices                                                                     */
/* -------------------------------------------------------------------------- */

/** Map the provider's wire shape onto the minimum the rules read. */
function toReadable(wire: Record<string, unknown>): AlertReadable {
  const liquidity = (wire.liquidity ?? {}) as { usd?: number };
  const priceChange = (wire.priceChange ?? {}) as { h24?: number };
  const volume = (wire.volume ?? {}) as { h24?: number };
  return {
    priceUsd: Number(wire.priceUsd ?? 0),
    marketCap: Number(wire.marketCap ?? wire.fdv ?? 0),
    liquidityUsd: Number(liquidity.usd ?? 0),
    change: { h24: Number(priceChange.h24 ?? 0) },
    volume: { h24: Number(volume.h24 ?? 0) },
  };
}

/**
 * Fetch every pair an alert is watching, keyed by the board's own pair id.
 *
 * A pair id is `${chain}-${pairAddress}`, so the address comes straight back
 * out of it — no separate lookup, and no chance of resolving to a different
 * token that happens to share a ticker.
 *
 * One failed chain does not take the run down. An alert whose pair is missing
 * from the result is skipped by the rules, which leaves its state untouched
 * rather than re-arming it.
 */
async function fetchPairs(alerts: AlertRow[]): Promise<Map<string, AlertReadable>> {
  const byChain = new Map<string, Set<string>>();
  for (const alert of alerts) {
    const address = alert.pair_id.slice(alert.chain.length + 1);
    if (!address) continue;
    const bucket = byChain.get(alert.chain) ?? new Set<string>();
    bucket.add(address);
    byChain.set(alert.chain, bucket);
  }

  const found = new Map<string, AlertReadable>();

  for (const [chain, addressSet] of byChain) {
    const addresses = [...addressSet];
    for (let i = 0; i < addresses.length; i += PAIR_BATCH) {
      const batch = addresses.slice(i, i + PAIR_BATCH);
      try {
        const response = await fetch(`${DEX_BASE}/latest/dex/pairs/${chain}/${batch.join(',')}`);
        if (!response.ok) continue;
        const body = await response.json();
        for (const wire of body?.pairs ?? []) {
          if (!wire?.pairAddress) continue;
          found.set(`${chain}-${wire.pairAddress}`, toReadable(wire));
        }
      } catch {
        // Leave this batch unresolved; the rules treat a missing pair as
        // unknown rather than as a cleared condition.
      }
    }
  }

  return found;
}

/* -------------------------------------------------------------------------- */
/* Wording                                                                    */
/* -------------------------------------------------------------------------- */

function formatValue(metric: AlertMetricName, value: number): string {
  const shape = metricFormatOf(metric);
  if (shape === 'percent') return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  if (shape === 'price') {
    // Memecoin prices need real precision; a compact "$0.00" says nothing.
    return value < 0.01 ? `$${value.toPrecision(4)}` : `$${value.toFixed(4)}`;
  }
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function describe(alert: AlertRow, value: number): string {
  return `${ALERT_METRIC_TEXT[alert.metric]} is ${alert.comparator} ${formatValue(
    alert.metric,
    alert.threshold,
  )} — now ${formatValue(alert.metric, value)}`;
}

/* -------------------------------------------------------------------------- */
/* Email                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Send one alert email.
 *
 * Every provider-specific detail is inside this one function on purpose: a
 * transactional sender is a commodity and the choice of one is not worth
 * spreading through the codebase. Swapping Resend for Postmark, SES or
 * Mailchimp's Mandrill is this request shape and nothing else.
 *
 * Returns a reason when it does not send, so the delivery row can say why
 * rather than leaving somebody guessing whether the email is late or absent.
 */
async function sendEmail(
  to: string,
  subject: string,
  line: string,
  url: string,
): Promise<{ ok: boolean; note?: string }> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return { ok: false, note: 'no email provider configured' };

  const from = Deno.env.get('ALERT_EMAIL_FROM') ?? 'PanScreener <onboarding@resend.dev>';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px">
  <p style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#a08a3c;margin:0 0 6px">PanScreener alert</p>
  <h1 style="font-size:20px;margin:0 0 12px;color:#171310">${subject}</h1>
  <p style="font-size:15px;line-height:1.5;color:#3d3630;margin:0 0 20px">${line}</p>
  <a href="${url}" style="display:inline-block;background:#f4c22c;color:#171310;font-weight:600;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px">Open the pair</a>
  <p style="font-size:12px;color:#8a8079;margin:24px 0 0">You set this alert on PanScreener. Turn alert emails off in Settings.</p>
</div>`,
      }),
    });

    if (!response.ok) {
      return { ok: false, note: `email provider returned ${response.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, note: 'email provider unreachable' };
  }
}

/* -------------------------------------------------------------------------- */
/* Handler                                                                    */
/* -------------------------------------------------------------------------- */

Deno.serve(async (request) => {
  /* This function runs as the service role, so it can read every user's
     alerts and push endpoints. The only thing standing between its URL and
     anybody on the internet is this check. */
  const { data: expected } = await admin.rpc('ps_dispatch_secret');
  const presented = request.headers.get('x-dispatch-secret');
  if (!expected || presented !== expected) {
    return new Response('forbidden', { status: 403 });
  }

  const siteUrl = Deno.env.get('ALERT_SITE_URL') ?? 'https://coinpan.netlify.app';

  const { data: alertRows, error } = await admin
    .from('ps_alerts')
    .select('id,user_id,pair_id,pair_label,chain,metric,comparator,threshold,enabled,condition_met')
    .eq('enabled', true);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const alerts = (alertRows ?? []) as AlertRow[];
  if (alerts.length === 0) {
    return Response.json({ checked: 0, fired: 0 });
  }

  const pairs = await fetchPairs(alerts);
  const keys = await vapidKeys();
  webpush.setVapidDetails(`mailto:alerts@panscreener.app`, keys.publicKey, keys.privateKey);

  let fired = 0;
  const checkedAt = new Date().toISOString();

  for (const alert of alerts) {
    const outcome = evaluateAlert(
      {
        enabled: alert.enabled,
        metric: alert.metric,
        comparator: alert.comparator,
        threshold: alert.threshold,
        conditionMet: alert.condition_met,
      },
      pairs.get(alert.pair_id) ?? null,
    );

    // `skip` means the reading was unusable, so the previous state stands.
    if (outcome.action === 'skip') continue;

    if (outcome.action !== 'fire') {
      await admin
        .from('ps_alerts')
        .update({ condition_met: outcome.conditionMet, last_checked_at: checkedAt })
        .eq('id', alert.id);
      continue;
    }

    fired += 1;
    const line = describe(alert, outcome.value);
    const url = `${siteUrl}/pair/${alert.pair_id}`;

    const { data: prefs } = await admin
      .from('ps_notification_prefs')
      .select('push_enabled,email_enabled,email_address')
      .eq('user_id', alert.user_id)
      .maybeSingle();

    // Absent preferences mean both channels on: somebody who set an alert
    // without opening settings wants to hear about it.
    const wantsPush = prefs?.push_enabled ?? true;
    const wantsEmail = prefs?.email_enabled ?? true;

    let pushSent = false;
    const notes: string[] = [];

    if (wantsPush) {
      const { data: subs } = await admin
        .from('ps_push_subscriptions')
        .select('id,endpoint,p256dh,auth,failure_count')
        .eq('user_id', alert.user_id);

      for (const sub of subs ?? []) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({
              title: `${alert.pair_label} — alert`,
              body: line,
              url,
              tag: alert.id,
            }),
            // Ask the push service to wake the device now rather than batching
            // this with whatever else it has queued. A price alert delivered
            // twenty minutes late is not an alert.
            { urgency: 'high', TTL: 3600 },
          );
          pushSent = true;
          await admin
            .from('ps_push_subscriptions')
            .update({ last_used_at: checkedAt, failure_count: 0 })
            .eq('id', sub.id);
        } catch (pushError) {
          const status = (pushError as { statusCode?: number }).statusCode;
          // 404 and 410 are the push service saying this browser threw the
          // subscription away. That is final, so the row goes rather than
          // being retried forever.
          if (status === 404 || status === 410) {
            await admin.from('ps_push_subscriptions').delete().eq('id', sub.id);
          } else {
            const count = (sub.failure_count ?? 0) + 1;
            if (count >= MAX_PUSH_FAILURES) {
              await admin.from('ps_push_subscriptions').delete().eq('id', sub.id);
            } else {
              await admin
                .from('ps_push_subscriptions')
                .update({ failure_count: count })
                .eq('id', sub.id);
            }
          }
        }
      }

      if (!pushSent && (subs ?? []).length === 0) notes.push('no device registered');
    }

    let emailSent = false;
    if (wantsEmail) {
      let address = prefs?.email_address ?? null;
      if (!address) {
        const { data: account } = await admin.auth.admin.getUserById(alert.user_id);
        address = account?.user?.email ?? null;
      }
      if (address) {
        const result = await sendEmail(address, `${alert.pair_label} — alert`, line, url);
        emailSent = result.ok;
        if (result.note) notes.push(result.note);
      } else {
        notes.push('no email address');
      }
    }

    await admin.from('ps_alert_deliveries').insert({
      alert_id: alert.id,
      user_id: alert.user_id,
      pair_id: alert.pair_id,
      pair_label: alert.pair_label,
      metric: alert.metric,
      comparator: alert.comparator,
      threshold: alert.threshold,
      value: outcome.value,
      fired_at: checkedAt,
      push_sent: pushSent,
      email_sent: emailSent,
      note: notes.length > 0 ? notes.join('; ') : null,
    });

    await admin
      .from('ps_alerts')
      .update({ condition_met: true, last_fired_at: checkedAt, last_checked_at: checkedAt })
      .eq('id', alert.id);
  }

  return Response.json({ checked: alerts.length, pairs: pairs.size, fired });
});
