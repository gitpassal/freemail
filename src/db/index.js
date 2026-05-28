/**
 * 数据库模块统一导出
 * @module db
 */

export { initDatabase, setupDatabase } from './init.js';
export { getDatabaseWithValidation, getInitializedDatabase } from './connection.js';
export {
  getOrCreateMailboxId,
  issueCfAliasMailbox,
  getMailboxIdByAddress,
  checkMailboxOwnership,
  toggleMailboxPin,
  getTotalMailboxCount,
  getForwardTarget
} from './mailboxes.js';
export {
  createUser,
  updateUser,
  deleteUser,
  listUsersWithCounts,
  assignMailboxToUser,
  getUserMailboxes,
  unassignMailboxFromUser
} from './users.js';
export {
  recordSentEmail,
  updateSentEmail
} from './sentEmails.js';
export {
  getSystemSetting,
  setSystemSetting,
  getAutoCreateUnknownMailboxes,
  setAutoCreateUnknownMailboxes,
  AUTO_CREATE_UNKNOWN_MAILBOXES_KEY
} from './settings.js';
