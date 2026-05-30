/* =============================================
   iOS 邮箱详情 · Proton 管理卡（仅 standalone / pwa-preview）
   - 在 #list-card（点进某邮箱后的二级视图）顶部插入一张 Proton 管理卡：
       隐身 hero（本地名 + 别名邮箱）→ 管理卡（地址+复制 / 转发到 / 创建于）。
   - 不重写业务逻辑：
       复制 → 点击既有 #copy（copyMailboxAddress，含 toast）
       转发到 → 点击既有 #forward-setting（打开既有转发设置）
   - 数据来源：window.currentMailbox（地址）、window.__cfMailboxInfo（forward_to，
       由 app.js updateMailboxInfoUI 派发 mf:mailboxinfo 事件）、
       列表 DOM .mailbox-item[data-addr] 的 data-created（created_at，info 接口不返回）。
   - 收件列表（#list）由既有逻辑渲染，管理卡只插在其上方，不干扰。
   - 桌面/普通浏览器不执行（standalone 守卫）。
   ============================================= */
(function () {
  'use strict';
  var d = document.documentElement;
  function isStandaloneLike() {
    return d.classList.contains('is-standalone') || d.classList.contains('is-pwa-preview');
  }
  if (!isStandaloneLike()) return;

  function tr(k) { try { return window.t ? window.t(k) : k; } catch (e) { return k; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function svg(p) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }
  var ICON = {
    incognito: svg('<path d="M5 11.5C5 7 6.2 4.3 8 3.7c1.4-.5 1.8 1.1 4 1.1s2.6-1.6 4-1.1c1.8.6 3 3.3 3 7.8"/><path d="M2.5 11.5h19"/><circle cx="7.5" cy="16.2" r="3.3"/><circle cx="16.5" cy="16.2" r="3.3"/><path d="M10.5 15.2c.9-.7 2.1-.7 3 0"/>'),
    at: svg('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-3.06 0L2 7"/>'),
    copy: svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    forward: svg('<polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/>'),
    off: svg('<circle cx="12" cy="12" r="9"/><line x1="8" y1="12" x2="16" y2="12"/>'),
    cal: svg('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'),
    chevR: svg('<polyline points="9 18 15 12 9 6"/>'),
    chevL: svg('<polyline points="15 18 9 12 15 6"/>')
  };

  // 返回邮箱列表（复用底栏 Mailboxes tab → showHis）
  function goBack() {
    try {
      var t = document.querySelector('.tabbar-item[data-tab="mailboxes"]');
      if (t) { t.click(); return; }
    } catch (e) {}
    try { var h = document.getElementById('m-tab-history'); if (h) h.click(); } catch (e) {}
  }

  function localPart(addr) {
    var s = String(addr || ''); var i = s.indexOf('@');
    return i > 0 ? s.slice(0, i) : s;
  }
  function curAddr() { try { return window.currentMailbox || ''; } catch (e) { return ''; } }
  function curInfo() { try { return window.__cfMailboxInfo || null; } catch (e) { return null; } }

  // created_at 从列表 DOM 取（info 接口不返回）
  function createdOf(addr) {
    try {
      var row = document.querySelector('.mailbox-item[data-addr="' + (window.CSS && CSS.escape ? CSS.escape(addr) : addr) + '"]');
      return row ? (row.getAttribute('data-created') || '') : '';
    } catch (e) { return ''; }
  }
  function fmtDate(ts) {
    if (!ts) return '—';
    try {
      var iso = String(ts).indexOf('T') >= 0 ? String(ts) : String(ts).replace(' ', 'T');
      var dt = new Date(iso + 'Z');
      if (isNaN(dt.getTime())) return String(ts);
      var lang = 'zh-CN';
      try { lang = (window.i18n && window.i18n.getLang && window.i18n.getLang() === 'en') ? 'en-US' : 'zh-CN'; } catch (e) {}
      return new Intl.DateTimeFormat(lang, { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'short', day: 'numeric' }).format(dt);
    } catch (e) { return String(ts); }
  }

  var card = null;

  function build() {
    if (card) return card;
    card = document.createElement('div');
    card.className = 'mb-detail';
    card.innerHTML =
      '<button type="button" class="mb-back" aria-label="返回">' + ICON.chevL + '</button>' +
      '<div class="mb-hero">' +
        '<div class="mb-hero-ico">' + ICON.incognito + '</div>' +
        '<div class="mb-hero-bd"><div class="mb-hero-title"></div><div class="mb-hero-sub">' + ICON.incognito + '<span></span></div></div>' +
      '</div>' +
      '<div class="mb-mgmt-card">' +
        '<button type="button" class="mb-mrow mb-copy">' +
          '<span class="mb-mic">' + ICON.at + '</span>' +
          '<span class="mb-mbd"><span class="mb-mlb">' + esc(tr('mb.detailAddress')) + '</span><span class="mb-mvl mb-addr"></span></span>' +
          '<span class="mb-mcp">' + ICON.copy + '</span>' +
        '</button>' +
        '<button type="button" class="mb-mrow mb-fwd">' +
          '<span class="mb-mic mb-fwd-ic">' + ICON.off + '</span>' +
          '<span class="mb-mbd"><span class="mb-mlb">' + esc(tr('mb.detailForward')) + '</span><span class="mb-mvl mb-fwd-vl"></span></span>' +
          '<span class="mb-mchev">' + ICON.chevR + '</span>' +
        '</button>' +
        '<div class="mb-mrow mb-created">' +
          '<span class="mb-mic">' + ICON.cal + '</span>' +
          '<span class="mb-mbd"><span class="mb-mlb">' + esc(tr('mb.detailCreated')) + '</span><span class="mb-mvl mb-created-vl"></span></span>' +
        '</div>' +
      '</div>';
    // 返回 → 回到邮箱列表
    card.querySelector('.mb-back').addEventListener('click', goBack);
    // 复制 → 复用 #copy
    card.querySelector('.mb-copy').addEventListener('click', function () {
      var c = document.getElementById('copy'); if (c) c.click();
    });
    // 转发到 → 复用 #forward-setting
    card.querySelector('.mb-fwd').addEventListener('click', function () {
      var f = document.getElementById('forward-setting'); if (f) f.click();
    });
    return card;
  }

  function ensureInserted() {
    var lc = document.getElementById('list-card');
    if (!lc) return false;
    var c = build();
    if (c.parentElement !== lc) { lc.insertBefore(c, lc.firstChild); }
    return true;
  }

  function update() {
    var lc = document.getElementById('list-card');
    if (!lc || !card) return;
    var visible = window.getComputedStyle(lc).display !== 'none';
    var addr = curAddr();
    if (!visible || !addr) { card.style.display = 'none'; return; }
    card.style.display = '';
    var info = curInfo();
    var fwd = info && info.forward_to ? String(info.forward_to) : '';
    card.querySelector('.mb-hero-title').textContent = localPart(addr);
    card.querySelector('.mb-hero-sub span').textContent = tr('mb.detailAlias');
    card.querySelector('.mb-addr').textContent = addr;
    var fwdVl = card.querySelector('.mb-fwd-vl');
    var fwdIc = card.querySelector('.mb-fwd-ic');
    if (fwd) {
      fwdVl.textContent = fwd; fwdVl.classList.remove('muted');
      fwdIc.innerHTML = ICON.forward; fwdIc.classList.add('on');
    } else {
      fwdVl.textContent = tr('mb.detailForwardNone'); fwdVl.classList.add('muted');
      fwdIc.innerHTML = ICON.off; fwdIc.classList.remove('on');
    }
    card.querySelector('.mb-created-vl').textContent = fmtDate(createdOf(addr));
  }

  function refresh() { if (ensureInserted()) update(); }

  // 监听邮箱信息（选择邮箱后 app.js 派发）
  window.addEventListener('mf:mailboxinfo', refresh);

  // 监听 #list-card 显示切换
  function watch() {
    var lc = document.getElementById('list-card');
    if (!lc) { setTimeout(watch, 300); return; }
    ensureInserted(); update();
    try {
      var mo = new MutationObserver(update);
      mo.observe(lc, { attributes: true, attributeFilter: ['style'] });
    } catch (e) {}
  }

  function boot() {
    var tries = 0;
    (function wait() {
      if (document.getElementById('list-card')) { watch(); return; }
      if (tries++ < 60) setTimeout(wait, 200);
    })();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 300); });
  else setTimeout(boot, 300);
  try { window.matchMedia('(display-mode: standalone)').addEventListener('change', function () { setTimeout(boot, 100); }); } catch (e) {}

  window.__cfMailboxDetailRefresh = refresh;
})();
