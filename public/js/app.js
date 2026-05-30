/**
 * Freemail 主应用入口
 * @module app
 */

import { cacheGet, cacheSet, setCurrentUserKey, getCurrentUserKey } from './storage.js';
import { openForwardDialog, toggleFavorite, injectDialogStyles } from './mailbox-settings.js';
import IconHelper from './modules/icons.js';

// 导入模块
import { formatTs, formatTsMobile, extractCode, escapeHtml, escapeAttr } from './modules/app/ui-helpers.js';
import { mockApi, MOCK_STATE } from './modules/app/mock-api.js';
import { showConfirm } from './modules/app/confirm-dialog.js';
import { startAutoRefresh, stopAutoRefresh, initVisibilityTracking } from './modules/app/auto-refresh.js';
import { getCurrentMailbox, setCurrentMailbox, loadCurrentMailbox, clearCurrentMailbox, setCurrentMailboxInfo, getCurrentMailboxInfo } from './modules/app/mailbox-state.js';
import { renderPager, sliceByPage, prevPage, nextPage, resetPager, setView, isSentViewActive, renderEmailItem, markViewLoaded, isFirstLoad } from './modules/app/email-list.js';
import { renderMailboxList, renderMbPager, getCurrentPage, setCurrentPage, getPageSize, prevMbPage, nextMbPage, resetMbPage, setSearchTerm, getSearchTerm, setLoading, isLoadingMailboxes, setLastCount, getLastCount } from './modules/app/mailbox-list.js';
import { initSessionFromCache, validateSession, isGuest, isAdmin, applySessionUI, initGuestMode } from './modules/app/session.js';
import { loadDomains, getStoredLength, saveLength, updateRangeProgress, getSelectedDomainIndex, populateDomains, STORAGE_KEYS } from './modules/app/domains.js';
import { initCompose, showSentEmailDetail } from './modules/app/compose.js';
import { showEmailDetail, deleteEmailById, deleteSentById, copyFromEmailList, prefetchEmails } from './modules/app/email-viewer.js';
import { generateMailbox, generateNameMailbox, createCustomMailbox, updateEmailDisplay, selectMailboxAddress, toggleMailboxPin, deleteMailboxAddress, copyMailboxAddress, clearAllEmails, logout } from './modules/app/mailbox-actions.js';

// 全局状态
window.__GUEST_MODE__ = false;
window.__MOCK_STATE__ = MOCK_STATE;
try { if (sessionStorage.getItem('mf:just_logged_in') === '1') sessionStorage.removeItem('mf:just_logged_in'); } catch(_) {}

// 注入弹窗样式
injectDialogStyles();

// 注册本模块组新增的 i18n 键（app2.* 前缀）
try {
  window.i18n?.addKeys?.({
    'app2.updating': { zh: '正在更新…', en: 'Updating…' },
    'app2.countdownRefresh': { zh: '{n}s 后刷新', en: 'Refresh in {n}s' },
    'app2.selectMailboxFirst': { zh: '请先选择一个邮箱', en: 'Select a mailbox first' },
    'app2.noPreview': { zh: '(暂无预览)', en: '(No preview)' },
    'app2.previewCode': { zh: '验证码: {code}', en: 'Code: {code}' },
    'app2.copyContentOrCode': { zh: '复制内容或验证码', en: 'Copy content or code' },
    'app2.deleteRecord': { zh: '删除记录', en: 'Delete record' },
    'app2.mailContent': { zh: '内容', en: 'Content' },
    'app2.contentCopied': { zh: '内容已复制', en: 'Content copied' },
    'app2.clickToCopy': { zh: '点击复制', en: 'Click to copy' },
    'app2.codeCopiedShort': { zh: '验证码已复制', en: 'Code copied' },
    'app2.downloadEml': { zh: '下载 EML', en: 'Download EML' },
    'app2.statusQueued': { zh: '排队中', en: 'Queued' },
    'app2.statusDelivered': { zh: '已送达', en: 'Delivered' },
    'app2.statusFailed': { zh: '发送失败', en: 'Failed' },
    'app2.statusProcessing': { zh: '处理中', en: 'Processing' },
    'app2.confirmDeleteMail': { zh: '确定删除这封邮件？', en: 'Delete this message?' },
    'app2.confirmDeleteSent': { zh: '确定删除这条发送记录？', en: 'Delete this sent record?' },
    'app2.mailDeleted': { zh: '邮件已删除', en: 'Message deleted' },
    'app2.recordDeleted': { zh: '记录已删除', en: 'Record deleted' },
    'app2.composeSelectOrGen': { zh: '请先选择或生成一个邮箱', en: 'Select or generate a mailbox first' },
    'app2.composeSelectSender': { zh: '请先选择发件邮箱', en: 'Select a sender mailbox first' },
    'app2.composeNeedTo': { zh: '请输入收件人地址', en: 'Enter a recipient address' },
    'app2.composeNeedContent': { zh: '主题和内容不能都为空', en: 'Subject and content cannot both be empty' },
    'app2.mailSent': { zh: '邮件发送成功！', en: 'Message sent!' },
    'app2.sendRetry': { zh: '发送失败，请稍后重试', en: 'Send failed, please try again later' },
    'app2.generating': { zh: '生成中…', en: 'Generating…' },
    'app2.mailboxCreated': { zh: '邮箱生成成功！', en: 'Mailbox created!' },
    'app2.nameMailboxCreated': { zh: '随机人名邮箱生成成功！', en: 'Name-based mailbox created!' },
    'app2.generateFailed': { zh: '生成失败', en: 'Generation failed' },
    'app2.invalidPrefix': { zh: '前缀不合法，仅限字母数字且至少包含一个字母', en: 'Invalid prefix: letters and digits only, with at least one letter' },
    'app2.invalidUsername': { zh: '用户名不合法，仅限字母/数字/._-', en: 'Invalid username: letters, digits and ._- only' },
    'app2.invalidUsernameCharsPh': { zh: '仅限字母/数字/._-', en: 'Letters, digits and ._- only' },
    'app2.mailboxCreatedAddr': { zh: '已创建邮箱：{addr}', en: 'Mailbox created: {addr}' },
    'app2.createFailed': { zh: '创建失败', en: 'Creation failed' },
    'app2.mailboxDeleted': { zh: '邮箱已删除', en: 'Mailbox deleted' },
    'app2.confirmDeleteMailbox': { zh: '确定删除邮箱 {addr}？所有邮件将被清空。', en: 'Delete mailbox {addr}? All messages will be cleared.' },
    'app2.deleteFailed': { zh: '删除失败', en: 'Delete failed' },
    'app2.placeholderGen': { zh: '点击生成邮箱', en: 'Tap to generate a mailbox' },
    'app2.opSuccess': { zh: '操作成功', en: 'Action succeeded' },
    'app2.confirmClearMails': { zh: '确定清空 {addr} 的所有邮件？', en: 'Clear all messages in {addr}?' },
    'app2.mailsCleared': { zh: '邮件已清空', en: 'Messages cleared' },
    'app2.clearFailed': { zh: '清空失败', en: 'Clear failed' },
    'app2.favorited': { zh: '已收藏', en: 'Favorited' },
    'app2.favorite': { zh: '收藏邮箱', en: 'Favorite' },
    'app2.confirmActionDefault': { zh: '确认执行该操作？', en: 'Confirm this action?' },
    'app2.demoBanner': { zh: '👀 当前为 <strong>观看模式</strong>（模拟数据，仅演示）。要接收真实邮件，请自建部署或联系部署。', en: '👀 <strong>Demo mode</strong> (mock data only). To receive real mail, self-host or contact the operator.' },
    'app2.mailboxCount': { zh: '{n} 邮箱', en: '{n} mailboxes' },
    'app2.pinTop': { zh: '置顶', en: 'Pin' },
    'app2.unpinTop': { zh: '取消置顶', en: 'Unpin' },
    'app2.deleteMailbox': { zh: '删除邮箱', en: 'Delete mailbox' },
    'app2.noMailboxes': { zh: '暂无邮箱', en: 'No mailboxes' }
  });
} catch (_) {}

// API 请求封装
async function api(path, options) {
  if (window.__GUEST_MODE__) return mockApi(path, options);
  const res = await fetch(path, options);
  if (res.status === 401) {
    if (location.pathname !== '/html/login.html') location.replace('/html/login.html');
    throw new Error('unauthorized');
  }
  return res;
}

// 加载模板
const app = document.getElementById('app');
const templateResp = await fetch('/html/app.html', { cache: 'no-store' }).catch(() => null);
app.innerHTML = templateResp && templateResp.ok ? await templateResp.text() : await (await fetch('/html/app.html', { cache: 'reload' })).text();

// DOM 元素
const els = {
  email: document.getElementById('email'), gen: document.getElementById('gen'), genName: document.getElementById('gen-name'),
  copy: document.getElementById('copy'), clear: document.getElementById('clear'), list: document.getElementById('list'),
  listCard: document.getElementById('list-card'), tabInbox: document.getElementById('tab-inbox'), tabSent: document.getElementById('tab-sent'),
  boxTitle: document.getElementById('box-title'), boxIcon: document.getElementById('box-icon'), refresh: document.getElementById('refresh'),
  logout: document.getElementById('logout'), modal: document.getElementById('email-modal'), modalClose: document.getElementById('modal-close'),
  modalSubject: document.getElementById('modal-subject'), modalContent: document.getElementById('modal-content'),
  mbList: document.getElementById('mb-list'), mbSearch: document.getElementById('mb-search'), mbLoading: document.getElementById('mb-loading'),
  toast: document.getElementById('toast'), mbPager: document.getElementById('mb-pager'), mbPrev: document.getElementById('mb-prev'),
  mbNext: document.getElementById('mb-next'), mbPageInfo: document.getElementById('mb-page-info'), listLoading: document.getElementById('list-status'),
  confirmModal: document.getElementById('confirm-modal'), confirmClose: document.getElementById('confirm-close'),
  confirmMessage: document.getElementById('confirm-message'), confirmCancel: document.getElementById('confirm-cancel'), confirmOk: document.getElementById('confirm-ok'),
  emailActions: document.getElementById('email-actions'), toggleCustom: document.getElementById('toggle-custom'),
  customOverlay: document.getElementById('custom-overlay'), customLocalOverlay: document.getElementById('custom-local-overlay'),
  customCfSuffixOverlay: document.getElementById('custom-cf-suffix-overlay'),
  createCustomOverlay: document.getElementById('create-custom-overlay'), compose: document.getElementById('compose'),
  composeModal: document.getElementById('compose-modal'), composeClose: document.getElementById('compose-close'),
  composeTo: document.getElementById('compose-to'), composeSubject: document.getElementById('compose-subject'),
  composeHtml: document.getElementById('compose-html') || document.getElementById('compose-body'),
  composeFromName: document.getElementById('compose-from-name'), composeCancel: document.getElementById('compose-cancel'), composeSend: document.getElementById('compose-send'),
  pager: document.getElementById('list-pager'), prevPage: document.getElementById('prev-page'), nextPage: document.getElementById('next-page'), pageInfo: document.getElementById('page-info'),
  sidebarToggle: document.getElementById('sidebar-toggle'), sidebarToggleIcon: document.getElementById('sidebar-toggle-icon'),
  sidebar: document.querySelector('.sidebar'), container: document.querySelector('.container'),
  forwardSetting: document.getElementById('forward-setting'), toggleFavorite: document.getElementById('toggle-favorite'),
  favoriteIcon: document.getElementById('favorite-icon'), favoriteText: document.getElementById('favorite-text')
};
const lenRange = document.getElementById('len-range'), lenVal = document.getElementById('len-val'), domainSelect = document.getElementById('domain-select');

// 初始化
initSessionFromCache();
// showToast 由 toast-utils.js 全局提供
const showToast = window.showToast || ((msg, type) => console.log(`[${type}] ${msg}`));

// 刷新状态
const REFRESH_INTERVAL = 15;
let countdown = REFRESH_INTERVAL;
function showHeaderLoading(t) { if (els.listLoading) { els.listLoading.innerHTML = `<span class="spinner"></span>${t || window.t('common.loading')}`; els.listLoading.style.display = 'flex'; }}
function hideHeaderLoading() { if (els.listLoading) els.listLoading.style.display = 'none'; }
function showCountdown() { if (els.listLoading) { els.listLoading.innerHTML = `<span class="countdown-icon">⏱</span>${window.t('app2.countdownRefresh', { n: countdown })}`; els.listLoading.style.display = 'flex'; }}

// 刷新邮件列表
async function refresh() {
  const mailbox = getCurrentMailbox();
  if (!mailbox) return;
  try {
    showHeaderLoading(isFirstLoad() ? window.t('common.loading') : window.t('app2.updating'));
    if (isFirstLoad() && els.list) els.list.innerHTML = '';
    const url = !isSentViewActive() ? `/api/emails?mailbox=${encodeURIComponent(mailbox)}` : `/api/sent?from=${encodeURIComponent(mailbox)}`;
    const ctrl = new AbortController(); const timeout = setTimeout(() => ctrl.abort(), 8000);
    let emails = [];
    try { const r = await api(url, { signal: ctrl.signal }); emails = await r.json(); } finally { clearTimeout(timeout); }
    if (!Array.isArray(emails) || !emails.length) {
      els.list.innerHTML = `<div class="empty-state">
        <svg class="empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <use href="/icons/sprites.svg#icon-inbox"/>
        </svg>
        <span class="empty-text">${window.t('mail.empty')}</span>
      </div>`;
      if (els.pager) els.pager.style.display = 'none';
      return;
    }
    const isMobile = window.matchMedia?.('(max-width: 900px)').matches;
    els.list.innerHTML = sliceByPage(emails, els).map(e => renderEmailItem(e, isMobile)).join('');
    if (!isSentViewActive()) prefetchEmails(emails, api);
    markViewLoaded();
  } catch (_) {}
  finally { hideHeaderLoading(); if (getCurrentMailbox()) { countdown = REFRESH_INTERVAL; showCountdown(); } }
}

function autoRefreshCallback() { if (countdown > 0) { countdown--; showCountdown(); if (countdown <= 0) refresh().finally(() => { countdown = REFRESH_INTERVAL; showCountdown(); }); }}

// 加载邮箱列表
async function loadMailboxes(opts = {}) {
  if (isLoadingMailboxes() && !opts.forceFresh) return;
  setLoading(true);
  if (els.mbLoading) els.mbLoading.style.display = 'flex';
  try {
    let url = `/api/mailboxes?page=${getCurrentPage()}&size=${getPageSize()}`;
    const search = getSearchTerm(); if (search) url += `&q=${encodeURIComponent(search)}`;
    const r = await api(url); const data = await r.json();
    const list = Array.isArray(data) ? data : (data.list || []); const total = data.total || list.length;
    setLastCount(total); renderMailboxList(list, els.mbList); renderMbPager(els, total);
    try { const q = document.getElementById('quota'); if (q) q.textContent = window.t('app2.mailboxCount', { n: total }); } catch(_) {}
  } catch(_) {}
  finally { setLoading(false); if (els.mbLoading) els.mbLoading.style.display = 'none'; }
}

function updateMailboxInfoUI(info) {
  if (!info) return;
  if (els.favoriteIcon && els.favoriteText) {
    els.favoriteIcon.innerHTML = IconHelper.star(18, 18, info.is_favorite);
    els.favoriteText.textContent = info.is_favorite ? window.t('app2.favorited') : window.t('app2.favorite');
  }
  // iOS standalone 详情管理卡（ios-mailbox.js）消费；桌面无监听者，无副作用
  try {
    window.__cfMailboxInfo = info;
    window.dispatchEvent(new CustomEvent('mf:mailboxinfo', { detail: info }));
  } catch (_) {}
}

// 全局函数
window.selectMailbox = (addr) => selectMailboxAddress(addr, els, api, refresh, autoRefreshCallback, updateMailboxInfoUI);
window.togglePin = (e, addr) => toggleMailboxPin(e, addr, api, showToast, loadMailboxes);
window.deleteMailbox = (e, addr) => deleteMailboxAddress(e, addr, els, api, showToast, showConfirm, loadMailboxes);
window.showEmail = (id) => showEmailDetail(id, els, api, showToast);
window.showSentEmail = async (id) => { try { const r = await api(`/api/sent/${id}`); showSentEmailDetail(await r.json(), els); } catch(e) { showToast(e.message || window.t('toast.loadFailed'), 'error'); }};
window.deleteEmail = (id) => deleteEmailById(id, api, showToast, showConfirm, refresh);
window.deleteSent = (id) => deleteSentById(id, api, showToast, showConfirm, refresh);
window.copyFromList = (e, id) => copyFromEmailList(e, id, api, showToast);
window.refreshEmails = refresh;

// 事件绑定
if (els.gen) els.gen.onclick = () => generateMailbox(els, lenRange, domainSelect, api, showToast, refresh, loadMailboxes, autoRefreshCallback, updateMailboxInfoUI);
if (els.genName) els.genName.onclick = () => generateNameMailbox(els, lenRange, domainSelect, api, showToast, refresh, loadMailboxes, autoRefreshCallback, updateMailboxInfoUI);
if (els.copy) els.copy.onclick = () => copyMailboxAddress(showToast);
if (els.clear) els.clear.onclick = () => clearAllEmails(api, showToast, showConfirm, refresh);
if (els.refresh) els.refresh.onclick = refresh;
if (els.logout) els.logout.addEventListener('click', async () => {
  try { await fetch('/api/logout', { method: 'POST' }); } catch(_) {}
  location.replace('/html/login.html');
});
if (els.modalClose) els.modalClose.onclick = () => els.modal?.classList.remove('show');
els.modal?.addEventListener('click', (e) => { if (e.target === els.modal) els.modal.classList.remove('show'); });

// 视图切换
if (els.tabInbox) els.tabInbox.onclick = () => { setView(false); els.tabInbox.classList.add('active'); els.tabSent?.classList.remove('active'); if (els.boxTitle) els.boxTitle.textContent = window.t('app.boxInbox'); if (els.boxIcon) els.boxIcon.textContent = '📥'; resetPager(els); refresh(); };
if (els.tabSent) els.tabSent.onclick = () => { setView(true); els.tabSent.classList.add('active'); els.tabInbox?.classList.remove('active'); if (els.boxTitle) els.boxTitle.textContent = window.t('app.boxSent'); if (els.boxIcon) els.boxIcon.textContent = '📤'; resetPager(els); refresh(); };

// 分页
if (els.prevPage) els.prevPage.onclick = () => prevPage(refresh);
if (els.nextPage) els.nextPage.onclick = () => nextPage(refresh);
if (els.mbPrev) els.mbPrev.onclick = () => prevMbPage(loadMailboxes);
if (els.mbNext) els.mbNext.onclick = () => nextMbPage(loadMailboxes, getLastCount());

// 搜索
if (els.mbSearch) { let t = null; els.mbSearch.oninput = () => { if (t) clearTimeout(t); t = setTimeout(() => { setSearchTerm(els.mbSearch.value); resetMbPage(); loadMailboxes(); }, 300); };}

// 长度滑块
if (lenRange && lenVal) { lenRange.value = String(getStoredLength()); lenVal.textContent = String(getStoredLength()); updateRangeProgress(lenRange); lenRange.oninput = () => { lenVal.textContent = lenRange.value; saveLength(Number(lenRange.value)); updateRangeProgress(lenRange); };}

// 自定义邮箱
function updateCustomPlaceholder() {
  if (!els.customLocalOverlay) return;
  const cfSuffix = !!els.customCfSuffixOverlay?.checked;
  els.customLocalOverlay.placeholder = cfSuffix ? window.t('app.prefixPh') : window.t('app2.invalidUsernameCharsPh');
}
els.customCfSuffixOverlay?.addEventListener('change', updateCustomPlaceholder);
updateCustomPlaceholder();
if (els.toggleCustom) els.toggleCustom.onclick = () => {
  if (els.customOverlay) {
    const vis = els.customOverlay.style.display !== 'none';
    const emailText = document.getElementById('email-text');
    els.customOverlay.style.display = vis ? 'none' : 'grid';
    els.email?.classList.toggle('custom-open', !vis);
    if (emailText) emailText.style.display = vis ? '' : 'none';
    if (!vis) setTimeout(() => els.customLocalOverlay?.focus(), 50);
  }
};
if (els.createCustomOverlay) els.createCustomOverlay.onclick = () => createCustomMailbox(els, domainSelect, api, showToast, loadMailboxes);

// 侧边栏
if (els.sidebarToggle) { els.sidebarToggle.onclick = () => { els.sidebar?.classList.toggle('collapsed'); els.container?.classList.toggle('sidebar-collapsed'); const c = els.sidebar?.classList.contains('collapsed'); if (els.sidebarToggleIcon) els.sidebarToggleIcon.textContent = c ? '▶' : '◀'; localStorage.setItem('sidebar-collapsed', c ? '1' : '0'); }; if (localStorage.getItem('sidebar-collapsed') === '1') { els.sidebar?.classList.add('collapsed'); els.container?.classList.add('sidebar-collapsed'); if (els.sidebarToggleIcon) els.sidebarToggleIcon.textContent = '▶'; }}

// 转发和收藏
if (els.forwardSetting) els.forwardSetting.onclick = () => { 
  const i = getCurrentMailboxInfo(); 
  if (i && i.id) openForwardDialog(i.id, i.address, i.forward_to);
  else showToast(window.t('app2.selectMailboxFirst'), 'warn');
};
if (els.toggleFavorite) els.toggleFavorite.onclick = async () => { 
  const i = getCurrentMailboxInfo(); 
  if (i && i.id) { 
    try { 
      const result = await toggleFavorite(i.id); 
      if (result.success) {
        const newInfo = { ...i, is_favorite: result.is_favorite };
        setCurrentMailboxInfo(newInfo); 
        updateMailboxInfoUI(newInfo);
      }
    } catch(_) {} 
  } else showToast(window.t('app2.selectMailboxFirst'), 'warn');
};

// 撰写
initCompose(els, api, showToast);

// 会话验证
(async () => {
  const s = await validateSession();
  if (!s) { clearCurrentMailbox(); stopAutoRefresh(); location.replace('/html/login.html'); return; }
  if (s.role === 'guest') { initGuestMode(); if (domainSelect) { domainSelect.innerHTML = '<option value="0">example.com</option>'; domainSelect.disabled = true; } populateDomains(['example.com'], domainSelect); }
  else await loadDomains(domainSelect, api);
  try { const qr = await api('/api/user/quota'); const q = await qr.json(); const el = document.getElementById('quota'); if (el && q) { el.textContent = isAdmin() ? window.t('app2.mailboxCount', { n: q.total || 0 }) : `${q.used || 0} / ${q.limit || 0}`; }} catch(_) {}
  await loadMailboxes();
  
  // 优先使用 URL 参数中的邮箱，其次使用本地存储的上次邮箱
  const urlParams = new URLSearchParams(window.location.search);
  const urlMailbox = urlParams.get('mailbox');
  if (urlMailbox) {
    await window.selectMailbox(urlMailbox);
    // 清除 URL 参数，避免刷新时重复选择
    window.history.replaceState({}, '', window.location.pathname);
  } else {
    const last = loadCurrentMailbox(); 
    if (last) await window.selectMailbox(last);
  }
  
  initVisibilityTracking();
})();
