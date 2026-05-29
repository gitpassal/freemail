/**
 * 用户编辑模块
 * @module modules/admin/user-edit
 */

/**
 * 用户编辑状态
 */
export const editState = {
  userId: null,
  username: '',
  role: 'user',
  mailboxLimit: 10,
  canSend: false,
  isNew: true
};

/**
 * 重置编辑状态
 */
export function resetEditState() {
  editState.userId = null;
  editState.username = '';
  editState.role = 'user';
  editState.mailboxLimit = 10;
  editState.canSend = false;
  editState.isNew = true;
}

/**
 * 设置编辑用户
 * @param {object} user - 用户数据
 */
export function setEditUser(user) {
  if (!user) {
    resetEditState();
    return;
  }
  
  editState.userId = user.id;
  editState.username = user.username || '';
  editState.role = user.role || 'user';
  editState.mailboxLimit = user.mailbox_limit || 10;
  editState.canSend = !!user.can_send;
  editState.isNew = false;
}

/**
 * 填充编辑表单
 * @param {object} elements - DOM 元素引用
 * @param {object} user - 用户数据
 */
export function fillEditForm(elements, user) {
  const { editName, editNewName, editRoleCheck, editLimit, editSendCheck, editPass, editUserDisplay } = elements;
  
  if (user) {
    setEditUser(user);
    
    if (editName) editName.value = user.username || '';
    if (editNewName) editNewName.value = '';
    if (editRoleCheck) editRoleCheck.checked = user.role === 'admin';
    if (editLimit) editLimit.value = user.mailbox_limit || 10;
    if (editSendCheck) editSendCheck.checked = !!user.can_send;
    if (editPass) editPass.value = '';
    if (editUserDisplay) editUserDisplay.textContent = user.username || '';
  } else {
    resetEditState();
    
    if (editName) editName.value = '';
    if (editNewName) editNewName.value = '';
    if (editRoleCheck) editRoleCheck.checked = false;
    if (editLimit) editLimit.value = 10;
    if (editSendCheck) editSendCheck.checked = false;
    if (editPass) editPass.value = '';
    if (editUserDisplay) editUserDisplay.textContent = '';
  }
}

/**
 * 收集编辑表单数据
 * @param {object} elements - DOM 元素引用
 * @returns {object}
 */
export function collectEditFormData(elements) {
  const { editNewName, editRoleCheck, editLimit, editSendCheck, editPass } = elements;
  
  const data = {};
  
  if (editNewName && editNewName.value.trim()) {
    data.username = editNewName.value.trim();
  }
  
  if (editRoleCheck) {
    data.role = editRoleCheck.checked ? 'admin' : 'user';
  }
  
  if (editLimit) {
    data.mailboxLimit = parseInt(editLimit.value, 10) || 10;
  }
  
  if (editSendCheck) {
    data.can_send = editSendCheck.checked ? 1 : 0;
  }
  
  if (editPass && editPass.value.trim()) {
    data.password = editPass.value.trim();
  }
  
  return data;
}

/**
 * 验证编辑表单
 * @param {object} data - 表单数据
 * @param {boolean} isNew - 是否新建
 * @returns {{ valid: boolean, error: string }}
 */
export function validateEditForm(data, isNew = false) {
  if (isNew) {
    if (!data.username || !data.username.trim()) {
      return { valid: false, error: window.t('adm2.usernameRequired') };
    }
    if (!data.password || !data.password.trim()) {
      return { valid: false, error: window.t('adm2.passwordRequired') };
    }
  }

  if (data.mailboxLimit !== undefined && (isNaN(data.mailboxLimit) || data.mailboxLimit < 0)) {
    return { valid: false, error: window.t('adm2.mailboxLimitInvalid') };
  }
  
  return { valid: true, error: '' };
}

/**
 * 创建用户模态框内容
 * @returns {string}
 */
export function createUserModalContent() {
  return `
    <div class="form-group">
      <label for="new-username">${window.t('adm.username')}</label>
      <input type="text" id="new-username" placeholder="${window.t('adm2.enterUsernamePh')}" autocomplete="off">
    </div>
    <div class="form-group">
      <label for="new-password">${window.t('adm.password')}</label>
      <input type="password" id="new-password" placeholder="${window.t('adm2.enterPasswordPh')}" autocomplete="new-password">
    </div>
    <div class="form-group">
      <label for="new-role">${window.t('adm.role')}</label>
      <select id="new-role">
        <option value="user">${window.t('adm.roleUser')}</option>
        <option value="admin">${window.t('adm.roleAdmin')}</option>
      </select>
    </div>
    <div class="form-group">
      <label for="new-limit">${window.t('adm.mailboxLimit')}</label>
      <input type="number" id="new-limit" value="10" min="0" max="9999">
    </div>
  `;
}

/**
 * 收集新建用户表单数据
 * @returns {object}
 */
export function collectNewUserFormData() {
  return {
    username: document.getElementById('new-username')?.value.trim() || '',
    password: document.getElementById('new-password')?.value.trim() || '',
    role: document.getElementById('new-role')?.value || 'user',
    mailboxLimit: parseInt(document.getElementById('new-limit')?.value, 10) || 10
  };
}

// 导出默认对象
export default {
  editState,
  resetEditState,
  setEditUser,
  fillEditForm,
  collectEditFormData,
  validateEditForm,
  createUserModalContent,
  collectNewUserFormData
};
