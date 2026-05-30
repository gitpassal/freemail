/* Web Push 一次性显式引导横幅（仅 standalone/preview；iOS 要求按钮手势申请通知权限）。
   只负责"引导横幅"；常驻开关在通知中心铃铛（notifications.js 的 .nc-push-row）。
   关闭/开启后只置 mf:pushBannerDismissed=1 抑制横幅，绝不阻断铃铛里的常驻开关。 */
(function () {
  'use strict';
  var d = document.documentElement;
  function isStandaloneLike() {
    return d.classList.contains('is-standalone') || d.classList.contains('is-pwa-preview');
  }
  if (!isStandaloneLike()) return;

  var I18N = {
    title:  { zh: '开启邮件通知', en: 'Enable mail notifications' },
    body:   { zh: '允许通知，新邮件即时提醒', en: 'Allow alerts so new mail notifies you instantly' },
    enable: { zh: '开启', en: 'Enable' },
    later:  { zh: '以后再说', en: 'Later' },
    on:     { zh: '通知已开启', en: 'Notifications enabled' },
    denied: { zh: '通知权限被拒绝，请在 iOS 设置中开启', en: 'Permission denied — enable it in iOS Settings' },
    fail:   { zh: '开启失败，请稍后再试', en: 'Failed to enable, please try again' }
  };
  function lang() { try { return (window.i18n && window.i18n.getLang && window.i18n.getLang()) || 'zh'; } catch (e) { return 'zh'; } }
  function tr(k) { var o = I18N[k] || {}; return o[lang()] || o.zh || k; }
  function toast(msg, type) {
    try {
      if (typeof window.toast === 'function') window.toast(msg, type);
      else if (typeof window.showToast === 'function') window.showToast(msg, type);
    } catch (e) {}
  }

  function dismissed() { try { return localStorage.getItem('mf:pushBannerDismissed') === '1'; } catch (e) { return false; } }
  function setDismissed() { try { localStorage.setItem('mf:pushBannerDismissed', '1'); } catch (e) {} }

  function canPrompt() {
    try {
      if (typeof Notification === 'undefined') return false;
      if (Notification.permission !== 'default') return false;     // 已授权/已拒绝则不再引导
      if (!(window.WebPush && window.WebPush.supported && window.WebPush.supported())) return false;
      if (dismissed()) return false;
      return true;
    } catch (e) { return false; }
  }

  function bellSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
  }

  var banner = null;
  function build() {
    banner = document.createElement('div');
    banner.className = 'push-banner';
    banner.innerHTML =
      '<div class="push-banner-icon">' + bellSvg() + '</div>' +
      '<div class="push-banner-text">' +
        '<div class="push-banner-title"></div>' +
        '<div class="push-banner-body"></div>' +
      '</div>' +
      '<div class="push-banner-actions">' +
        '<button type="button" class="push-banner-later"></button>' +
        '<button type="button" class="push-banner-enable"></button>' +
      '</div>';
    banner.querySelector('.push-banner-title').textContent = tr('title');
    banner.querySelector('.push-banner-body').textContent = tr('body');
    banner.querySelector('.push-banner-later').textContent = tr('later');
    banner.querySelector('.push-banner-enable').textContent = tr('enable');
    document.body.appendChild(banner);
    banner.querySelector('.push-banner-later').addEventListener('click', function () { setDismissed(); hide(); });
    banner.querySelector('.push-banner-enable').addEventListener('click', onEnable);
    requestAnimationFrame(function () { if (banner) banner.classList.add('is-open'); });
  }
  function hide() {
    if (!banner) return;
    var b = banner; banner = null;
    b.classList.remove('is-open');
    setTimeout(function () { if (b && b.parentNode) b.parentNode.removeChild(b); }, 280);
  }
  function onEnable() {
    if (!(window.WebPush && window.WebPush.enable)) { toast(tr('fail'), 'warn'); return; }
    // requestPermission 在本点击手势内同步触发（iOS 要求）
    window.WebPush.enable().then(function () {
      setDismissed(); hide(); toast(tr('on'), 'success');
      try { if (window.NotifCenter && window.NotifCenter.refreshBadge) window.NotifCenter.refreshBadge(); } catch (e) {}
    }).catch(function (e) {
      setDismissed(); hide();
      toast((e && e.message === 'denied') ? tr('denied') : tr('fail'), 'warn');
    });
  }

  function boot() {
    var tries = 0;
    (function wait() {
      if (!window.WebPush && tries < 40) { tries++; setTimeout(wait, 250); return; } // WebPush 由 push.js 注入，可能稍晚
      if (canPrompt()) build();
    })();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 1200); });
  else setTimeout(boot, 1200);
})();
