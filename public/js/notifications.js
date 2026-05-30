/* =============================================
   应用内通知中心（仅 iOS Web App / standalone）
   - 顶栏铃铛(红点) + 全屏通知浮层；仿 gmail-inbox 浮层范式
   - 桌面无 tab-bar、本模块 standalone 守卫，桌面零影响
   ============================================= */
(function () {
  'use strict';
  var docEl = document.documentElement;
  function isStandaloneLike() {
    return docEl.classList.contains('is-standalone') || docEl.classList.contains('is-pwa-preview');
  }
  if (!isStandaloneLike()) return;

  try {
    if (window.i18n && window.i18n.addKeys) {
      window.i18n.addKeys({
        'notif.title':     { zh: '通知', en: 'Notifications' },
        'notif.empty':     { zh: '暂无通知', en: 'No notifications' },
        'notif.markAll':   { zh: '全部已读', en: 'Mark all read' },
        'notif.loading':   { zh: '加载中…', en: 'Loading…' },
        'notif.enablePush':{ zh: '开启系统推送通知', en: 'Enable push notifications' },
        'notif.pushOn':    { zh: '系统推送已开启', en: 'Push notifications on' },
        'notif.pushDenied':{ zh: '通知权限被拒绝，请在系统设置中开启', en: 'Permission denied — enable it in Settings' },
        'notif.pushFail':  { zh: '开启推送失败', en: 'Failed to enable push' }
      });
    }
  } catch (e) {}

  function tr(k) { try { return window.t ? window.t(k) : k; } catch (e) { return k; } }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function toast(m, t) { try { if (window.showToast) window.showToast(m, t || 'info'); } catch (e) {} }
  function gapi(path, opts) {
    return fetch(path, Object.assign({ credentials: 'include' }, opts || {})).then(function (r) {
      if (r.status === 401) { try { location.replace('/html/login.html'); } catch (e) {} throw new Error('401'); }
      return r;
    });
  }
  function svgBell() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
  }
  function svgIcon(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="/icons/sprites.svg#icon-' + name + '"/></svg>';
  }

  function fmtTime(iso) {
    if (!iso) return '';
    var d = new Date(/Z|\+/.test(iso) ? iso : iso.replace(' ', 'T') + 'Z');
    if (isNaN(d.getTime())) return '';
    var now = new Date(), lang = (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'zh';
    if (d.toDateString() === now.toDateString()) {
      var h = d.getHours(), mi = d.getMinutes();
      return (h < 10 ? '0' : '') + h + ':' + (mi < 10 ? '0' : '') + mi;
    }
    if (lang === 'en') return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()] + ' ' + d.getDate();
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  var panel = null, bell = null, items = [], loading = false;

  function ensureBell() {
    if (bell && document.body.contains(bell)) return;
    var inner = document.querySelector('.topbar .topbar-inner') || document.querySelector('.topbar-inner');
    if (!inner) return;
    if (inner.querySelector('#notif-bell')) { bell = inner.querySelector('#notif-bell'); return; }
    bell = document.createElement('button');
    bell.id = 'notif-bell';
    bell.type = 'button';
    bell.className = 'notif-bell';
    bell.setAttribute('aria-label', tr('notif.title'));
    bell.innerHTML = svgBell() + '<span class="notif-dot"></span>';
    bell.addEventListener('click', open);
    inner.appendChild(bell);
  }

  function ensurePanel() {
    if (panel) return;
    panel = document.createElement('div');
    panel.className = 'notif-center';
    panel.innerHTML =
      '<div class="nc-topbar">' +
        '<button class="nc-back" aria-label="back">' + svgIcon('chevron-left') + '</button>' +
        '<div class="nc-title">' + esc(tr('notif.title')) + '</div>' +
        '<button class="nc-readall">' + esc(tr('notif.markAll')) + '</button>' +
      '</div>' +
      '<div class="nc-list"></div>' +
      '<button class="nc-push-row">' + svgBell() + '<span class="nc-push-label">' + esc(tr('notif.enablePush')) + '</span></button>';
    document.body.appendChild(panel);
    panel.querySelector('.nc-back').addEventListener('click', function () { history.back(); });
    panel.querySelector('.nc-readall').addEventListener('click', markAllRead);
    panel.querySelector('.nc-list').addEventListener('click', onRowClick);
    panel.querySelector('.nc-push-row').addEventListener('click', onEnablePush);
  }

  function rowHTML(n) {
    var unread = !n.is_read;
    return '<div class="nc-row' + (unread ? ' is-unread' : '') + '" data-id="' + n.id + '" data-mid="' + (n.message_id || '') + '">' +
      '<div class="nc-ico">' + svgIcon('mail') + '</div>' +
      '<div class="nc-main">' +
        '<div class="nc-row-title">' + esc(n.title || '') + '</div>' +
        '<div class="nc-row-body">' + esc(n.body || '') + (n.mailbox_address ? ' · ' + esc(n.mailbox_address) : '') + '</div>' +
      '</div>' +
      '<div class="nc-time">' + esc(fmtTime(n.created_at)) + '</div>' +
      '</div>';
  }

  function render() {
    if (!panel) return;
    var list = panel.querySelector('.nc-list');
    if (!items.length) { list.innerHTML = '<div class="nc-empty">' + esc(tr('notif.empty')) + '</div>'; return; }
    list.innerHTML = items.map(rowHTML).join('');
  }

  function load() {
    if (loading) return;
    loading = true;
    var list = panel.querySelector('.nc-list');
    list.innerHTML = '<div class="nc-empty">' + esc(tr('notif.loading')) + '</div>';
    gapi('/api/notifications?page=1&limit=30').then(function (r) { return r.json(); }).then(function (d) {
      items = (d && d.list) || [];
      loading = false; render(); setBadge((d && d.unread) || 0);
    }).catch(function () { loading = false; render(); });
  }

  function onRowClick(ev) {
    var row = ev.target.closest ? ev.target.closest('.nc-row') : null;
    if (!row) return;
    var id = row.getAttribute('data-id'), mid = row.getAttribute('data-mid');
    row.classList.remove('is-unread');
    gapi('/api/notifications/' + id + '/read', { method: 'POST' }).catch(function () {});
    refreshBadge();
    if (mid && window.GmailInbox && window.GmailInbox.openMail) {
      window.GmailInbox.openMail(mid);
    }
  }

  function markAllRead() {
    gapi('/api/notifications/read-all', { method: 'POST' }).then(function () {
      items.forEach(function (n) { n.is_read = 1; }); render(); setBadge(0);
    }).catch(function () {});
  }

  function setBadge(count) {
    if (!bell) ensureBell();
    if (!bell) return;
    var dot = bell.querySelector('.notif-dot');
    if (count > 0) { bell.classList.add('has-unread'); if (dot) dot.textContent = count > 99 ? '99+' : String(count); }
    else { bell.classList.remove('has-unread'); if (dot) dot.textContent = ''; }
  }

  function refreshBadge() {
    ensureBell();
    gapi('/api/notifications/unread-count').then(function (r) { return r.json(); }).then(function (d) {
      setBadge((d && d.count) || 0);
    }).catch(function () {});
  }

  function open() {
    ensurePanel();
    panel.classList.add('is-open');
    try { history.pushState({ nc: 1 }, ''); } catch (e) {}
    load();
    // 同步"开启推送"行状态
    try { if (window.WebPush && window.WebPush.isEnabled) window.WebPush.isEnabled().then(function (on) { syncPushRow(on); }); } catch (e) {}
  }
  function close() { if (panel) panel.classList.remove('is-open'); }

  function syncPushRow(on) {
    if (!panel) return;
    var row = panel.querySelector('.nc-push-row');
    if (!row) return;
    var label = row.querySelector('.nc-push-label');
    if (on) { row.classList.add('is-on'); if (label) label.textContent = tr('notif.pushOn'); }
    else { row.classList.remove('is-on'); if (label) label.textContent = tr('notif.enablePush'); }
  }
  function onEnablePush() {
    if (!(window.WebPush && window.WebPush.enable)) { toast(tr('notif.pushFail'), 'warn'); return; }
    window.WebPush.enable().then(function () { syncPushRow(true); toast(tr('notif.pushOn'), 'success'); })
      .catch(function (e) {
        var msg = (e && e.message === 'denied') ? tr('notif.pushDenied') : tr('notif.pushFail');
        toast(msg, 'warn');
      });
  }

  window.addEventListener('popstate', function () { if (panel && panel.classList.contains('is-open')) close(); });

  window.NotifCenter = { open: open, close: close, refreshBadge: refreshBadge };

  // 启动：插铃铛 + 拉未读；定时与回前台刷新
  function boot() {
    var tries = 0;
    (function waitInner() {
      ensureBell();
      if (!bell && tries < 60) { tries++; setTimeout(waitInner, 200); return; }
      refreshBadge();
    })();
    setInterval(function () { if (document.visibilityState === 'visible') refreshBadge(); }, 45000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') refreshBadge(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 400); });
  else setTimeout(boot, 400);
})();
