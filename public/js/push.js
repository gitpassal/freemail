/* Web Push 订阅控制（仅 standalone/preview）。window.WebPush = { enable, disable, isEnabled } */
(function () {
  'use strict';
  var d = document.documentElement;
  function isStandaloneLike() {
    return d.classList.contains('is-standalone') || d.classList.contains('is-pwa-preview');
  }
  if (!isStandaloneLike()) return;

  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(base64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function gfetch(path, opts) {
    return fetch(path, Object.assign({ credentials: 'include' }, opts || {}));
  }

  function supported() {
    return ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);
  }

  async function isEnabled() {
    if (!supported()) return false;
    try {
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      return !!sub;
    } catch (e) { return false; }
  }

  async function enable() {
    if (!supported()) throw new Error('unsupported');
    var perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('denied');
    var reg = await navigator.serviceWorker.ready;
    var keyResp = await gfetch('/api/push/key').then(function (r) { return r.json(); });
    var key = keyResp && keyResp.key;
    if (!key) throw new Error('no-key');
    var sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key)
      });
    }
    var res = await gfetch('/api/push/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub.toJSON())
    });
    if (!res.ok) throw new Error('subscribe-failed');
    return true;
  }

  async function disable() {
    if (!supported()) return;
    try {
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if (sub) {
        try { await gfetch('/api/push/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }); } catch (_) {}
        await sub.unsubscribe();
      }
    } catch (e) {}
  }

  window.WebPush = { enable: enable, disable: disable, isEnabled: isEnabled, supported: supported };

  // 首次用户手势时自动申请一次通知权限（iOS 要求手势触发；localStorage 记一次，不重复打扰）
  function maybeAutoPrompt() {
    try {
      if (!supported()) return;
      if (Notification.permission !== 'default') return;            // 已授权或已拒绝则不再弹
      if (localStorage.getItem('mf:pushPrompted') === '1') return;  // 只自动申请一次
    } catch (e) { return; }
    function onFirstGesture() {
      document.removeEventListener('pointerdown', onFirstGesture, true);
      document.removeEventListener('click', onFirstGesture, true);
      try { localStorage.setItem('mf:pushPrompted', '1'); } catch (e) {}
      enable().catch(function () { /* 用户拒绝/失败：已记一次，不再自动弹 */ });
    }
    document.addEventListener('pointerdown', onFirstGesture, true);
    document.addEventListener('click', onFirstGesture, true);
  }
  maybeAutoPrompt();
})();
