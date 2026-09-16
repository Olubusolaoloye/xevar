/**
 * PanScreener service worker.
 *
 * Its only job is alerts. A push arrives from the alert dispatcher while the
 * app is closed — that is the whole point, since an alert evaluated in an open
 * tab is an alert that fires when you were already looking — and this is the
 * only code that can run to show it.
 *
 * Deliberately not a caching service worker. Offline support for a live market
 * board is a trap: a screener showing yesterday's prices from a cache is worse
 * than one that plainly cannot reach the market.
 */

self.addEventListener('install', () => {
  // Take over immediately rather than waiting for every tab to close. A newly
  // granted notification permission should work on the page that granted it.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  /* A push with no readable body still gets shown.

     Browsers require that a received push produces a visible notification —
     staying silent risks the browser revoking the permission altogether — so a
     malformed payload becomes a generic notice rather than nothing. */
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || 'PanScreener alert';
  const options = {
    body: payload.body || 'One of your alerts fired.',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/favicon-32.png',
    // Replaces an earlier notice for the same alert instead of stacking a
    // fresh one every time it crosses.
    tag: payload.tag || 'panscreener-alert',
    renotify: true,
    // Price alerts are time-critical; letting the OS quietly collapse this
    // into a digest defeats the point of sending it.
    requireInteraction: false,
    data: { url: payload.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Reuse a tab that is already open on this origin rather than piling up
      // a new window every time somebody taps an alert.
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
