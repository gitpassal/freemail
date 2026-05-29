/**
 * 邮箱设置模块 - 处理转发和收藏相关的前端逻辑
 * @module mailbox-settings
 */

import { mockApi } from './modules/app/mock-api.js';

// 注册邮箱总览相关的 i18n 键（mbx2.* 前缀）
// 放在此模块以保证 mailboxes.js 与 app.js 两个入口都能加载到这些键
if (window.i18n && window.i18n.addKeys) {
  window.i18n.addKeys({
    // —— mailboxes.js ——
    'mbx2.jumping': { zh: '跳转中...', en: 'Opening…' },
    'mbx2.pinUpdated': { zh: '置顶状态已更新', en: 'Pin status updated' },
    'mbx2.loginAllowedDone': { zh: '已允许登录', en: 'Login allowed' },
    'mbx2.loginDeniedDone': { zh: '已禁止登录', en: 'Login denied' },
    'mbx2.confirmDelete': { zh: '确定删除邮箱 {addr}？', en: 'Delete mailbox {addr}?' },
    'mbx2.deleteFailed': { zh: '删除失败', en: 'Delete failed' },
    'mbx2.setPasswordTitle': { zh: '设置密码', en: 'Set password' },
    'mbx2.setPasswordMsg': { zh: '为 {addr} 设置新密码：', en: 'Set a new password for {addr}:' },
    'mbx2.resetPasswordTitle': { zh: '重置密码', en: 'Reset password' },
    'mbx2.resetPasswordMsg': { zh: '确定将 {addr} 的密码重置为默认密码（邮箱地址）？', en: 'Reset the password of {addr} to the default (the email address)?' },
    'mbx2.enterNewPassword': { zh: '请输入新密码', en: 'Enter a new password' },
    'mbx2.passwordSet': { zh: '密码已设置', en: 'Password set' },
    'mbx2.passwordReset': { zh: '密码已重置', en: 'Password reset' },
    'mbx2.unknownError': { zh: '未知错误', en: 'Unknown error' },
    'mbx2.batchCountHint': { zh: '输入邮箱后将显示数量统计', en: 'Enter addresses to see the count' },
    'mbx2.recognized': { zh: '已识别 {n} 个邮箱地址', en: '{n} addresses detected' },
    'mbx2.enterForwardTarget': { zh: '请输入转发目标', en: 'Enter a forwarding target' },
    'mbx2.batchDone': { zh: '批量操作完成', en: 'Bulk action completed' },
    'mbx2.batchAllowTitle': { zh: '批量放行登录', en: 'Bulk allow login' },
    'mbx2.batchAllowMsg': { zh: '输入要允许登录的邮箱地址（每行一个或用逗号分隔）：', en: 'Enter addresses to allow login (one per line or comma-separated):' },
    'mbx2.batchDenyTitle': { zh: '批量禁止登录', en: 'Bulk deny login' },
    'mbx2.batchDenyMsg': { zh: '输入要禁止登录的邮箱地址（每行一个或用逗号分隔）：', en: 'Enter addresses to deny login (one per line or comma-separated):' },
    'mbx2.batchFavoriteTitle': { zh: '批量收藏', en: 'Bulk favorite' },
    'mbx2.batchFavoriteMsg': { zh: '输入要收藏的邮箱地址（每行一个或用逗号分隔）：', en: 'Enter addresses to favorite (one per line or comma-separated):' },
    'mbx2.batchUnfavoriteTitle': { zh: '批量取消收藏', en: 'Bulk unfavorite' },
    'mbx2.batchUnfavoriteMsg': { zh: '输入要取消收藏的邮箱地址（每行一个或用逗号分隔）：', en: 'Enter addresses to unfavorite (one per line or comma-separated):' },
    'mbx2.batchForwardTitle': { zh: '批量设置转发', en: 'Bulk set forwarding' },
    'mbx2.batchForwardMsg': { zh: '输入要设置转发的邮箱地址（每行一个或用逗号分隔）：', en: 'Enter addresses to set forwarding (one per line or comma-separated):' },
    'mbx2.batchClearForwardTitle': { zh: '批量清除转发', en: 'Bulk clear forwarding' },
    'mbx2.batchClearForwardMsg': { zh: '输入要清除转发的邮箱地址（每行一个或用逗号分隔）：', en: 'Enter addresses to clear forwarding (one per line or comma-separated):' },
    // —— mailbox-settings.js ——
    'mbx2.mailboxLabel': { zh: '邮箱', en: 'Mailbox' },
    'mbx2.forwardEmptyPh': { zh: '留空则不转发', en: 'Leave blank to disable forwarding' },
    'mbx2.forwardHint': { zh: '设置后，此邮箱收到的邮件将自动转发到指定地址', en: 'Once set, mail received by this mailbox is auto-forwarded to the target address' },
    'mbx2.saving': { zh: '保存中...', en: 'Saving…' },
    'mbx2.forwardSetTo': { zh: '已设置转发到: {addr}', en: 'Forwarding set to: {addr}' },
    'mbx2.forwardCleared': { zh: '已取消转发', en: 'Forwarding cleared' },
    'mbx2.setFailed': { zh: '设置失败', en: 'Update failed' },
    'mbx2.saveFailedRetry': { zh: '保存失败，请重试', en: 'Save failed, please retry' },
    'mbx2.unfavorited': { zh: '已取消收藏', en: 'Unfavorited' },
    'mbx2.opFailedRetry': { zh: '操作失败，请重试', en: 'Action failed, please retry' },
    'mbx2.selectMailboxFirst': { zh: '请先选择邮箱', en: 'Select a mailbox first' },
    'mbx2.batchFavoriteDone': { zh: '已收藏 {n} 个邮箱', en: 'Favorited {n} mailboxes' },
    'mbx2.batchUnfavoriteDone': { zh: '已取消收藏 {n} 个邮箱', en: 'Unfavorited {n} mailboxes' },
    'mbx2.batchFailed': { zh: '批量操作失败', en: 'Bulk action failed' },
    'mbx2.forwardToTitle': { zh: '转发到: {addr}', en: 'Forward to: {addr}' },
    'mbx2.setForward': { zh: '设置转发', en: 'Set forwarding' },
    'mbx2.favorite': { zh: '收藏', en: 'Favorite' },
    // —— render.js / grid-view.js / list-view.js ——
    'mbx2.pinned': { zh: '已置顶', en: 'Pinned' },
    'mbx2.notPinned': { zh: '未置顶', en: 'Not pinned' },
    'mbx2.defaultPassword': { zh: '默认密码', en: 'Default password' },
    'mbx2.passwordSetLabel': { zh: '已设密码', en: 'Password set' },
    'mbx2.canLogin': { zh: '可登录', en: 'Login enabled' },
    'mbx2.setPassword': { zh: '设置密码', en: 'Set password' },
    'mbx2.resetPassword': { zh: '重置密码', en: 'Reset password' },
    'mbx2.viewMail': { zh: '查看邮件', en: 'View mail' },
    'mbx2.forwardNotSet': { zh: '未设置转发', en: 'No forwarding' },
    'mbx2.copyAddress': { zh: '复制地址', en: 'Copy address' },
    'mbx2.pin': { zh: '置顶', en: 'Pin' },
    'mbx2.unpin': { zh: '取消置顶', en: 'Unpin' },
    'mbx2.moreActions': { zh: '更多操作', en: 'More actions' },
    'mbx2.deleteMailbox': { zh: '删除邮箱', en: 'Delete mailbox' },
    'mbx2.noMailboxes': { zh: '暂无邮箱', en: 'No mailboxes' },
    'mbx2.view': { zh: '查看', en: 'View' },
    'mbx2.more': { zh: '更多', en: 'More' },
    'mbx2.colStatus': { zh: '状态', en: 'Status' },
    'mbx2.colCreated': { zh: '创建时间', en: 'Created' },
    'mbx2.colActions': { zh: '操作', en: 'Actions' }
  });
}

/**
 * 内部 API 请求封装（支持 guest 模式）
 */
async function apiRequest(path, options = {}) {
  if (window.__GUEST_MODE__) {
    return mockApi(path, options);
  }
  return fetch(path, options);
}

// ========== 转发设置 ==========

/**
 * 打开转发设置弹窗
 * @param {number} mailboxId - 邮箱 ID
 * @param {string} mailboxAddress - 邮箱地址
 * @param {string|null} currentForwardTo - 当前转发目标
 */
export function openForwardDialog(mailboxId, mailboxAddress, currentForwardTo) {
  // 移除已存在的弹窗
  const existing = document.getElementById('forward-dialog');
  if (existing) existing.remove();
  
  const dialog = document.createElement('div');
  dialog.id = 'forward-dialog';
  dialog.className = 'modal-overlay';
  dialog.innerHTML = `
    <div class="modal-content" style="max-width: 400px;">
      <div class="modal-header">
        <h3>${window.t('app.forwardSettings')}</h3>
        <button class="modal-close" onclick="document.getElementById('forward-dialog').remove()">×</button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom: 10px; color: var(--text-secondary); font-size: 14px;">
          ${window.t('mbx2.mailboxLabel')}: <strong>${escapeHtml(mailboxAddress)}</strong>
        </p>
        <div class="form-group">
          <label for="forward-to-input">${window.t('mbx.forwardTarget')}</label>
          <input type="email" id="forward-to-input" class="form-input"
                 placeholder="${window.t('mbx2.forwardEmptyPh')}"
                 value="${escapeHtml(currentForwardTo || '')}">
          <p style="margin-top: 5px; color: var(--text-tertiary); font-size: 12px;">
            ${window.t('mbx2.forwardHint')}
          </p>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="document.getElementById('forward-dialog').remove()">${window.t('common.cancel')}</button>
        <button class="btn btn-primary" id="save-forward-btn">${window.t('common.save')}</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  // 绑定保存事件
  document.getElementById('save-forward-btn').onclick = async () => {
    const forwardTo = document.getElementById('forward-to-input').value.trim();
    await saveForwardSetting(mailboxId, forwardTo || null);
  };
  
  // 按 ESC 关闭
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') dialog.remove();
  });
  
  // 点击背景关闭
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.remove();
  });
  
  // 聚焦输入框
  setTimeout(() => document.getElementById('forward-to-input').focus(), 100);
}

/**
 * 保存转发设置
 * @param {number} mailboxId - 邮箱 ID
 * @param {string|null} forwardTo - 转发目标邮箱
 */
export async function saveForwardSetting(mailboxId, forwardTo) {
  const btn = document.getElementById('save-forward-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = window.t('mbx2.saving');
  }
  
  try {
    const resp = await apiRequest('/api/mailbox/forward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mailbox_id: mailboxId, forward_to: forwardTo })
    });
    
    const result = await resp.json();
    
    if (resp.ok && result.success) {
      showToast(forwardTo ? window.t('mbx2.forwardSetTo', { addr: forwardTo }) : window.t('mbx2.forwardCleared'), 'success');
      document.getElementById('forward-dialog')?.remove();
      // 触发刷新事件
      window.dispatchEvent(new CustomEvent('mailbox-settings-updated', { 
        detail: { mailboxId, forward_to: forwardTo } 
      }));
    } else {
      showToast(result.error || window.t('mbx2.setFailed'), 'error');
    }
  } catch (e) {
    console.error('保存转发设置失败:', e);
    showToast(window.t('mbx2.saveFailedRetry'), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = window.t('common.save');
    }
  }
}

// ========== 收藏功能 ==========

/**
 * 切换邮箱收藏状态
 * @param {number} mailboxId - 邮箱 ID
 * @param {Function} [callback] - 成功后的回调函数
 * @returns {Promise<{success: boolean, is_favorite: number}>}
 */
export async function toggleFavorite(mailboxId, callback) {
  try {
    const resp = await apiRequest('/api/mailbox/favorite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mailbox_id: mailboxId })
    });
    
    const result = await resp.json();
    
    if (resp.ok && result.success) {
      const isFav = result.is_favorite;
      showToast(isFav ? window.t('mbx.favorited') : window.t('mbx2.unfavorited'), 'success');
      // 触发刷新事件
      window.dispatchEvent(new CustomEvent('mailbox-settings-updated', { 
        detail: { mailboxId, is_favorite: isFav } 
      }));
      if (callback) callback(result);
      return result;
    } else {
      showToast(result.error || window.t('toast.opFailed'), 'error');
      return { success: false };
    }
  } catch (e) {
    console.error('切换收藏失败:', e);
    showToast(window.t('mbx2.opFailedRetry'), 'error');
    return { success: false };
  }
}

/**
 * 批量设置收藏状态
 * @param {number[]} mailboxIds - 邮箱 ID 列表
 * @param {boolean} isFavorite - 是否收藏
 * @returns {Promise<{success: boolean}>}
 */
export async function batchSetFavorite(mailboxIds, isFavorite) {
  if (!mailboxIds || mailboxIds.length === 0) {
    showToast(window.t('mbx2.selectMailboxFirst'), 'warning');
    return { success: false };
  }
  
  try {
    const resp = await apiRequest('/api/mailboxes/batch-favorite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mailbox_ids: mailboxIds, is_favorite: isFavorite })
    });
    
    const result = await resp.json();
    
    if (resp.ok && result.success) {
      showToast(isFavorite ? window.t('mbx2.batchFavoriteDone', { n: result.updated_count }) : window.t('mbx2.batchUnfavoriteDone', { n: result.updated_count }), 'success');
      window.dispatchEvent(new CustomEvent('mailbox-settings-batch-updated'));
      return result;
    } else {
      showToast(result.error || window.t('mbx2.batchFailed'), 'error');
      return { success: false };
    }
  } catch (e) {
    console.error('批量设置收藏失败:', e);
    showToast(window.t('mbx2.opFailedRetry'), 'error');
    return { success: false };
  }
}

// ========== UI 辅助函数 ==========

/**
 * 渲染转发状态标识
 * @param {string|null} forwardTo - 转发目标
 * @returns {string} HTML 字符串
 */
export function renderForwardBadge(forwardTo) {
  if (!forwardTo) return '';
  return `<span class="badge badge-forward" title="${window.t('mbx2.forwardToTitle', { addr: escapeHtml(forwardTo) })}">↪️</span>`;
}

/**
 * 渲染收藏状态标识
 * @param {number|boolean} isFavorite - 是否收藏
 * @returns {string} HTML 字符串
 */
export function renderFavoriteBadge(isFavorite) {
  return isFavorite ? `<span class="badge badge-favorite" title="${window.t('mbx.favorited')}">⭐</span>` : '';
}

/**
 * 创建转发设置按钮
 * @param {number} mailboxId - 邮箱 ID
 * @param {string} mailboxAddress - 邮箱地址
 * @param {string|null} forwardTo - 当前转发目标
 * @returns {HTMLButtonElement}
 */
export function createForwardButton(mailboxId, mailboxAddress, forwardTo) {
  const btn = document.createElement('button');
  btn.className = 'btn btn-ghost btn-sm';
  btn.title = forwardTo ? window.t('mbx2.forwardToTitle', { addr: forwardTo }) : window.t('mbx2.setForward');
  btn.innerHTML = forwardTo ? '↪️' : '➡️';
  btn.onclick = (e) => {
    e.stopPropagation();
    openForwardDialog(mailboxId, mailboxAddress, forwardTo);
  };
  return btn;
}

/**
 * 创建收藏按钮
 * @param {number} mailboxId - 邮箱 ID
 * @param {number|boolean} isFavorite - 是否收藏
 * @param {Function} [onUpdate] - 更新后的回调
 * @returns {HTMLButtonElement}
 */
export function createFavoriteButton(mailboxId, isFavorite, onUpdate) {
  const btn = document.createElement('button');
  btn.className = 'btn btn-ghost btn-sm';
  btn.title = isFavorite ? window.t('app.unfavorite') : window.t('mbx2.favorite');
  btn.innerHTML = isFavorite ? '⭐' : '☆';
  btn.onclick = async (e) => {
    e.stopPropagation();
    const result = await toggleFavorite(mailboxId);
    if (result.success && onUpdate) {
      onUpdate(result.is_favorite);
    }
  };
  return btn;
}

// ========== 工具函数 ==========

/**
 * HTML 转义
 * @param {string} str - 原始字符串
 * @returns {string} 转义后的字符串
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 显示提示消息
 * @param {string} message - 消息内容
 * @param {string} type - 类型: success, error, warning, info
 */
function showToast(message, type = 'info') {
  // 尝试使用全局 showToast
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
    return;
  }
  
  // 简单的 fallback
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 24px;
    border-radius: 8px;
    color: white;
    font-size: 14px;
    z-index: 10000;
    animation: slideIn 0.3s ease;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
  `;
  
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// 导出弹窗样式（可在页面加载时注入）
export function injectDialogStyles() {
  if (document.getElementById('mailbox-settings-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'mailbox-settings-styles';
  style.textContent = `
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      backdrop-filter: blur(4px);
    }
    .modal-content {
      background: var(--bg-primary, #fff);
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      width: 90%;
      max-width: 500px;
      animation: modalIn 0.2s ease;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-color, #e5e7eb);
    }
    .modal-header h3 {
      margin: 0;
      font-size: 18px;
    }
    .modal-close {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: var(--text-secondary, #6b7280);
      padding: 0;
      line-height: 1;
    }
    .modal-close:hover {
      color: var(--text-primary, #111827);
    }
    .modal-body {
      padding: 20px;
    }
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 16px 20px;
      border-top: 1px solid var(--border-color, #e5e7eb);
    }
    .form-group {
      margin-bottom: 15px;
    }
    .form-group label {
      display: block;
      margin-bottom: 6px;
      font-weight: 500;
      font-size: 14px;
    }
    .form-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border-color, #d1d5db);
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.2s;
    }
    .form-input:focus {
      outline: none;
      border-color: var(--primary-color, #3b82f6);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      margin-left: 4px;
    }
    .badge-forward {
      background: rgba(59, 130, 246, 0.1);
    }
    .badge-favorite {
      background: rgba(245, 158, 11, 0.1);
    }
    @keyframes modalIn {
      from {
        opacity: 0;
        transform: scale(0.95) translateY(-10px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}
