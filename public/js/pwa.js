(function () {
  function isStandalone() {
    return !!(
      window.navigator.standalone ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
    );
  }

  function applyPwaClasses() {
    try {
      document.documentElement.classList.toggle('is-standalone', isStandalone());
      document.documentElement.classList.toggle('is-ios', /iPad|iPhone|iPod/.test(window.navigator.userAgent || ''));
      document.body?.classList.toggle('is-standalone', isStandalone());
    } catch (_) {}
  }

  applyPwaClasses();
  document.addEventListener('DOMContentLoaded', applyPwaClasses);
  try {
    window.matchMedia('(display-mode: standalone)').addEventListener('change', applyPwaClasses);
  } catch (_) {}
})();
