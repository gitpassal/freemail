/* 注册 Service Worker（仅 standalone/preview；用于 Web Push） */
(function () {
  var d = document.documentElement;
  if (!(d.classList.contains('is-standalone') || d.classList.contains('is-pwa-preview'))) return;
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function (e) {
      console.warn('SW 注册失败:', e);
    });
  });
})();
