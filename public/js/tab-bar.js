/* =============================================
   iOS 底部 Tab Bar（纯 UI 层）
   - 仅在 standalone / pwa-preview 的主应用页生效
   - 点击转发到 app-mobile.js 既有控件（#m-tab-generate /
     #m-tab-history / #enter-mailbox）与顶栏既有操作，
     不改动任何功能逻辑
   ============================================= */
(function () {
  var docEl = document.documentElement;

  function isStandaloneLike() {
    return docEl.classList.contains('is-standalone') ||
           docEl.classList.contains('is-pwa-preview');
  }

  function icon(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<use href="/icons/sprites.svg#icon-' + name + '"/></svg>';
  }

  function clickEl(id) {
    var el = document.getElementById(id);
    if (el) { el.click(); return true; }
    return false;
  }

  function isShown(id) {
    var el = document.getElementById(id);
    if (!el) return false;
    try { return window.getComputedStyle(el).display !== 'none'; }
    catch (e) { return el.style.display !== 'none'; }
  }

  var TABS = [
    { key: 'inbox', label: '收件箱', icon: 'inbox' },
    { key: 'generate', label: '生成', icon: 'sparkles' },
    { key: 'mailboxes', label: '邮箱', icon: 'list' },
    { key: 'settings', label: '设置', icon: 'settings' }
  ];

  var bar = null, sheet = null, overlay = null;

  function setActive(key) {
    if (!bar) return;
    var items = bar.querySelectorAll('.tabbar-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('is-active', items[i].getAttribute('data-tab') === key);
    }
  }

  function onTab(key) {
    if (key === 'settings') { openSheet(); return; }
    closeSheet();
    if (key === 'generate') {
      clickEl('m-tab-generate');
      setActive('generate');
    } else if (key === 'mailboxes') {
      clickEl('m-tab-history');
      setActive('mailboxes');
    } else if (key === 'inbox') {
      // 复用"进入邮箱"按钮（其内置无邮箱时的提示守卫）
      if (!clickEl('enter-mailbox')) { clickEl('m-tab-generate'); }
      setActive('inbox');
    }
  }

  function buildBar() {
    bar = document.createElement('nav');
    bar.className = 'tabbar';
    bar.setAttribute('role', 'tablist');
    bar.setAttribute('aria-label', '主导航');
    TABS.forEach(function (t) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tabbar-item';
      btn.setAttribute('data-tab', t.key);
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-label', t.label);
      btn.innerHTML = icon(t.icon) + '<span class="tabbar-label">' + t.label + '</span>';
      btn.addEventListener('click', function () { onTab(t.key); });
      bar.appendChild(btn);
    });
    document.body.appendChild(bar);
    setActive('generate');
  }

  function makeRow(opts) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'settings-row' + (opts.danger ? ' is-danger' : '');
    btn.innerHTML = icon(opts.icon) + '<span>' + opts.label + '</span>';
    btn.addEventListener('click', function () {
      closeSheet();
      if (opts.onClick) opts.onClick();
    });
    return btn;
  }

  // 每次打开时重建行，确保按角色显示的管理入口反映最新状态
  function populateSheet() {
    // 清空旧行（保留 handle + title）
    var rows = sheet.querySelectorAll('.settings-row');
    for (var i = 0; i < rows.length; i++) { rows[i].remove(); }

    sheet.appendChild(makeRow({
      icon: 'moon', label: '切换主题',
      onClick: function () { clickEl('theme-toggle'); }
    }));
    if (isShown('admin')) {
      sheet.appendChild(makeRow({
        icon: 'wrench', label: '用户管理',
        onClick: function () { clickEl('admin'); }
      }));
    }
    if (isShown('all-mailboxes')) {
      sheet.appendChild(makeRow({
        icon: 'package', label: '所有邮箱',
        onClick: function () { clickEl('all-mailboxes'); }
      }));
    }
    if (document.getElementById('repo')) {
      sheet.appendChild(makeRow({
        icon: 'github', label: 'GitHub 仓库',
        onClick: function () { clickEl('repo'); }
      }));
    }
    sheet.appendChild(makeRow({
      icon: 'logout', label: '退出登录', danger: true,
      onClick: function () { clickEl('logout'); }
    }));
  }

  function buildSheet() {
    overlay = document.createElement('div');
    overlay.className = 'settings-sheet-overlay';
    overlay.addEventListener('click', closeSheet);

    sheet = document.createElement('div');
    sheet.className = 'settings-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', '设置');
    sheet.setAttribute('aria-modal', 'true');

    var handle = document.createElement('div');
    handle.className = 'settings-sheet-handle';
    var title = document.createElement('div');
    title.className = 'settings-sheet-title';
    title.textContent = '设置';
    sheet.appendChild(handle);
    sheet.appendChild(title);

    document.body.appendChild(overlay);
    document.body.appendChild(sheet);
  }

  function openSheet() {
    if (!sheet) return;
    populateSheet();
    overlay.classList.add('is-open');
    requestAnimationFrame(function () { sheet.classList.add('is-open'); });
  }

  function closeSheet() {
    if (!sheet) return;
    sheet.classList.remove('is-open');
    overlay.classList.remove('is-open');
  }

  var tries = 0;
  function init() {
    if (!isStandaloneLike()) return;
    if (document.querySelector('.tabbar')) return;
    // 等待主应用控件就绪（app.html 异步注入 + app-mobile.js 创建切换控件）
    var ready = document.querySelector('.generate-card') || document.getElementById('m-tab-generate');
    if (!ready && tries < 60) { tries++; setTimeout(init, 200); return; }
    if (!ready) return; // 非主应用页（如登录/无 app 内容）则不注入
    buildBar();
    buildSheet();
  }

  function boot() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 300); });
    } else {
      setTimeout(init, 300);
    }
    // standalone 状态可能在 pwa.js 之后才标记，监听 display-mode 兜底
    try {
      window.matchMedia('(display-mode: standalone)').addEventListener('change', function () {
        setTimeout(init, 100);
      });
    } catch (e) {}
  }
  boot();
})();
