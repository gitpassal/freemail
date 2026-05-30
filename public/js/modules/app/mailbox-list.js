/**
 * 邮箱列表模块（侧边栏）
 * @module modules/app/mailbox-list
 */

import { formatTs, escapeHtml, escapeAttr } from './ui-helpers.js';
import { getCurrentMailbox } from './mailbox-state.js';
import IconHelper from '../icons.js';

// 分页状态
const MB_PAGE_SIZE = 10;
let mbPage = 1;
let mbLastCount = 0;
let mbSearchTerm = '';
let isLoading = false;

/* ===== iOS standalone（Proton 风）专用：隐身图标 + 按时间分组。桌面分支保持原样不变。 ===== */
function isStandaloneLike() {
  try {
    const c = document.documentElement.classList;
    return c.contains('is-standalone') || c.contains('is-pwa-preview');
  } catch (e) { return false; }
}

const INCOGNITO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 11.5C5 7 6.2 4.3 8 3.7c1.4-.5 1.8 1.1 4 1.1s2.6-1.6 4-1.1c1.8.6 3 3.3 3 7.8"/><path d="M2.5 11.5h19"/><circle cx="7.5" cy="16.2" r="3.3"/><circle cx="16.5" cy="16.2" r="3.3"/><path d="M10.5 15.2c.9-.7 2.1-.7 3 0"/></svg>';

// created_at（"YYYY-MM-DD HH:mm:ss" UTC）→ 距今天数
function daysSince(ts) {
  if (!ts) return Infinity;
  try {
    const iso = String(ts).includes('T') ? String(ts) : String(ts).replace(' ', 'T');
    const t = new Date(iso + 'Z').getTime();
    if (isNaN(t)) return Infinity;
    return (Date.now() - t) / 86400000;
  } catch (e) { return Infinity; }
}

// 取本地部分（@ 之前）作为粗体名
function localPart(addr) {
  const s = String(addr || '');
  const i = s.indexOf('@');
  return i > 0 ? s.slice(0, i) : s;
}

/**
 * 渲染邮箱列表项
 * @param {object} mailbox - 邮箱数据
 * @param {boolean} isActive - 是否选中
 * @returns {string}
 */
export function renderMailboxItem(mailbox, isActive = false) {
  const m = mailbox;
  const address = escapeAttr(m.address);
  const displayAddress = escapeHtml(m.address);
  const isPinned = m.is_pinned ? 'pinned' : '';
  const activeClass = isActive ? 'active' : '';
  const time = formatTs(m.created_at);
  const pinIcon = m.is_pinned ? IconHelper.pin(16, 16) : IconHelper.pin(16, 16);
  const pinTitle = m.is_pinned ? window.t('app2.unpinTop') : window.t('app2.pinTop');
  const actions = `
      <div class="mailbox-actions">
        <button class="btn btn-ghost btn-sm pin" onclick="togglePin(event,'${address}')" title="${pinTitle}" aria-label="${pinTitle}">${pinIcon}</button>
        <button class="btn btn-ghost btn-sm del" onclick="deleteMailbox(event,'${address}')" title="${window.t('common.delete')}" aria-label="${window.t('app2.deleteMailbox')}">${IconHelper.trash(16, 16)}</button>
      </div>`;

  // iOS standalone：Proton 行（隐身图标 + 粗体本地名 + 灰色完整地址）
  if (isStandaloneLike()) {
    const name = escapeHtml(localPart(m.address));
    return `
    <div class="mailbox-item proton ${isPinned} ${activeClass}" data-addr="${address}" data-created="${escapeAttr(m.created_at || '')}" onclick="selectMailbox('${address}')">
      <span class="mb-ico" aria-hidden="true">${INCOGNITO_SVG}</span>
      <div class="mailbox-content">
        <span class="address">${name}</span>
        <span class="time">${displayAddress}</span>
      </div>${actions}
    </div>`;
  }

  return `
    <div class="mailbox-item ${isPinned} ${activeClass}" onclick="selectMailbox('${address}')">
      <div class="mailbox-content">
        <span class="address">${displayAddress}</span>
        <span class="time">${time}</span>
      </div>${actions}
    </div>`;
}

/**
 * 渲染邮箱列表
 * @param {Array} mailboxes - 邮箱列表
 * @param {HTMLElement} container - 容器
 */
export function renderMailboxList(mailboxes, container) {
  if (!container) return;
  
  if (!mailboxes || mailboxes.length === 0) {
    container.innerHTML = `<div class="empty-state" style="text-align:center;color:#64748b;padding:20px">${window.t('app2.noMailboxes')}</div>`;
    return;
  }
  
  const currentMb = getCurrentMailbox();

  // iOS standalone：按时间分组（置顶 / 最近一周 / 最近两周 / 更早）
  if (isStandaloneLike()) {
    const groups = [
      { key: 'pinned', label: window.t('mb.groupPinned'), items: [] },
      { key: 'recent', label: window.t('mb.groupRecent'), items: [] },
      { key: 'twoweeks', label: window.t('mb.groupTwoWeeks'), items: [] },
      { key: 'earlier', label: window.t('mb.groupEarlier'), items: [] }
    ];
    mailboxes.forEach(m => {
      if (m.is_pinned) { groups[0].items.push(m); return; }
      const d = daysSince(m.created_at);
      if (d <= 7) groups[1].items.push(m);
      else if (d <= 14) groups[2].items.push(m);
      else groups[3].items.push(m);
    });
    container.innerHTML = groups
      .filter(g => g.items.length)
      .map(g => `<div class="mb-grouplabel">${escapeHtml(g.label)}</div>` +
        `<div class="mb-group-card">${g.items.map(m => renderMailboxItem(m, m.address === currentMb)).join('')}</div>`)
      .join('');
    return;
  }

  container.innerHTML = mailboxes.map(m => renderMailboxItem(m, m.address === currentMb)).join('');
}

/**
 * 渲染分页器
 * @param {object} elements - DOM 元素
 * @param {number} total - 总数
 */
export function renderMbPager(elements, total) {
  try {
    const totalPages = Math.max(1, Math.ceil(total / MB_PAGE_SIZE));
    if (!elements.mbPager) return;
    elements.mbPager.style.display = total > MB_PAGE_SIZE ? 'flex' : 'none';
    if (elements.mbPageInfo) elements.mbPageInfo.textContent = `${mbPage} / ${totalPages}`;
    if (elements.mbPrev) elements.mbPrev.disabled = mbPage <= 1;
    if (elements.mbNext) elements.mbNext.disabled = mbPage >= totalPages;
  } catch(_) {}
}

/**
 * 获取当前页码
 * @returns {number}
 */
export function getCurrentPage() {
  return mbPage;
}

/**
 * 设置页码
 * @param {number} page - 页码
 */
export function setCurrentPage(page) {
  mbPage = page;
}

/**
 * 获取页大小
 * @returns {number}
 */
export function getPageSize() {
  return MB_PAGE_SIZE;
}

/**
 * 上一页
 * @param {Function} loadFn - 加载函数
 */
export function prevMbPage(loadFn) {
  if (mbPage > 1) {
    mbPage -= 1;
    loadFn();
  }
}

/**
 * 下一页
 * @param {Function} loadFn - 加载函数
 * @param {number} total - 总数
 */
export function nextMbPage(loadFn, total) {
  const totalPages = Math.max(1, Math.ceil(total / MB_PAGE_SIZE));
  if (mbPage < totalPages) {
    mbPage += 1;
    loadFn();
  }
}

/**
 * 重置页码
 */
export function resetMbPage() {
  mbPage = 1;
  mbLastCount = 0;
}

/**
 * 设置搜索词
 * @param {string} term - 搜索词
 */
export function setSearchTerm(term) {
  mbSearchTerm = term;
}

/**
 * 获取搜索词
 * @returns {string}
 */
export function getSearchTerm() {
  return mbSearchTerm;
}

/**
 * 设置加载状态
 * @param {boolean} loading - 是否加载中
 */
export function setLoading(loading) {
  isLoading = loading;
}

/**
 * 获取加载状态
 * @returns {boolean}
 */
export function isLoadingMailboxes() {
  return isLoading;
}

/**
 * 设置最后计数
 * @param {number} count - 数量
 */
export function setLastCount(count) {
  mbLastCount = count;
}

/**
 * 获取最后计数
 * @returns {number}
 */
export function getLastCount() {
  return mbLastCount;
}

/**
 * 过滤搜索结果
 * @param {Array} mailboxes - 邮箱列表
 * @param {string} term - 搜索词
 * @returns {Array}
 */
export function filterBySearch(mailboxes, term) {
  if (!term || !term.trim()) return mailboxes;
  const lowerTerm = term.toLowerCase().trim();
  return mailboxes.filter(m => (m.address || '').toLowerCase().includes(lowerTerm));
}

export default {
  renderMailboxItem,
  renderMailboxList,
  renderMbPager,
  getCurrentPage,
  setCurrentPage,
  getPageSize,
  prevMbPage,
  nextMbPage,
  resetMbPage,
  setSearchTerm,
  getSearchTerm,
  setLoading,
  isLoadingMailboxes,
  setLastCount,
  getLastCount,
  filterBySearch
};
