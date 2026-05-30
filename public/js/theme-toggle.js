/* =============================================
   主题切换脚本
   支持自动识别系统和手动切换
   ============================================= */

(function() {
  const PREFERENCE_KEY = 'freemail:theme-preference';
  const LEGACY_KEY = 'freemail:theme';
  const LIGHT_THEME_COLOR = '#f2f2f7';
  const DARK_THEME_COLOR = '#16141f';  /* Proton 深紫底，与 standalone 深色一致 */

  let currentTheme = 'light';

  function getSavedTheme() {
    try {
      const saved = localStorage.getItem(PREFERENCE_KEY);
      return saved === 'light' || saved === 'dark' ? saved : null;
    } catch (e) {
      return null;
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(PREFERENCE_KEY, theme);
    } catch (e) {}
  }

  function clearLegacyTheme() {
    try {
      localStorage.removeItem(LEGACY_KEY);
    } catch (e) {}
  }

  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function isStandaloneLike() {
    try {
      const d = document.documentElement;
      return d.classList.contains('is-standalone') || d.classList.contains('is-pwa-preview');
    } catch (e) { return false; }
  }

  function getEffectiveTheme() {
    const saved = getSavedTheme();
    if (saved) {
      return saved;
    }
    // standalone（Proton 风）默认深色为主；桌面/普通浏览器仍跟随系统
    if (isStandaloneLike()) return 'dark';
    return getSystemTheme();
  }

  function updateThemeColor(theme) {
    const color = theme === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    metas.forEach((meta) => meta.setAttribute('content', color));
  }

  function dispatchThemeChange(theme, source) {
    window.dispatchEvent(new CustomEvent('themechange', {
      detail: {
        theme,
        source,
        preference: getSavedTheme() || 'system'
      }
    }));
  }

  function applyTheme(theme) {
    currentTheme = theme;
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    updateThemeColor(theme);
  }

  function setTheme(theme) {
    if (theme !== 'light' && theme !== 'dark') return;
    saveTheme(theme);
    clearLegacyTheme();
    applyTheme(theme);
    updateThemeToggleButton(theme);
    dispatchThemeChange(theme, 'manual');
  }

  function applySystemTheme() {
    const theme = getSystemTheme();
    applyTheme(theme);
    updateThemeToggleButton(theme);
    dispatchThemeChange(theme, 'system');
  }

  function updateThemeToggleButton(theme) {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    const icon = btn.querySelector('svg use');
    if (icon) {
      icon.setAttribute('href', '/icons/sprites.svg#icon-' + (theme === 'dark' ? 'sun' : 'moon'));
    }
    btn.setAttribute('aria-label', theme === 'dark' ? window.t('theme.toLight') : window.t('theme.toDark'));
    btn.title = theme === 'dark' ? window.t('theme.toLight') : window.t('theme.toDark');
  }

  function createThemeToggleButton() {
    const btn = document.createElement('button');
    btn.id = 'theme-toggle';
    btn.className = 'btn btn-ghost theme-toggle-btn';
    btn.setAttribute('aria-label', window.t('theme.toggle'));
    btn.title = currentTheme === 'dark' ? window.t('theme.toLight') : window.t('theme.toDark');
    btn.innerHTML = `
      <span class="btn-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <use href="/icons/sprites.svg#icon-${currentTheme === 'dark' ? 'sun' : 'moon'}"/>
        </svg>
      </span>
    `;

    btn.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      setTheme(currentTheme === 'dark' ? 'light' : 'dark');
    };

    return btn;
  }

  function addThemeToggleToNav() {
    const navActions = document.querySelector('.nav-actions');
    if (!navActions) {
      // 稍后重试
      setTimeout(addThemeToggleToNav, 200);
      return;
    }

    if (document.getElementById('theme-toggle')) {
      updateThemeToggleButton(currentTheme);
      return;
    }

    const toggleBtn = createThemeToggleButton();
    navActions.appendChild(toggleBtn);
  }

  // 监听系统主题变化
  function watchSystemTheme() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', function(e) {
      if (!getSavedTheme()) {
        applyTheme(e.matches ? 'dark' : 'light');
        updateThemeToggleButton(currentTheme);
        dispatchThemeChange(currentTheme, 'system');
      }
    });
  }

  function watchStorageChanges() {
    window.addEventListener('storage', function(e) {
      if (e.key !== PREFERENCE_KEY) return;
      if (e.newValue === 'light' || e.newValue === 'dark') {
        applyTheme(e.newValue);
        updateThemeToggleButton(e.newValue);
        dispatchThemeChange(e.newValue, 'manual');
      } else {
        applySystemTheme();
      }
    });
  }

  function init() {
    clearLegacyTheme();
    const theme = getEffectiveTheme();
    applyTheme(theme);
    updateThemeToggleButton(theme);
    watchSystemTheme();
    watchStorageChanges();

    // standalone 类可能在 pwa.js 之后才打上；若届时仍无用户偏好，应用 Proton 深色默认
    if (!getSavedTheme()) {
      let tries = 0;
      const recheck = function () {
        if (getSavedTheme()) return;                    // 用户已手动选过，不强制
        if (isStandaloneLike() && currentTheme !== 'dark') {
          applyTheme('dark'); updateThemeToggleButton('dark'); dispatchThemeChange('dark', 'system');
          return;
        }
        if (!isStandaloneLike() && tries++ < 25) setTimeout(recheck, 120);  // 等 standalone 类就位
      };
      setTimeout(recheck, 60);
      try {
        window.matchMedia('(display-mode: standalone)').addEventListener('change', recheck);
      } catch (e) {}
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(addThemeToggleToNav, 300);
      });
    } else {
      setTimeout(addThemeToggleToNav, 300);
    }
  }

  // 启动
  init();

  window.freemailTheme = {
    setTheme: setTheme,
    getTheme: function() { return currentTheme; },
    getPreference: function() { return getSavedTheme() || 'system'; },
    useSystem: function() {
      try { localStorage.removeItem(PREFERENCE_KEY); } catch (e) {}
      applySystemTheme();
    },
    toggle: function() { setTheme(currentTheme === 'dark' ? 'light' : 'dark'); }
  };
})();
