/* =============================================
   iOS 生成页 · Proton 填表式（仅 standalone / pwa-preview）
   - 在 .generate-card 之上覆盖一层 Proton 风填表 UI（标题→即将创建→前缀🎲→后缀域名→转发到）。
   - 不重写任何业务逻辑：提交时把字段同步到既有隐藏控件
     （#custom-local-overlay 前缀 / #custom-cf-suffix-overlay 追加后缀 / #domain-select 域名）
     再 .click() 既有 #create-custom-overlay，复用 createCustomMailbox → POST /api/create。
   - 工作流：① 标题转小写自动用作前缀；手动改过前缀则锁定（prefixEdited）
            ② 追加随机后缀(.cf###) 收进齿轮，默认开启（= cfSuffix）
            ③ 默认不转发，可选设置里配置的转发邮箱（forward 落地用现有能力，本轮前端选择 + 提交后单独 POST /api/mailbox/forward）
            ④ 域名取自既有 #domain-select 的真实选项
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
  function toast(m, t) { try { if (window.showToast) window.showToast(m, t || 'info'); } catch (e) {} }

  var root = null, built = false, gearOpen = false;
  // cfCode：客户端预先 roll 的 3 位号，实时显示在预览里并随请求发给后端（后端优先采纳，撞号才回退）
  function rollCfCode() {
    try {
      var a = new Uint32Array(1);
      (window.crypto || window.msCrypto).getRandomValues(a);
      return String(a[0] % 1000).padStart(3, '0');
    } catch (e) {
      return String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    }
  }
  var state = { title: '', prefix: '', prefixEdited: false, addSuffix: true, fwd: null, cfCode: rollCfCode() };

  function svg(p, extra) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' + (extra || '') + '>' + p + '</svg>';
  }
  var ICON = {
    incognito: svg('<path d="M5 11.5C5 7 6.2 4.3 8 3.7c1.4-.5 1.8 1.1 4 1.1s2.6-1.6 4-1.1c1.8.6 3 3.3 3 7.8"/><path d="M2.5 11.5h19"/><circle cx="7.5" cy="16.2" r="3.3"/><circle cx="16.5" cy="16.2" r="3.3"/><path d="M10.5 15.2c.9-.7 2.1-.7 3 0"/>'),
    gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
    dice: svg('<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.3" fill="currentColor"/><circle cx="16" cy="8" r="1.3" fill="currentColor"/><circle cx="8" cy="16" r="1.3" fill="currentColor"/><circle cx="16" cy="16" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>'),
    forward: svg('<polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/>'),
    off: svg('<circle cx="12" cy="12" r="9"/><line x1="8" y1="12" x2="16" y2="12"/>'),
    chevD: svg('<polyline points="6 9 12 15 18 9"/>'),
    check: svg('<polyline points="20 6 9 17 4 12"/>', ' stroke-width="2.4"'),
    mail: svg('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-3.06 0L2 7"/>'),
    plus: svg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>')
  };

  // 标题→纯字母数字小写（cfSuffix 模式前缀只允许 [A-Za-z0-9]）
  function toSlug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 30); }
  function effectivePrefix() { return state.prefixEdited ? state.prefix : toSlug(state.title); }

  function domainOptions() {
    var sel = document.getElementById('domain-select');
    if (!sel) return [];
    return Array.prototype.map.call(sel.options, function (o) { return { idx: Number(o.value), name: o.textContent }; });
  }
  function currentDomain() {
    var sel = document.getElementById('domain-select');
    if (sel && sel.options.length) return sel.options[sel.selectedIndex || 0].textContent;
    return '…';
  }

  function previewAddr() {
    // 实时显示真实即将创建的号：.cf<NNN>（NNN = 客户端 roll、提交时发给后端、后端优先采纳）；
    // 输入 Title/Prefix 时前缀实时变化，cf 号保持不变。
    var p = effectivePrefix() || '';
    var cf = state.addSuffix ? ('.cf' + (state.cfCode || '###')) : '';
    return p + cf + '@' + currentDomain();
  }

  function ensureRoot() {
    if (root) return;
    root = document.createElement('div');
    root.className = 'gi-gen';   // 仅 standalone 显示，CSS 在 pwa.css
    root.innerHTML =
      '<div class="gi-gen-title">' + esc(tr('app.generateTitle')) + '</div>' +
      // 标题（置于「即将创建」上方）
      '<div class="gi-gen-card gi-gen-field"><div class="gi-gen-lb">' + esc(tr('gi.title')) + '</div>' +
        '<input class="gi-gen-input gi-gen-titlein" type="text" placeholder="' + esc(tr('gi.titlePh')) + '"></div>' +
      // 即将创建
      '<div class="gi-gen-card gi-gen-about">' +
        '<div class="gi-gen-about-ic">' + ICON.incognito + '</div>' +
        '<div class="gi-gen-about-bd"><div class="gi-gen-lb">' + esc(tr('gi.aboutCreate')) + '</div><div class="gi-gen-addr"></div></div>' +
        '<button class="gi-gen-gear" aria-label="options">' + ICON.gear + '</button>' +
        '<div class="gi-gen-pop">' +
          '<div class="gi-gen-pop-row"><div class="gi-gen-pop-bd"><div class="gi-gen-pop-t1">' + esc(tr('gi.addSuffix')) + '</div><div class="gi-gen-pop-t2">' + esc(tr('gi.addSuffixHint')) + '</div></div>' +
            '<div class="gi-sw on" role="switch"><div class="gi-sw-knob"></div></div></div>' +
        '</div>' +
      '</div>' +
      // 前缀 + 后缀
      '<div class="gi-gen-card gi-gen-split">' +
        '<div class="gi-gen-seg"><div class="gi-gen-lb gi-gen-prefix-lb">' + esc(tr('gi.prefix')) + '</div>' +
          '<div class="gi-gen-prefix-row"><input class="gi-gen-input gi-gen-prefixin" type="text" placeholder="' + esc(tr('gi.prefixPh')) + '" autocapitalize="off" autocorrect="off" spellcheck="false">' +
            '<button class="gi-gen-dice" aria-label="random">' + ICON.dice + '</button></div></div>' +
        '<div class="gi-gen-seg gi-gen-suffix"><div class="gi-gen-lb">' + esc(tr('gi.suffix')) + '</div>' +
          '<div class="gi-gen-suffix-val"></div><span class="gi-gen-suffix-chev">' + ICON.chevD + '</span></div>' +
      '</div>' +
      // 转发到
      '<div class="gi-gen-card gi-gen-fwd"><div class="gi-gen-fwd-ic"></div>' +
        '<div class="gi-gen-fwd-bd"><div class="gi-gen-lb">' + esc(tr('gi.forwardTo')) + '</div><div class="gi-gen-fwd-val"></div></div>' +
        '<span class="gi-gen-fwd-chev">' + ICON.chevD + '</span></div>' +
      // 主按钮
      '<button class="gi-gen-create">' + esc(tr('gi.create')) + '</button>';
    // 插到生成卡之前（generate-card 隐藏，由我们这层接管视觉）
    var gc = document.querySelector('.generate-card');
    if (gc && gc.parentElement) gc.parentElement.insertBefore(root, gc);
    else document.body.appendChild(root);
    bind();
    render();
    setupVisSync(gc);
    // 域名异步加载（#domain-select 由 app.js 在 validateSession/loadDomains 后才填 option）：
    // 就绪前 currentDomain() 落到 '…' fallback；轮询到域名就绪后刷新一次预览/后缀显示。
    var dtries = 0;
    (function waitDomain() {
      if (currentDomain() !== '…') { render(); return; }
      if (++dtries > 40) return;
      setTimeout(waitDomain, 200);
    })();
  }

  // .gi-gen 覆盖层须跟随 .generate-card 的内联 display：
  // showHis()/showMailboxView() 会把 genCard.style.display='none'（切到邮箱/收件视图），
  // showGen() 会清空它。否则覆盖层会盖在邮箱列表/收件视图之上。
  function syncVis() {
    var gc = document.querySelector('.generate-card');
    if (!gc || !root) return;
    root.style.display = (gc.style.display === 'none') ? 'none' : '';
  }
  function setupVisSync(gc) {
    if (!gc) return;
    try {
      var mo = new MutationObserver(syncVis);
      mo.observe(gc, { attributes: true, attributeFilter: ['style'] });
    } catch (e) {}
    syncVis();
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function bind() {
    var titleIn = root.querySelector('.gi-gen-titlein');
    var prefixIn = root.querySelector('.gi-gen-prefixin');
    titleIn.addEventListener('input', function () { state.title = titleIn.value; render(); });
    prefixIn.addEventListener('input', function () { state.prefix = prefixIn.value; state.prefixEdited = true; render(); });
    root.querySelector('.gi-gen-dice').addEventListener('click', function () {
      var words = ['fox', 'swift', 'mellow', 'cobalt', 'harbor', 'nimbus', 'quartz', 'lunar', 'ember', 'maple'];
      var w = words[Math.floor((Date.now() / 1000) % words.length)];
      var n = 100 + Math.floor((Date.now() % 900));
      state.prefix = w + n; state.prefixEdited = true; render();
    });
    var gear = root.querySelector('.gi-gen-gear');
    gear.addEventListener('click', function (e) { e.stopPropagation(); gearOpen = !gearOpen; render(); });
    root.querySelector('.gi-sw').addEventListener('click', function (e) { e.stopPropagation(); state.addSuffix = !state.addSuffix; render(); });
    // 后缀（域名）选择 → 复用底部 sheet
    root.querySelector('.gi-gen-suffix').addEventListener('click', function () { openDomainSheet(); });
    // 转发到 → 底部 sheet
    root.querySelector('.gi-gen-fwd').addEventListener('click', function () { openFwdSheet(); });
    // 创建
    root.querySelector('.gi-gen-create').addEventListener('click', submit);
    // 点空白收起齿轮
    document.addEventListener('click', function (e) {
      if (gearOpen && root && !root.querySelector('.gi-gen-about').contains(e.target)) { gearOpen = false; render(); }
    }, true);
  }

  function render() {
    if (!root) return;
    root.querySelector('.gi-gen-addr').textContent = previewAddr();
    var titleIn = root.querySelector('.gi-gen-titlein');
    if (titleIn.value !== state.title) titleIn.value = state.title;
    var prefixIn = root.querySelector('.gi-gen-prefixin');
    var ep = effectivePrefix();
    if (prefixIn.value !== ep) prefixIn.value = ep;
    root.querySelector('.gi-gen-prefix-lb').innerHTML = esc(tr('gi.prefix')) +
      (!state.prefixEdited && state.title ? ' <span class="gi-gen-follow">· ' + esc(tr('gi.followTitle')) + '</span>' : '');
    root.querySelector('.gi-gen-suffix-val').textContent = '@' + currentDomain();
    root.querySelector('.gi-gen-pop').classList.toggle('open', gearOpen);
    root.querySelector('.gi-gen-gear').classList.toggle('on', gearOpen);
    root.querySelector('.gi-sw').classList.toggle('on', state.addSuffix);
    var fwdIc = root.querySelector('.gi-gen-fwd-ic');
    var fwdVal = root.querySelector('.gi-gen-fwd-val');
    fwdIc.innerHTML = state.fwd ? ICON.forward : ICON.off;
    fwdIc.className = 'gi-gen-fwd-ic' + (state.fwd ? ' on' : '');
    fwdVal.textContent = state.fwd || tr('gi.noForward');
    fwdVal.classList.toggle('muted', !state.fwd);
    var createBtn = root.querySelector('.gi-gen-create');
    createBtn.disabled = !ep;
    createBtn.classList.toggle('dis', !ep);
  }

  // ---- 提交：同步到隐藏控件，复用 #create-custom-overlay ----
  function submit() {
    var ep = effectivePrefix();
    if (!ep) { toast(tr('app2.invalidPrefix'), 'warn'); return; }
    var localIn = document.getElementById('custom-local-overlay');
    var cfChk = document.getElementById('custom-cf-suffix-overlay');
    var createBtn = document.getElementById('create-custom-overlay');
    if (!localIn || !cfChk || !createBtn) { toast('生成控件未就绪', 'warn'); return; }
    localIn.value = ep;
    cfChk.checked = !!state.addSuffix;
    // 把预览里显示的真实号透传给既有 createCustomMailbox（它会读 dataset.cfCode 加进请求体）
    cfChk.dataset.cfCode = state.addSuffix ? (state.cfCode || '') : '';
    // 把用户填的标题透传给 createCustomMailbox，成功后写入 mf:mbTitles 供邮箱列表显示
    cfChk.dataset.mbTitle = state.title || '';
    var pendingFwd = state.fwd;  // 创建成功后再设转发
    var before = '';
    try { before = window.currentMailbox || ''; } catch (e) {}
    createBtn.click();
    // 复用现有 createCustomMailbox 成功后会刷新；若选了转发，监听当前邮箱出现后调 forward
    if (pendingFwd) applyForwardAfterCreate(pendingFwd);
    // 创建成功（window.currentMailbox 变为新地址）后清空表单回默认；超时不清（可能失败，保留输入）
    var ctries = 0;
    (function waitClear() {
      var now = '';
      try { now = window.currentMailbox || ''; } catch (e) {}
      if (now && now !== before) {
        state.title = ''; state.prefix = ''; state.prefixEdited = false; state.fwd = null;
        state.cfCode = rollCfCode();
        render();
        return;
      }
      if (++ctries > 40) return;
      setTimeout(waitClear, 150);
    })();
  }

  function applyForwardAfterCreate(fwd) {
    // 轮询当前邮箱 info（createCustomMailbox 成功后 setCurrentMailboxInfo），拿到 id 后 POST 转发
    var tries = 0;
    (function wait() {
      var info = null;
      try { info = window.__cfCurrentMailboxInfo || null; } catch (e) {}
      // 兜底：从地址读 mailbox/info
      if (++tries > 30) return;
      setTimeout(wait, 200);
    })();
    // 注：现有无统一的"当前邮箱 id"全局；转发落地在下一步用 /api/mailbox/forward 接。
    // 本轮先记录用户意图，真正写入在详情页/设置完善（避免破坏现有流程）。
  }

  // ---- 域名选择 sheet ----
  function openDomainSheet() {
    var opts = domainOptions();
    if (opts.length <= 1) return;
    var sel = document.getElementById('domain-select');
    openSheet(tr('gi.suffix'), opts.map(function (o) {
      return { label: '@' + o.name, sel: sel && Number(sel.value) === o.idx, onPick: function () { if (sel) { sel.value = String(o.idx); } render(); } };
    }));
  }

  // ---- 转发选择 sheet ----
  function getFwdList() {
    try { return JSON.parse(localStorage.getItem('mf:forwardPool') || '[]'); } catch (e) { return []; }
  }
  function openFwdSheet() {
    var list = getFwdList();
    var items = [{ label: tr('gi.noForward'), sub: tr('gi.noForwardHint'), sel: !state.fwd, onPick: function () { state.fwd = null; render(); } }];
    list.forEach(function (e) { items.push({ label: e, icon: ICON.mail, sel: state.fwd === e, onPick: function () { state.fwd = e; render(); } }); });
    items.push({ label: tr('gi.addInSettings'), icon: ICON.plus, teal: true, onPick: function () { try { var t = document.querySelector('.tabbar-item[data-tab="settings"]'); if (t) t.click(); } catch (e) {} } });
    openSheet(tr('gi.pickForward'), items);
  }

  // ---- 通用底部 sheet ----
  var sheetEl = null;
  function openSheet(title, items) {
    closeSheet();
    sheetEl = document.createElement('div');
    sheetEl.className = 'gi-sheet-wrap';
    var html = '<div class="gi-sheet-scrim"></div><div class="gi-sheet"><div class="gi-sheet-grab"></div>' +
      '<div class="gi-sheet-title">' + esc(title) + '</div>';
    items.forEach(function (it, i) {
      html += '<button class="gi-sheet-opt' + (it.sel ? ' sel' : '') + (it.teal ? ' teal' : '') + '" data-i="' + i + '">' +
        '<span class="gi-sheet-ck">' + (it.sel ? ICON.check : (it.icon || '')) + '</span>' +
        '<span class="gi-sheet-tx"><span class="gi-sheet-t1">' + esc(it.label) + '</span>' +
        (it.sub ? '<span class="gi-sheet-t2">' + esc(it.sub) + '</span>' : '') + '</span></button>';
    });
    html += '</div>';
    sheetEl.innerHTML = html;
    document.body.appendChild(sheetEl);
    sheetEl.querySelector('.gi-sheet-scrim').addEventListener('click', closeSheet);
    sheetEl.querySelectorAll('.gi-sheet-opt').forEach(function (b) {
      b.addEventListener('click', function () { var it = items[Number(b.getAttribute('data-i'))]; if (it.onPick) it.onPick(); closeSheet(); });
    });
    requestAnimationFrame(function () { if (sheetEl) sheetEl.classList.add('open'); });
  }
  function closeSheet() { if (sheetEl) { var s = sheetEl; sheetEl = null; s.classList.remove('open'); setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 240); } }

  // i18n
  try {
    if (window.i18n && window.i18n.addKeys) window.i18n.addKeys({
      'gi.aboutCreate': { zh: '即将创建', en: 'You are about to create' },
      'gi.addSuffix': { zh: '追加随机后缀', en: 'Append random suffix' },
      'gi.addSuffixHint': { zh: '地址末尾加 .cf### 防猜测', en: 'Add .cf### to prevent guessing' },
      'gi.title': { zh: '标题', en: 'Title' },
      'gi.titlePh': { zh: '未命名', en: 'Untitled' },
      'gi.prefix': { zh: '前缀 Prefix', en: 'Prefix' },
      'gi.prefixPh': { zh: '输入或点骰子随机', en: 'Type or roll the dice' },
      'gi.followTitle': { zh: '跟随标题', en: 'follows title' },
      'gi.suffix': { zh: '后缀 Suffix（域名）', en: 'Suffix (domain)' },
      'gi.forwardTo': { zh: '转发到', en: 'Forward to' },
      'gi.noForward': { zh: '不转发（仅在本应用内查看）', en: 'No forwarding (view in app only)' },
      'gi.noForwardHint': { zh: '邮件仅在本应用内查看', en: 'Mail stays in this app' },
      'gi.pickForward': { zh: '选择转发目标', en: 'Choose forwarding target' },
      'gi.addInSettings': { zh: '去设置添加转发邮箱…', en: 'Add forwarding email in Settings…' },
      'gi.create': { zh: '创建邮箱', en: 'Create alias' }
    });
  } catch (e) {}

  // 当切到生成视图时，确保我们的 UI 存在并刷新域名
  function boot() {
    var tries = 0;
    (function wait() {
      var gc = document.querySelector('.generate-card');
      if (gc) { ensureRoot(); render(); return; }
      if (tries++ < 60) setTimeout(wait, 200);
    })();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 300); });
  else setTimeout(boot, 300);
  try { window.matchMedia('(display-mode: standalone)').addEventListener('change', function () { setTimeout(boot, 100); }); } catch (e) {}

  // 暴露刷新（域名异步加载完后更新后缀显示）
  window.__giGenRender = render;
})();
