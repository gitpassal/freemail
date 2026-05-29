(function () {
  function installPreviewConsoleCapture() {
    if (!isPreviewMode() || window.__pwaPreviewConsoleInstalled) return;
    window.__pwaPreviewConsoleInstalled = true;
    window.__pwaPreviewLogs = [];

    function record(level, args) {
      try {
        const message = Array.from(args || []).map((item) => {
          if (item instanceof Error) return item.stack || item.message;
          if (typeof item === 'string') return item;
          try { return JSON.stringify(item); } catch (_) { return String(item); }
        }).join(' ');
        window.__pwaPreviewLogs.push({
          level,
          message,
          time: new Date().toISOString()
        });
      } catch (_) {}
    }

    ['error', 'warn'].forEach((level) => {
      try {
        const original = console[level];
        console[level] = function () {
          record(level, arguments);
          return original.apply(console, arguments);
        };
      } catch (_) {}
    });

    try {
      window.addEventListener('error', (event) => {
        record('error', [event.message || event.error || 'Unhandled error']);
      });
      window.addEventListener('unhandledrejection', (event) => {
        record('error', [event.reason || 'Unhandled rejection']);
      });
    } catch (_) {}
  }

  function isPreviewMode() {
    try {
      return new URLSearchParams(window.location.search).has('pwa-preview');
    } catch (_) {
      return false;
    }
  }

  function isStandalone() {
    if (isPreviewMode()) return true;
    return !!(
      window.navigator.standalone ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
    );
  }

  function isIos() {
    return isPreviewMode() || /iPad|iPhone|iPod/.test(window.navigator.userAgent || '');
  }

  function isMobileViewport() {
    try {
      return isPreviewMode() || (window.matchMedia && window.matchMedia('(max-width: 900px)').matches);
    } catch (_) {
      return isPreviewMode();
    }
  }

  function applyPwaClasses() {
    try {
      const preview = isPreviewMode();
      const standalone = isStandalone();
      const ios = isIos();
      const mobile = isMobileViewport();

      document.documentElement.classList.toggle('is-pwa-preview', preview);
      document.documentElement.classList.toggle('is-standalone', standalone);
      document.documentElement.classList.toggle('is-ios', ios);
      document.documentElement.classList.toggle('is-mobile', mobile);

      document.body?.classList.toggle('is-pwa-preview', preview);
      document.body?.classList.toggle('is-standalone', standalone);
      document.body?.classList.toggle('is-ios', ios);
      document.body?.classList.toggle('is-mobile', mobile);
    } catch (_) {}
  }

  installPreviewConsoleCapture();
  applyPwaClasses();
  document.addEventListener('DOMContentLoaded', applyPwaClasses);
  try {
    window.matchMedia('(display-mode: standalone)').addEventListener('change', applyPwaClasses);
  } catch (_) {}
})();
