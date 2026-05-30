/* Service Worker — Web Push（iOS 16.4+ 主屏 PWA）。仅处理推送与点击，不做离线缓存。 */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { try { data = { body: event.data.text() }; } catch (_) { data = {}; } }
  var title = data.title || '新邮件';
  var options = {
    body: data.body || '',
    icon: '/icons/pwa-192.png',
    badge: '/icons/pwa-192.png',
    tag: data.tag || ('mail-' + (data.messageId || Date.now())),
    data: { url: data.url || '/', messageId: data.messageId || null }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async function () {
    var all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (var i = 0; i < all.length; i++) {
      if ('focus' in all[i]) { try { await all[i].focus(); } catch (_) {} return; }
    }
    if (self.clients.openWindow) { try { await self.clients.openWindow(target); } catch (_) {} }
  })());
});
