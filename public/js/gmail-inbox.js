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

  // ============== 列表层 ==============
  function ensureRoot() {
    if (root) return;
    root = document.createElement('div');
    root.className = 'gmail-inbox';
    root.innerHTML =
      '<div class="gi-topbar">' +
        '<input class="gi-search" type="search" placeholder="' + esc(tr('gmail.search')) + '">' +
      '</div>' +
      '<div class="gi-section-label">' +
        '<button class="gi-filter-btn" aria-label="' + esc(tr('gmail.menuTitle')) + '">' + icon('list') + '</button>' +
        '<span class="gi-section-text">' + esc(tr('gmail.inboxLabel')) + '</span>' +
      '</div>' +
      '<div class="gi-list"><div class="gi-refresh-hint">' + esc(tr('gmail.loading')) + '</div><div class="gi-rows"></div></div>';
    document.body.appendChild(root);

    listEl = root.querySelector('.gi-list');
    var rowsEl = root.querySelector('.gi-rows');
    searchEl = root.querySelector('.gi-search');

    // 筛选按钮（常驻在分组标题行，始终可点）→ 打开左侧筛选抽屉
    root.querySelector('.gi-filter-btn').addEventListener('click', function () { openDrawer(); });
    // 搜索（本地过滤）
    var st;
    searchEl.addEventListener('input', function () {
      clearTimeout(st);
      st = setTimeout(function () { state.query = (searchEl.value || '').trim().toLowerCase(); render(); }, 200);
    });
    // 行点击（委托）
    rowsEl.addEventListener('click', function (ev) {
      var starBtn = ev.target.closest ? ev.target.closest('.gi-star') : null;
      if (starBtn) { ev.stopPropagation(); toggleStar(starBtn.getAttribute('data-star')); return; }
      var rowEl = ev.target.closest ? ev.target.closest('.gi-row') : null;
      if (rowEl) openReader(rowEl.getAttribute('data-id'));
    });
    // 无限滚动 + 下拉刷新
    listEl.addEventListener('scroll', function () {
      if (listEl.scrollTop > 40 && root.classList.contains('search-open')) root.classList.remove('search-open');
      if (state.query || state.loading || !state.hasMore) return;
      if (listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 80) loadPage(state.page + 1, false);
    });
    bindPullToRefresh();
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
      if (dy > 40) root.classList.add('search-open');
      if (dy > 110) hint.classList.add('show'); else hint.classList.remove('show');
    }, { passive: true });
    listEl.addEventListener('touchend', function () {
      if (!pulling) return; pulling = false;
      if (hint.classList.contains('show')) { hint.classList.remove('show'); loadPage(1, true); }
    });
  }

  function rowHTML(e) {
    var a = parseAddr(e.sender);
    var from = a.name || a.email || tr('gmail.unknownSender');
    var unread = !e.is_read;
    return '<div class="gi-row' + (unread ? ' is-unread' : '') + (SHOW_ALIAS ? ' show-alias' : '') + '" data-id="' + e.id + '">' +
      avatarHTML(e.sender) +
      '<div class="gi-row-top"><span class="gi-from">' + esc(from) + '</span></div>' +
      '<span class="gi-date">' + esc(fmtDate(e.received_at)) + '</span>' +
      '<div class="gi-subject">' + esc(e.subject || tr('gmail.noSubject')) + '</div>' +
      '<div class="gi-preview">' + esc(e.preview || '') + '</div>' +
      (SHOW_ALIAS ? '<span class="gi-alias-chip">' + esc(e.mailbox_address || '') + '</span>' : '') +
      '<button class="gi-star' + (e.is_starred ? ' is-on' : '') + '" data-star="' + e.id + '" aria-label="' + esc(tr('gmail.star')) + '">' +
        icon(e.is_starred ? 'star' : 'star-empty') + '</button>' +
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
    if (!items.length) { rowsEl.innerHTML = '<div class="gi-empty">' + esc(tr('gmail.noMail')) + '</div>'; return; }
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
      })
      .catch(function () { state.loading = false; if (root) render(); });
  }

  function openInbox() {
    if (!isStandaloneLike()) return;
    ensureRoot();
    if (root.classList.contains('is-open')) return;
    if (state.items && state.items.length) render();   // 有缓存先立即出图，消除「加载中…」闪烁
    root.classList.add('is-open');
    pushLayer();
    loadPage(1, true);                                  // 再静默刷新
  }
  function hideInbox() { if (root) root.classList.remove('is-open'); }

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
        '<button class="gi-icon-btn gi-r-back" aria-label="back">' + icon('chevron-left') + '</button>' +
        '<div class="gi-r-spacer"></div>' +
        '<button class="gi-icon-btn gi-r-delete" aria-label="' + esc(tr('gmail.delete')) + '">' + icon('trash') + '</button>' +
        '<button class="gi-icon-btn gi-r-unread" aria-label="' + esc(tr('gmail.markUnread')) + '">' + icon('mail') + '</button>' +
        '<button class="gi-icon-btn gi-r-star" aria-label="' + esc(tr('gmail.star')) + '">' + icon('star-empty') + '</button>' +
        '<button class="gi-icon-btn gi-r-more" aria-label="more">' + icon('more-horizontal') + '</button>' +
        '<div class="gi-more-menu"><button class="gi-more-download">' + icon('download') + '<span>' + esc(tr('gmail.download')) + '</span></button></div>' +
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
    reader.querySelector('.gi-r-delete').addEventListener('click', deleteCurrent);
    reader.querySelector('.gi-r-unread').addEventListener('click', markCurrentUnread);
    reader.querySelector('.gi-r-reply').addEventListener('click', function () { openReplyForward('reply'); });
    reader.querySelector('.gi-r-forward').addEventListener('click', function () { openReplyForward('forward'); });
  }

  function openReader(id) {
    ensureReader();
    currentEmail = null;
    var isSent = (state.box === 'sent');
    reader.classList.toggle('is-sent', isSent);
    reader.querySelector('.gi-r-scroll').innerHTML = '<div class="gi-empty">' + esc(tr('gmail.loading')) + '</div>';
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
      var it = state.items.filter(function (x) { return String(x.id) === String(id); })[0];
      if (it && !e.mailbox_address && it.mailbox_address) e.mailbox_address = it.mailbox_address;
      currentEmail = e;
      renderReader(e);
      if (!isSent) { applyStarToItem(id, e.is_starred ? 1 : 0); if (it) it.is_read = 1; render(); }
    }).catch(function () {
      reader.querySelector('.gi-r-scroll').innerHTML = '<div class="gi-empty">' + esc(tr('gmail.loadFail')) + '</div>';
    });
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
      bodyHtml = '<div class="gi-r-body"><iframe class="gi-body-frame" sandbox="allow-same-origin allow-popups" style="height:240px"></iframe></div>';
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
        '<div class="gi-r-sender-sub">' + esc(fmtDate(e.received_at)) + '</div></div></div>' +
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
      ifr.addEventListener('load', function () {
        try {
          var h = ifr.contentWindow.document.body.scrollHeight;
          if (h) ifr.style.height = (h + 24) + 'px';
        } catch (_) { }
      });
      ifr.srcdoc = '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<base target="_blank"><style>body{margin:0;font-family:-apple-system,system-ui,sans-serif;font-size:15px;line-height:1.6;color:#1c1c1e;word-break:break-word}img{max-width:100%;height:auto}</style></head><body>' +
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

  if (isStandaloneLike()) { setTimeout(prefetchInbox, 400); }
})();
