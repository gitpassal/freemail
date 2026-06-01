/* =============================================
   Gmail 风格聚合收件箱（仅 iOS Web App / standalone）
   - 纯前端浮层，独立取数与渲染，不触碰桌面 app.js 的 refresh()
   - 桌面无 tab-bar、且本模块内部 standalone 守卫，桌面零影响
   ============================================= */
(function () {
  'use strict';
  var docEl = document.documentElement;
  function isStandaloneLike() {
    return docEl.classList.contains('is-standalone') || docEl.classList.contains('is-pwa-preview');
  }

  // ---- i18n ----
  try {
    if (window.i18n && window.i18n.addKeys) {
      window.i18n.addKeys({
        'gmail.search':        { zh: '搜索邮件', en: 'Search mail' },
        'gmail.inboxLabel':    { zh: '收件箱', en: 'Inbox' },
        'gmail.noMail':        { zh: '暂无邮件', en: 'No messages' },
        'gmail.loading':       { zh: '加载中…', en: 'Loading…' },
        'gmail.loadFail':      { zh: '加载失败', en: 'Failed to load' },
        'gmail.noSubject':     { zh: '(无主题)', en: '(No subject)' },
        'gmail.unknownSender': { zh: '未知发件人', en: 'Unknown sender' },
        'gmail.star':          { zh: '星标', en: 'Star' },
        'gmail.delete':        { zh: '删除', en: 'Delete' },
        'gmail.deleted':       { zh: '已删除', en: 'Deleted' },
        'gmail.markUnread':    { zh: '标记未读', en: 'Mark unread' },
        'gmail.markedUnread':  { zh: '已标记为未读', en: 'Marked as unread' },
        'gmail.download':      { zh: '下载原始邮件', en: 'Download raw email' },
        'gmail.attachments':   { zh: '附件', en: 'Attachments' },
        'gmail.reply':         { zh: '回复', en: 'Reply' },
        'gmail.forward':       { zh: '转发', en: 'Forward' },
        'gmail.compose':       { zh: '写邮件', en: 'Compose' },
        'gmail.send':          { zh: '发送', en: 'Send' },
        'gmail.sent':          { zh: '邮件已发送', en: 'Email sent' },
        'gmail.sendFail':      { zh: '发送失败', en: 'Send failed' },
        'gmail.to':            { zh: '收件人', en: 'To' },
        'gmail.from':          { zh: '发件人', en: 'From' },
        'gmail.subject':       { zh: '主题', en: 'Subject' },
        'gmail.composeNeedTo': { zh: '请填写收件人', en: 'Enter a recipient' },
        'gmail.composeNoFrom': { zh: '没有可用的发件邮箱', en: 'No mailbox available to send from' },
        'gmail.sentTo':        { zh: '发送至', en: 'To' },
        'gmail.boxInbox':      { zh: '收件箱', en: 'Inbox' },
        'gmail.boxSent':       { zh: '已发送', en: 'Sent' },
        'gmail.boxStarred':    { zh: '星标', en: 'Starred' },
        'gmail.menuTitle':     { zh: '邮箱', en: 'Mailbox' },
        'gmail.byAlias':       { zh: '按别名', en: 'By alias' }
      });
    }
  } catch (e) { }

  function tr(k) { try { return window.t ? window.t(k) : k; } catch (e) { return k; } }
  function toast(m, t) { try { if (window.showToast) window.showToast(m, t || 'info'); } catch (e) { } }
  var SHOW_ALIAS = false;

  function icon(name, extraStyle) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' +
      (extraStyle ? ' style="' + extraStyle + '"' : '') +
      '><use href="/icons/sprites.svg#icon-' + name + '"/></svg>';
  }

  // ---- 小工具 ----
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function parseAddr(raw) {
    raw = String(raw || '').trim();
    var m = raw.match(/^(.*?)<([^>]+)>$/);
    if (m) return { name: m[1].trim().replace(/^["']|["']$/g, ''), email: m[2].trim() };
    if (raw.indexOf('@') >= 0) return { name: '', email: raw };
    return { name: raw, email: '' };
  }
  function domainOf(email) {
    var i = String(email || '').indexOf('@');
    return i >= 0 ? email.slice(i + 1).toLowerCase() : '';
  }
  function hueOf(str) {
    var h = 0, s = String(str || '');
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) % 360; }
    return h;
  }
  function avatarHTML(sender) {
    var a = parseAddr(sender);
    var label = (a.name || a.email || '?').trim();
    var initial = (label.charAt(0) || '?').toUpperCase();
    var dom = domainOf(a.email);
    var bg = 'hsl(' + hueOf(dom || label) + ',52%,52%)';
    var img = dom ? '<img src="https://www.google.com/s2/favicons?domain=' + encodeURIComponent(dom) +
      '&sz=64" loading="lazy" referrerpolicy="no-referrer" alt="" onerror="this.remove()">' : '';
    return '<div class="gi-ava" style="background:' + bg + '"><span class="gi-ava-i">' + esc(initial) + '</span>' + img + '</div>';
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso); if (isNaN(d.getTime())) return '';
    var now = new Date();
    var lang = (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'zh';
    if (d.toDateString() === now.toDateString()) {
      var h = d.getHours(), mi = d.getMinutes();
      return (h < 10 ? '0' : '') + h + ':' + (mi < 10 ? '0' : '') + mi;
    }
    var sameYear = d.getFullYear() === now.getFullYear();
    if (lang === 'en') {
      var mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
      return mon + ' ' + d.getDate() + (sameYear ? '' : ', ' + d.getFullYear());
    }
    return sameYear ? (d.getMonth() + 1) + '月' + d.getDate() + '日'
      : d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
  // 详情头部用：始终「日期 + HH:MM」（与 fmtDate 同样解析，保证和列表时间一致）
  function fmtDateTime(iso) {
    if (!iso) return '';
    var d = new Date(iso); if (isNaN(d.getTime())) return '';
    var now = new Date();
    var lang = (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'zh';
    var h = d.getHours(), mi = d.getMinutes();
    var time = (h < 10 ? '0' : '') + h + ':' + (mi < 10 ? '0' : '') + mi;
    var sameYear = d.getFullYear() === now.getFullYear();
    if (lang === 'en') {
      var mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
      return mon + ' ' + d.getDate() + (sameYear ? '' : ', ' + d.getFullYear()) + ', ' + time;
    }
    return (sameYear ? (d.getMonth() + 1) + '月' + d.getDate() + '日'
      : d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日') + ' ' + time;
  }

  // ---- 取数 ----
  function gapi(path, opts) {
    return fetch(path, Object.assign({ credentials: 'include' }, opts || {})).then(function (r) {
      if (r.status === 401) { try { location.replace('/html/login.html'); } catch (e) { } throw new Error('401'); }
      return r;
    });
  }

  // ---- 状态 ----
  var state = { items: [], page: 1, limit: 20, hasMore: true, loading: false, query: '', box: 'inbox' };
  var root = null, listEl = null, searchEl = null, drawer = null, aliasesLoaded = false;
  var reader = null, currentEmail = null;
  var composer = null;

  // ---- 邮件正文会话内缓存（id→完整邮件），命中则秒开、无需请求 ----
  var emailCache = {};
  // ---- 列表持久缓存（localStorage，按用户隔离），冷启动 SWR 秒开 ----
  function mfUserKey() { try { return localStorage.getItem('mf:lastUserKey') || 'u'; } catch (e) { return 'u'; } }
  function inboxCacheKey() { return 'mf:inboxcache:' + mfUserKey() + ':' + (state.box || 'inbox'); }
  function readInboxCache() {
    try { var raw = localStorage.getItem(inboxCacheKey()); if (!raw) return null; var o = JSON.parse(raw); return (o && Array.isArray(o.items)) ? o.items : null; } catch (e) { return null; }
  }
  function writeInboxCache(items) {
    try { localStorage.setItem(inboxCacheKey(), JSON.stringify({ ts: Date.now(), items: (items || []).slice(0, 40) })); } catch (e) {}
  }
  function readInboxPrefetch() {
    try { var raw = sessionStorage.getItem('mf:prefetch:inbox'); if (!raw) return null; var o = JSON.parse(raw); return (o && Array.isArray(o.data)) ? o.data : (Array.isArray(o) ? o : null); } catch (e) { return null; }
  }
  // ---- 邮件正文持久缓存（localStorage，按用户隔离）：重启后再开读过的邮件秒开 ----
  var emailCacheHydrated = false, emailCacheOrder = [];
  function emailCacheKey() { return 'mf:emailcache:' + mfUserKey(); }
  function rehydrateEmailCache() {
    if (emailCacheHydrated) return; emailCacheHydrated = true;
    try {
      var raw = localStorage.getItem(emailCacheKey()); if (!raw) return;
      var o = JSON.parse(raw); var items = o && o.items;
      if (items && typeof items === 'object') {
        Object.keys(items).forEach(function (id) { if (!emailCache[id]) { emailCache[id] = items[id]; emailCacheOrder.push(String(id)); } });
      }
    } catch (e) {}
  }
  function persistEmail(id) {
    id = String(id);
    emailCacheOrder = emailCacheOrder.filter(function (x) { return x !== id; }); emailCacheOrder.push(id);
    try {
      var keep = emailCacheOrder.slice(-12), out = {};   // 仅留最近 12 封，控制配额
      keep.forEach(function (k) {
        var e = emailCache[k]; if (!e) return;
        if (e.html_content && e.html_content.length > 200000) return;  // 跳过超大 HTML 正文
        out[k] = e;
      });
      localStorage.setItem(emailCacheKey(), JSON.stringify({ ts: Date.now(), items: out }));
    } catch (e) {}
  }
  // 列表渲染后后台预取前几封正文进会话缓存，使点开常见邮件秒开（仅 inbox、仅开着时）
  function prefetchVisible() {
    if (!root || !root.classList.contains('is-open')) return;
    if (state.box !== 'inbox') return;
    state.items.slice(0, 6).forEach(function (it) {
      if (!it || emailCache[it.id]) return;
      gapi('/api/email/' + it.id).then(function (r) { return r.json(); })
        .then(function (e) { e.id = e.id || it.id; emailCache[e.id] = e; }).catch(function () {});
    });
  }
  function skeletonHTML() {
    var row = '<div class="gi-skel-row"><div class="gi-skel-ava"></div><div class="gi-skel-lines"><div class="gi-skel-line w70"></div><div class="gi-skel-line w40"></div></div></div>';
    return '<div class="gi-skel">' + row + row + row + row + row + row + '</div>';
  }

  // ============== 列表层 ==============
  function ensureRoot() {
    if (root) return;
    root = document.createElement('div');
    root.className = 'gmail-inbox';
    root.innerHTML =
      '<div class="gi-list">' +
        // Gmail 搜索胶囊：☰(展开筛选抽屉) + 搜索 + 头像(进设置)；随列表滚走
        '<div class="gi-head">' +
          '<button class="gi-filter-btn" aria-label="' + esc(tr('gmail.menuTitle')) + '">' + icon('list') + '</button>' +
          '<input class="gi-search" type="search" placeholder="' + esc(tr('gmail.search')) + '">' +
          '<button class="gi-avatar" aria-label="account">' + icon('user') + '</button>' +
        '</div>' +
        // 下拉刷新 spinner（蓝色圆形，复刻 Gmail）
        '<div class="gi-refresh-hint">' + icon('refresh') + '</div>' +
        // 收件箱 小标签（紧凑居中；筛选时显示当前 box/别名）
        '<div class="gi-section gi-section-text">' + esc(tr('gmail.inboxLabel')) + '</div>' +
        '<div class="gi-rows"></div>' +
      '</div>';
    document.body.appendChild(root);

    listEl = root.querySelector('.gi-list');
    var rowsEl = root.querySelector('.gi-rows');
    searchEl = root.querySelector('.gi-search');

    // 筛选按钮（搜索胶囊左侧 ☰）→ 打开左侧筛选抽屉
    root.querySelector('.gi-filter-btn').addEventListener('click', function () { openDrawer(); });
    // 头像 → 打开设置（复用底栏 Settings tab）
    var avatarBtn = root.querySelector('.gi-avatar');
    if (avatarBtn) avatarBtn.addEventListener('click', function () {
      try { var s = document.querySelector('.tabbar-item[data-tab="settings"]'); if (s) s.click(); } catch (e) {}
    });
    // 搜索（本地过滤）
    var st;
    searchEl.addEventListener('input', function () {
      clearTimeout(st);
      st = setTimeout(function () { state.query = (searchEl.value || '').trim().toLowerCase(); render(); }, 200);
    });
    // 行点击（委托）：先关闭已展开的滑动行；星标单独处理
    rowsEl.addEventListener('click', function (ev) {
      var t = ev.target;
      var delBtn = t.closest ? t.closest('.gi-row-del') : null;
      if (delBtn) { ev.stopPropagation(); deleteById(delBtn.getAttribute('data-del')); return; }
      var open = rowsEl.querySelector('.gi-row.swiped');
      if (open) { open.classList.remove('swiped'); if (t.closest && t.closest('.gi-row') === open) return; }
      var starBtn = t.closest ? t.closest('.gi-star') : null;
      if (starBtn) { ev.stopPropagation(); toggleStar(starBtn.getAttribute('data-star')); return; }
      var rowEl = t.closest ? t.closest('.gi-row') : null;
      if (rowEl) openReader(rowEl.getAttribute('data-id'));
    });
    // 无限滚动 + 大标题滚动收起
    listEl.addEventListener('scroll', function () {
      root.classList.toggle('title-collapsed', listEl.scrollTop > 36);
      if (state.query || state.loading || !state.hasMore) return;
      if (listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 80) loadPage(state.page + 1, false);
    });
    bindPullToRefresh();
    bindSwipe(rowsEl);
  }

  // 行内横向滑动：左滑露出删除，右滑切换星标（iOS 邮件同款）
  function bindSwipe(rowsEl) {
    var sx = 0, sy = 0, cur = null, main = null, dir = 0, active = false;
    rowsEl.addEventListener('touchstart', function (e) {
      var row = e.target.closest ? e.target.closest('.gi-row') : null;
      if (!row) return;
      cur = row; main = row.querySelector('.gi-row-main');
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; dir = 0; active = false;
    }, { passive: true });
    rowsEl.addEventListener('touchmove', function (e) {
      if (!cur || !main) return;
      var dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
      if (!dir) { if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) + 4) { dir = dx < 0 ? -1 : 1; active = true; } else if (Math.abs(dy) > 10) { dir = 2; } }
      if (active && (dir === -1 || dir === 1)) {
        var tx = Math.max(-84, Math.min(84, dx));
        main.style.transition = 'none';
        main.style.transform = 'translateX(' + tx + 'px)';
        main.style.setProperty('--star-reveal', dx > 0 ? Math.min(1, dx / 70) : 0);
      }
    }, { passive: true });
    rowsEl.addEventListener('touchend', function () {
      if (!cur || !main || !active) { cur = null; main = null; return; }
      var row = cur, m = main; cur = null; main = null;
      m.style.transition = '';
      var tx = 0;
      try { tx = new WebKitCSSMatrix(getComputedStyle(m).transform).m41; } catch (_) {}
      m.style.transform = '';
      m.style.removeProperty('--star-reveal');
      if (tx <= -52) { row.classList.add('swiped'); }
      else { row.classList.remove('swiped'); }
      if (tx >= 52) { toggleStar(row.getAttribute('data-id')); }
    });
  }

  function bindPullToRefresh() {
    var startY = 0, pulling = false;
    var hint = root.querySelector('.gi-refresh-hint');
    listEl.addEventListener('touchstart', function (e) {
      if (listEl.scrollTop <= 0) { startY = e.touches[0].clientY; pulling = true; }
    }, { passive: true });
    listEl.addEventListener('touchmove', function (e) {
      if (!pulling) return;
      var dy = e.touches[0].clientY - startY;
      if (dy > 70) hint.classList.add('show'); else hint.classList.remove('show');
    }, { passive: true });
    listEl.addEventListener('touchend', function () {
      if (!pulling) return; pulling = false;
      if (hint.classList.contains('show')) {
        hint.classList.add('refreshing');
        loadPage(1, true);
        setTimeout(function () { hint.classList.remove('show'); hint.classList.remove('refreshing'); }, 900);
      }
    });
  }

  function rowHTML(e) {
    var a = parseAddr(e.sender);
    var from = a.name || a.email || tr('gmail.unknownSender');
    var unread = !e.is_read;
    return '<div class="gi-row' + (unread ? ' is-unread' : '') + '" data-id="' + e.id + '">' +
      '<div class="gi-row-star-bg">' + icon('star') + '</div>' +
      '<button class="gi-row-del" data-del="' + e.id + '" aria-label="' + esc(tr('gmail.delete')) + '">' + icon('trash') + '<span>' + esc(tr('gmail.delete')) + '</span></button>' +
      '<div class="gi-row-main">' +
        '<span class="gi-unread-dot"></span>' +
        '<div class="gi-row-top"><span class="gi-from">' + esc(from) + '</span></div>' +
        '<span class="gi-date">' + esc(fmtDate(e.received_at)) + icon('chevron-right') + '</span>' +
        '<div class="gi-subject">' + esc(e.subject || tr('gmail.noSubject')) + '</div>' +
        '<div class="gi-preview">' + esc(e.preview || '') + '</div>' +
        '<button class="gi-star' + (e.is_starred ? ' is-on' : '') + '" data-star="' + e.id + '" aria-label="' + esc(tr('gmail.star')) + '">' +
          icon(e.is_starred ? 'star' : 'star-empty') + '</button>' +
      '</div>' +
      '</div>';
  }

  function render() {
    if (!root) return;
    var rowsEl = root.querySelector('.gi-rows');
    var items = state.items;
    if (state.query) {
      var q = state.query;
      items = items.filter(function (e) {
        return (String(e.sender || '').toLowerCase().indexOf(q) >= 0) ||
          (String(e.subject || '').toLowerCase().indexOf(q) >= 0) ||
          (String(e.preview || '').toLowerCase().indexOf(q) >= 0);
      });
    }
    if (!items.length) {
      rowsEl.innerHTML = (state.loading && !state.query)
        ? skeletonHTML()
        : ('<div class="gi-empty">' + esc(tr('gmail.noMail')) + '</div>');
      return;
    }
    rowsEl.innerHTML = items.map(rowHTML).join('');
  }

  function inboxUrl(page) {
    var u = '/api/inbox?page=' + page + '&limit=' + state.limit;
    if (state.box === 'sent') u += '&box=sent';
    else if (state.box === 'starred') u += '&starred=1';
    else if (state.box && state.box.indexOf('mailbox:') === 0) u += '&mailbox=' + encodeURIComponent(state.box.slice(8));
    return u;
  }
  function loadPage(page, reset) {
    if (state.loading) return;
    state.loading = true;
    if (reset && (!state.items || !state.items.length)) render();  // 无缓存时先显示骨架，避免纯空白
    gapi(inboxUrl(page))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var list = (d && d.list) || [];
        if (reset) { state.items = list; if (listEl) listEl.scrollTop = 0; }
        else {
          var seen = {};
          state.items.forEach(function (x) { seen[x.id] = 1; });
          list.forEach(function (x) { if (!seen[x.id]) state.items.push(x); });
        }
        state.page = (d && d.page) || page;
        state.hasMore = !!(d && d.hasMore);
        state.loading = false;
        render();
        if (reset && state.box === 'inbox' && !state.query) { writeInboxCache(state.items); prefetchVisible(); }
      })
      .catch(function () { state.loading = false; if (root) render(); });
  }

  function openInbox() {
    if (!isStandaloneLike()) return;
    ensureRoot();
    if (root.classList.contains('is-open')) return;
    if (!(state.items && state.items.length)) {
      var seed = readInboxPrefetch() || readInboxCache();  // 冷启动：登录预取 / 上次列表缓存
      if (seed && seed.length) state.items = seed;
    }
    if (state.items && state.items.length) render();   // 有缓存先立即出图，消除空白/「加载中…」
    root.classList.add('is-open');
    pushLayer();
    loadPage(1, true);                                  // 再静默刷新
  }
  function hideInbox() { if (root) root.classList.remove('is-open'); }

  // ============== 列表内删除（左滑）==============
  function deleteById(id) {
    if (!id) return;
    var isSent = (state.box === 'sent');
    var delUrl = isSent ? ('/api/sent/' + id) : ('/api/email/' + id);
    // 乐观移除
    state.items = state.items.filter(function (x) { return String(x.id) !== String(id); });
    render();
    gapi(delUrl, { method: 'DELETE' }).then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (d) {
        if (d && d.error) { toast(d.error, 'error'); loadPage(1, true); return; }
        toast(tr('gmail.deleted'), 'success');
      }).catch(function () { toast(tr('gmail.delete') + ' ✗', 'error'); loadPage(1, true); });
  }

  // ============== 星标 ==============
  function applyStarToItem(id, val) {
    var it = state.items.filter(function (x) { return String(x.id) === String(id); })[0];
    if (it) it.is_starred = val;
  }
  function toggleStar(id) {
    var it = state.items.filter(function (x) { return String(x.id) === String(id); })[0];
    var next = it && it.is_starred ? 0 : 1;
    applyStarToItem(id, next);
    if (currentEmail && String(currentEmail.id) === String(id)) currentEmail.is_starred = next;
    render(); updateReaderStar();
    gapi('/api/email/' + id + '/star', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ starred: next })
    }).catch(function () { /* guest/403：保留乐观 UI */ });
  }
  function updateReaderStar() {
    if (!reader || !currentEmail) return;
    var btn = reader.querySelector('.gi-r-star');
    if (!btn) return;
    var on = !!currentEmail.is_starred;
    btn.classList.toggle('is-on', on);
    btn.innerHTML = icon(on ? 'star' : 'star-empty');
  }

  // ============== 阅读页 ==============
  function ensureReader() {
    if (reader) return;
    reader = document.createElement('div');
    reader.className = 'gi-reader';
    reader.innerHTML =
      '<div class="gi-r-topbar">' +
        '<button class="gi-icon-btn gi-r-back" aria-label="back">' + icon('chevron-left') + '<span class="gi-r-back-text">' + esc(tr('gmail.inboxLabel')) + '</span></button>' +
        '<div class="gi-r-spacer"></div>' +
        '<button class="gi-icon-btn gi-r-star" aria-label="' + esc(tr('gmail.star')) + '">' + icon('star-empty') + '</button>' +
        '<button class="gi-icon-btn gi-r-more" aria-label="more">' + icon('more-horizontal') + '</button>' +
        '<div class="gi-more-menu">' +
          '<button class="gi-more-unread">' + icon('mail') + '<span>' + esc(tr('gmail.markUnread')) + '</span></button>' +
          '<button class="gi-more-download">' + icon('download') + '<span>' + esc(tr('gmail.download')) + '</span></button>' +
          '<button class="gi-more-delete gi-danger">' + icon('trash') + '<span>' + esc(tr('gmail.delete')) + '</span></button>' +
        '</div>' +
      '</div>' +
      '<div class="gi-r-scroll"></div>' +
      '<div class="gi-r-actions">' +
        '<button class="gi-r-reply">' + icon('forward', 'transform:scaleX(-1)') + '<span>' + esc(tr('gmail.reply')) + '</span></button>' +
        '<button class="gi-r-forward">' + icon('forward') + '<span>' + esc(tr('gmail.forward')) + '</span></button>' +
      '</div>';
    document.body.appendChild(reader);

    reader.querySelector('.gi-r-back').addEventListener('click', function () { history.back(); });
    reader.querySelector('.gi-r-star').addEventListener('click', function () { if (currentEmail) toggleStar(currentEmail.id); });
    reader.querySelector('.gi-r-more').addEventListener('click', function (ev) {
      ev.stopPropagation(); reader.querySelector('.gi-more-menu').classList.toggle('is-open');
    });
    reader.addEventListener('click', function () { reader.querySelector('.gi-more-menu').classList.remove('is-open'); });
    reader.querySelector('.gi-more-download').addEventListener('click', function () {
      if (!currentEmail) return;
      var url = currentEmail.download || ('/api/email/' + currentEmail.id + '/download');
      var a = document.createElement('a'); a.href = url; a.setAttribute('download', ''); document.body.appendChild(a); a.click(); a.remove();
    });
    reader.querySelector('.gi-more-delete').addEventListener('click', deleteCurrent);
    reader.querySelector('.gi-more-unread').addEventListener('click', markCurrentUnread);
    reader.querySelector('.gi-r-reply').addEventListener('click', function () { openReplyForward('reply'); });
    reader.querySelector('.gi-r-forward').addEventListener('click', function () { openReplyForward('forward'); });
  }

  function openReader(id) {
    ensureReader();
    rehydrateEmailCache();   // 重启后从 localStorage 恢复读过的邮件，命中即秒开
    var isSent = (state.box === 'sent');
    reader.classList.toggle('is-sent', isSent);
    var it = state.items.filter(function (x) { return String(x.id) === String(id); })[0];
    // 会话缓存命中 → 直接全量渲染，零请求秒开
    if (!isSent && emailCache[id]) {
      currentEmail = emailCache[id];
      reader.classList.add('is-open');
      pushLayer();
      renderReader(currentEmail);
      persistEmail(id);   // 读过即落盘，供重启后秒开
      applyStarToItem(id, currentEmail.is_starred ? 1 : 0);
      if (it) { it.is_read = 1; render(); }
      return;
    }
    currentEmail = null;
    // 先用列表行数据「出壳」（主题/发件人/头像/日期/验证码 + 正文骨架），避免整屏 Loading
    renderReaderShell(it || { id: id });
    reader.classList.add('is-open');
    pushLayer();
    gapi(isSent ? ('/api/sent/' + id) : ('/api/email/' + id)).then(function (r) { return r.json(); }).then(function (e) {
      e.id = e.id || id;
      if (isSent) {
        e.__sent = true;
        e.sender = e.from_addr || e.sender || '';
        e.received_at = e.created_at || e.received_at;
        e.content = e.text_content || e.content || '';
      }
      if (it && !e.mailbox_address && it.mailbox_address) e.mailbox_address = it.mailbox_address;
      currentEmail = e;
      if (!isSent) { emailCache[id] = e; persistEmail(id); }   // 落盘供重启后秒开
      renderReader(e);
      if (!isSent) { applyStarToItem(id, e.is_starred ? 1 : 0); if (it) it.is_read = 1; render(); }
    }).catch(function () {
      reader.querySelector('.gi-r-scroll').innerHTML = '<div class="gi-empty">' + esc(tr('gmail.loadFail')) + '</div>';
    });
  }
  // 用列表行数据先渲染阅读器骨架壳（主题/发件人/日期/验证码 + 正文骨架）
  function renderReaderShell(row) {
    var scroll = reader.querySelector('.gi-r-scroll');
    var a = parseAddr(row.sender || '');
    var fromName = a.name || a.email || tr('gmail.unknownSender');
    var codeHtml = row.verification_code ?
      '<div class="gi-r-code" data-code="' + esc(row.verification_code) + '">' + esc(row.verification_code) + '</div>' : '';
    scroll.innerHTML =
      '<div class="gi-r-subject">' + esc(row.subject || tr('gmail.noSubject')) +
        (SHOW_ALIAS && row.mailbox_address ? '<span class="gi-alias-tag">' + esc(row.mailbox_address) + '</span>' : '') + '</div>' +
      '<div class="gi-r-sender">' + avatarHTML(row.sender || '') +
        '<div class="gi-r-sender-info"><div class="gi-r-sender-name">' + esc(fromName) + '</div>' +
        '<div class="gi-r-sender-sub">' + esc(fmtDateTime(row.received_at)) + '</div></div></div>' +
      codeHtml +
      '<div class="gi-r-body"><div class="gi-skel gi-skel-body"><div class="gi-skel-line w90"></div><div class="gi-skel-line w80"></div><div class="gi-skel-line w60"></div><div class="gi-skel-line w85"></div></div></div>';
  }
  function hideReader() { if (reader) { reader.classList.remove('is-open'); reader.querySelector('.gi-more-menu').classList.remove('is-open'); } }

  function renderReader(e) {
    var a = parseAddr(e.sender);
    var fromName = a.name || a.email || tr('gmail.unknownSender');
    var scroll = reader.querySelector('.gi-r-scroll');
    var codeHtml = e.verification_code ?
      '<div class="gi-r-code" data-code="' + esc(e.verification_code) + '">' + esc(e.verification_code) + '</div>' : '';
    var bodyHtml;
    if (e.html_content) {
      bodyHtml = '<div class="gi-r-body"><iframe class="gi-body-frame" sandbox="allow-same-origin allow-popups" style="height:60px"></iframe></div>';
    } else {
      bodyHtml = '<div class="gi-r-body"><pre>' + esc(e.content || '') + '</pre></div>';
    }
    var atts = (e.attachments || []).filter(function (x) { return !x.inline; });
    var attHtml = '';
    if (atts.length) {
      attHtml = '<div class="gi-r-atts"><div class="gi-r-atts-title">' + esc(tr('gmail.attachments')) + ' (' + atts.length + ')</div>' +
        atts.map(function (at) {
          var ext = (String(at.filename || '').split('.').pop() || '').slice(0, 4).toUpperCase();
          return '<a class="gi-att" href="' + esc(at.url) + '" target="_blank" rel="noopener">' +
            '<span class="gi-att-ico">' + esc(ext || '·') + '</span>' +
            '<span class="gi-att-name">' + esc(at.filename || 'attachment') + '</span>' +
            '<span class="gi-att-size">' + fmtSize(at.size) + '</span></a>';
        }).join('') + '</div>';
    }
    scroll.innerHTML =
      '<div class="gi-r-subject">' + esc(e.subject || tr('gmail.noSubject')) +
        (SHOW_ALIAS && e.mailbox_address ? '<span class="gi-alias-tag">' + esc(e.mailbox_address) + '</span>' : '') + '</div>' +
      '<div class="gi-r-sender">' + avatarHTML(e.sender) +
        '<div class="gi-r-sender-info"><div class="gi-r-sender-name">' + esc(fromName) + '</div>' +
        '<div class="gi-r-sender-sub">' + esc(fmtDateTime(e.received_at)) + '</div></div></div>' +
      codeHtml + bodyHtml + attHtml;

    updateReaderStar();

    // 验证码点击复制
    var codeEl = scroll.querySelector('.gi-r-code');
    if (codeEl) codeEl.addEventListener('click', function () {
      try { navigator.clipboard.writeText(codeEl.getAttribute('data-code')); toast(codeEl.getAttribute('data-code'), 'success'); } catch (_) { }
    });
    // iframe 正文渲染 + 高度自适应
    var ifr = scroll.querySelector('iframe.gi-body-frame');
    if (ifr) {
      var fit = function () {
        try {
          var doc = ifr.contentWindow.document;
          var h = Math.max(doc.body ? doc.body.scrollHeight : 0, doc.documentElement ? doc.documentElement.scrollHeight : 0);
          if (h) ifr.style.height = (h + 24) + 'px';
        } catch (_) { }
      };
      ifr.addEventListener('load', function () {
        fit();
        try {
          var b = ifr.contentWindow.document.body;
          // 持续跟随内容高度变化（图片/字体异步加载后的回流），消除「先不全后全」与裁切/留白
          if (window.ResizeObserver && b) { new ResizeObserver(fit).observe(b); }
          var imgs = ifr.contentWindow.document.images || [];
          for (var i = 0; i < imgs.length; i++) { imgs[i].addEventListener('load', fit); imgs[i].addEventListener('error', fit); }
        } catch (_) { }
      });
      // HTML 邮件本质是浅色文档：固定深字白底（iframe 容器亦为白），避免深色模式白底白字
      ifr.srcdoc = '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<base target="_blank"><style>body{margin:0;font-family:-apple-system,system-ui,sans-serif;font-size:15px;line-height:1.6;color:#1c1c1e;background:#fff;word-break:break-word}a{color:#ff6633}img{max-width:100%;height:auto}</style></head><body>' +
        (e.html_content || '') + '</body></html>';
    }
  }

  function fmtSize(n) {
    n = Number(n || 0);
    if (n <= 0) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  function deleteCurrent() {
    if (!currentEmail) return;
    var id = currentEmail.id;
    var delUrl = currentEmail.__sent ? ('/api/sent/' + id) : ('/api/email/' + id);
    gapi(delUrl, { method: 'DELETE' }).then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (d) {
        if (d && d.error) { toast(d.error, 'error'); return; }
        state.items = state.items.filter(function (x) { return String(x.id) !== String(id); });
        render(); toast(tr('gmail.deleted'), 'success'); history.back();
      }).catch(function () { toast(tr('gmail.delete') + ' ✗', 'error'); });
  }
  function markCurrentUnread() {
    if (!currentEmail) return;
    var id = currentEmail.id;
    gapi('/api/email/' + id + '/unread', { method: 'PATCH' }).then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (d) {
        if (d && d.error) { toast(d.error, 'error'); return; }
        var it = state.items.filter(function (x) { return String(x.id) === String(id); })[0];
        if (it) it.is_read = 0;
        render(); toast(tr('gmail.markedUnread'), 'success'); history.back();
      }).catch(function () { });
  }

  // ============== 写信 / 回复 / 转发 ==============
  function availableFroms() {
    var set = {}; var list = [];
    state.items.forEach(function (x) { if (x.mailbox_address && !set[x.mailbox_address]) { set[x.mailbox_address] = 1; list.push(x.mailbox_address); } });
    return list;
  }
  function ensureComposer() {
    if (composer) return;
    composer = document.createElement('div');
    composer.className = 'gi-compose';
    composer.innerHTML =
      '<div class="gi-c-topbar">' +
        '<button class="gi-icon-btn gi-c-close" aria-label="close">' + icon('x') + '</button>' +
        '<div class="gi-c-title">' + esc(tr('gmail.compose')) + '</div>' +
        '<button class="gi-c-send">' + esc(tr('gmail.send')) + '</button>' +
      '</div>' +
      '<div class="gi-c-body">' +
        '<div class="gi-c-field"><label>' + esc(tr('gmail.from')) + '</label><select class="gi-c-from"></select></div>' +
        '<div class="gi-c-field"><label>' + esc(tr('gmail.to')) + '</label><input class="gi-c-to" type="text" placeholder="foo@example.com"></div>' +
        '<div class="gi-c-field"><label>' + esc(tr('gmail.subject')) + '</label><input class="gi-c-subject" type="text"></div>' +
        '<textarea class="gi-c-textarea"></textarea>' +
      '</div>';
    document.body.appendChild(composer);
    composer.querySelector('.gi-c-close').addEventListener('click', function () { history.back(); });
    composer.querySelector('.gi-c-send').addEventListener('click', sendComposer);
  }
  function openCompose(opts) {
    ensureComposer();
    opts = opts || {};
    var froms = availableFroms();
    if (opts.from && froms.indexOf(opts.from) < 0) froms.unshift(opts.from);
    var sel = composer.querySelector('.gi-c-from');
    sel.innerHTML = froms.map(function (f) { return '<option value="' + esc(f) + '">' + esc(f) + '</option>'; }).join('');
    if (opts.from) sel.value = opts.from;
    composer.querySelector('.gi-c-to').value = opts.to || '';
    composer.querySelector('.gi-c-subject').value = opts.subject || '';
    composer.querySelector('.gi-c-textarea').value = opts.body || '';
    var sendBtn = composer.querySelector('.gi-c-send');
    sendBtn.disabled = !froms.length;
    composer.querySelector('.gi-c-title').textContent = opts.title || tr('gmail.compose');
    composer.classList.add('is-open');
    pushLayer();
  }
  function hideCompose() { if (composer) composer.classList.remove('is-open'); }

  function stripPrefix(s, re) { return String(s || '').replace(re, '').trim(); }
  function openReplyForward(mode) {
    if (!currentEmail) return;
    var e = currentEmail;
    var a = parseAddr(e.sender);
    var orig = '\n\n----------\n' + tr('gmail.from') + ': ' + (e.sender || '') +
      '\n' + tr('gmail.sentTo') + ': ' + (e.mailbox_address || e.to_addrs || '') +
      '\n' + tr('gmail.subject') + ': ' + (e.subject || '') + '\n\n' +
      (e.content || (e.preview || ''));
    if (mode === 'reply') {
      openCompose({
        title: tr('gmail.reply'),
        from: e.mailbox_address || '',
        to: a.email || '',
        subject: 'Re: ' + stripPrefix(e.subject, /^(re:\s*)+/i),
        body: orig
      });
    } else {
      openCompose({
        title: tr('gmail.forward'),
        from: e.mailbox_address || '',
        to: '',
        subject: 'Fwd: ' + stripPrefix(e.subject, /^(fwd:\s*)+/i),
        body: orig
      });
    }
  }
  function sendComposer() {
    var from = composer.querySelector('.gi-c-from').value;
    var to = composer.querySelector('.gi-c-to').value.trim();
    var subject = composer.querySelector('.gi-c-subject').value.trim();
    var body = composer.querySelector('.gi-c-textarea').value;
    if (!from) { toast(tr('gmail.composeNoFrom'), 'warn'); return; }
    if (!to) { toast(tr('gmail.composeNeedTo'), 'warn'); return; }
    var html = '<div>' + esc(body).replace(/\n/g, '<br>') + '</div>';
    var sendBtn = composer.querySelector('.gi-c-send');
    sendBtn.disabled = true;
    gapi('/api/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: from, to: to, subject: subject, html: html })
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok && !(res.d && res.d.error)) { toast(tr('gmail.sent'), 'success'); history.back(); }
        else { toast((res.d && res.d.error) || tr('gmail.sendFail'), 'error'); sendBtn.disabled = false; }
      }).catch(function () { toast(tr('gmail.sendFail'), 'error'); sendBtn.disabled = false; });
  }

  // ============== 历史/返回分层 ==============
  function topmost() {
    if (composer && composer.classList.contains('is-open')) return 'compose';
    if (reader && reader.classList.contains('is-open')) return 'reader';
    if (drawer && drawer.classList.contains('is-open')) return 'drawer';
    if (root && root.classList.contains('is-open')) return 'inbox';
    return null;
  }
  function pushLayer() { try { history.pushState({ gi: 1 }, ''); } catch (e) { } }
  window.addEventListener('popstate', function () {
    var t = topmost();
    if (t === 'compose') hideCompose();
    else if (t === 'reader') hideReader();
    else if (t === 'drawer') closeDrawer();
    else if (t === 'inbox') hideInbox();
  });

  // ============== 左侧筛选抽屉 ==============
  function ensureDrawer() {
    if (drawer) return;
    var ov = document.createElement('div');
    ov.className = 'gi-drawer-overlay';
    drawer = document.createElement('div');
    drawer.className = 'gi-drawer';
    drawer.innerHTML =
      '<div class="gi-drawer-title">' + esc(tr('gmail.menuTitle')) + '</div>' +
      '<button class="gi-drawer-item" data-box="inbox">' + icon('inbox') + '<span>' + esc(tr('gmail.boxInbox')) + '</span></button>' +
      '<button class="gi-drawer-item" data-box="sent">' + icon('send') + '<span>' + esc(tr('gmail.boxSent')) + '</span></button>' +
      '<button class="gi-drawer-item" data-box="starred">' + icon('star') + '<span>' + esc(tr('gmail.boxStarred')) + '</span></button>' +
      '<div class="gi-drawer-sub">' + esc(tr('gmail.byAlias')) + '</div>' +
      '<div class="gi-drawer-aliases"></div>';
    document.body.appendChild(ov);
    document.body.appendChild(drawer);
    drawer._overlay = ov;
    ov.addEventListener('click', function () { history.back(); });
    drawer.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('.gi-drawer-item') : null;
      if (!b) return;
      selectBox(b.getAttribute('data-box'), (b.querySelector('span') ? b.querySelector('span').textContent : b.textContent));
    });
  }
  function openDrawer() {
    ensureDrawer();
    loadAliases();
    drawer.classList.add('is-open');
    drawer._overlay.classList.add('is-open');
    markActiveDrawer();
    pushLayer();
  }
  function closeDrawer() {
    if (drawer) { drawer.classList.remove('is-open'); drawer._overlay.classList.remove('is-open'); }
  }
  function markActiveDrawer() {
    if (!drawer) return;
    var items = drawer.querySelectorAll('.gi-drawer-item');
    for (var i = 0; i < items.length; i++) items[i].classList.toggle('is-active', items[i].getAttribute('data-box') === state.box);
  }
  function selectBox(box, label) {
    state.box = box || 'inbox';
    state.query = ''; if (searchEl) searchEl.value = '';
    var txt = root && root.querySelector('.gi-section-text');
    if (txt) txt.textContent = label || tr('gmail.boxInbox');
    markActiveDrawer();
    try { history.back(); } catch (e) { closeDrawer(); }   // 关抽屉
    loadPage(1, true);
  }
  function loadAliases() {
    if (aliasesLoaded || !drawer) return;
    aliasesLoaded = true;
    var box = drawer.querySelector('.gi-drawer-aliases');
    gapi('/api/mailboxes?page=1&size=50').then(function (r) { return r.json(); }).then(function (d) {
      var arr = Array.isArray(d) ? d : ((d && (d.list || d.mailboxes || d.items)) || []);
      box.innerHTML = arr.map(function (m) {
        var a = (m && m.address) ? m.address : (typeof m === 'string' ? m : '');
        if (!a) return '';
        return '<button class="gi-drawer-item" data-box="mailbox:' + esc(a) + '"><span>' + esc(a) + '</span></button>';
      }).join('');
    }).catch(function () { aliasesLoaded = false; });
  }

  // 确保发件人列表可用（底栏 FAB 在未打开收件箱时直接写信）
  function ensureFromsThenCompose(opts) {
    ensureRoot();
    if (availableFroms().length) { openCompose(opts || {}); return; }
    gapi('/api/inbox?page=1&limit=20').then(function (r) { return r.json(); }).then(function (d) {
      var list = (d && d.list) || [];
      if (!state.items.length) state.items = list;
      openCompose(opts || {});
    }).catch(function () { openCompose(opts || {}); });
  }

  // 后台预取首屏，使默认进入收件箱时尽量零等待
  function prefetchInbox() {
    if (!isStandaloneLike()) return;
    try { ensureRoot(); } catch (e) { return; }
    if (!state.items.length && !state.loading) loadPage(1, true);
  }

  window.GmailInbox = {
    open: openInbox,
    close: function () { hideCompose(); hideReader(); closeDrawer(); hideInbox(); },
    refresh: function () { if (root && root.classList.contains('is-open')) loadPage(1, true); },
    openCompose: function (opts) { ensureFromsThenCompose(opts || {}); },
    openMail: function (id) { openInbox(); openReader(id); },
    prefetch: prefetchInbox
  };

  if (isStandaloneLike()) { setTimeout(prefetchInbox, 0); }
})();
