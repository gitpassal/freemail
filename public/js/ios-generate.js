/* =============================================
   iOS 生成页重排（仅 standalone / pwa-preview）
   - 把"生成按钮组(.generate-action)"从配置卡内提到"当前邮箱卡(.mailbox-display-section)"下方，
     让主操作（随机生成）位于显眼处，符合设计稿：邮箱卡 → 生成按钮 → 折叠高级选项。
   - 高级选项（域名/长度）默认折叠，点 OPTIONS 头展开。
   - 纯 DOM 位置调整 + class 切换；不改任何控件 id 与事件绑定，功能零影响。
   - 桌面与普通移动浏览器不执行（standalone 守卫）。
   ============================================= */
(function () {
  'use strict';
  var d = document.documentElement;
  function isStandaloneLike() {
    return d.classList.contains('is-standalone') || d.classList.contains('is-pwa-preview');
  }
  if (!isStandaloneLike()) return;

  var done = false;

  function rearrange() {
    if (done) return;
    var card = document.querySelector('.generate-card');
    if (!card) return false;
    var dispSection = card.querySelector('.mailbox-display-section');
    var configSection = card.querySelector('.mailbox-config-section');
    var action = card.querySelector('.generate-action');
    if (!dispSection || !configSection || !action) return false;

    // 1) 把生成按钮组提到邮箱卡之后、配置卡之前（独立成块）
    if (action.parentElement !== card || action.previousElementSibling !== dispSection) {
      // 包一层容器，便于样式定位
      var holder = document.getElementById('gi-gen-actions');
      if (!holder) {
        holder = document.createElement('div');
        holder.id = 'gi-gen-actions';
        holder.className = 'gi-gen-actions';
      }
      holder.appendChild(action);
      // mailbox-layout 是 disp + config 的父；把 holder 插到 layout 之后
      var layout = card.querySelector('.mailbox-layout') || dispSection.parentElement;
      if (layout && layout.parentElement) {
        layout.parentElement.insertBefore(holder, layout.nextSibling);
      } else {
        card.appendChild(holder);
      }
    }

    // 2) 高级选项默认折叠：给配置卡加 .gi-collapsed，点 OPTIONS 头切换
    var header = configSection.querySelector('.section-header');
    if (header && !header.__giBound) {
      header.__giBound = true;
      configSection.classList.add('gi-collapsed');
      header.addEventListener('click', function (ev) {
        // 避免点到原 config-toggle 按钮时双触发
        configSection.classList.toggle('gi-collapsed');
      });
    }

    done = true;
    return true;
  }

  function boot() {
    var tries = 0;
    (function wait() {
      if (rearrange()) return;
      if (tries++ < 60) setTimeout(wait, 200);
    })();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 300); });
  } else {
    setTimeout(boot, 300);
  }
  // app-mobile 视图切换可能重渲染，display-mode 变化兜底
  try {
    window.matchMedia('(display-mode: standalone)').addEventListener('change', function () { done = false; setTimeout(boot, 100); });
  } catch (e) {}
})();
