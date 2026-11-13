/* Cluaiz: the buttons of an approval notification. The worker only passes the button on to the
   open App, which answers the Engine with its own connection; it holds no token. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', event => {
  const data = event.notification.data || {};
  const action = event.action || 'open';
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const app = windows[0];
    if (!app) return;
    app.postMessage({ type: 'cluaiz-approval', action, requestId: data.requestId, sessionId: data.sessionId });
    if (action === 'open' && 'focus' in app) await app.focus();
  })());
});
