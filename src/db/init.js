/**
 * 数据库初始化模块
 * @module db/init
 */

import { clearExpiredCache } from '../utils/cache.js';

// 初始化状态标志（全局共享，Worker 生命周期内有效）
let _isFirstInit = true;

/**
 * 轻量级数据库初始化（仅在首次启动时检查）
 * @param {object} db - 数据库连接对象
 * @returns {Promise<void>} 初始化完成后无返回值
 */
export async function initDatabase(db) {
  try {
    // 清理过期缓存
    clearExpiredCache();
    
    // 仅首次启动时执行完整初始化
    if (_isFirstInit) {
      await performFirstTimeSetup(db);
      _isFirstInit = false;
    }
    
    // 每次都确保外键约束开启
    await db.exec(`PRAGMA foreign_keys = ON;`);
  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  }
}

/**
 * 首次启动设置（仅执行一次）
 * @param {object} db - 数据库连接对象
 * @returns {Promise<void>}
 */
async function performFirstTimeSetup(db) {
  // 快速检查：如果所有必要表存在，执行字段迁移后返回
  let coreTablesExist = false;
  try {
    await db.prepare('SELECT 1 FROM mailboxes LIMIT 1').all();
    await db.prepare('SELECT 1 FROM messages LIMIT 1').all();
    await db.prepare('SELECT 1 FROM users LIMIT 1').all();
    await db.prepare('SELECT 1 FROM user_mailboxes LIMIT 1').all();
    await db.prepare('SELECT 1 FROM sent_emails LIMIT 1').all();
    coreTablesExist = true;
  } catch (e) {
    // 有核心表不存在，继续初始化
    console.log('检测到数据库表不完整，开始初始化...');
  }

  if (coreTablesExist) {
    // 所有5个必要表都存在，执行字段迁移和新表初始化
    await migrateMailboxesFields(db);
    await migrateMessagesFields(db);
    await migrateSentEmailsFields(db);
    await ensureCfAliasCodesTable(db);
    await ensureSystemSettingsTable(db);
    await ensureNotificationsTable(db);
    await ensurePushSubscriptionsTable(db);
    return;
  }
  
  // 创建表结构（仅在表不存在时）- 包含新字段 forward_to 和 is_favorite
  await db.exec("CREATE TABLE IF NOT EXISTS mailboxes (id INTEGER PRIMARY KEY AUTOINCREMENT, address TEXT NOT NULL UNIQUE, local_part TEXT NOT NULL, domain TEXT NOT NULL, password_hash TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, last_accessed_at TEXT, expires_at TEXT, is_pinned INTEGER DEFAULT 0, can_login INTEGER DEFAULT 0, forward_to TEXT DEFAULT NULL, is_favorite INTEGER DEFAULT 0);");
  await db.exec("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, mailbox_id INTEGER NOT NULL, sender TEXT NOT NULL, to_addrs TEXT NOT NULL DEFAULT '', subject TEXT NOT NULL, verification_code TEXT, preview TEXT, r2_bucket TEXT NOT NULL DEFAULT 'mail-eml', r2_object_key TEXT NOT NULL DEFAULT '', received_at TEXT DEFAULT CURRENT_TIMESTAMP, is_read INTEGER DEFAULT 0, is_starred INTEGER DEFAULT 0, FOREIGN KEY(mailbox_id) REFERENCES mailboxes(id));");
  await db.exec("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT, role TEXT NOT NULL DEFAULT 'user', can_send INTEGER NOT NULL DEFAULT 0, mailbox_limit INTEGER NOT NULL DEFAULT 10, created_at TEXT DEFAULT CURRENT_TIMESTAMP);");
  await db.exec("CREATE TABLE IF NOT EXISTS user_mailboxes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, mailbox_id INTEGER NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, is_pinned INTEGER NOT NULL DEFAULT 0, UNIQUE(user_id, mailbox_id), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE);");
  await db.exec("CREATE TABLE IF NOT EXISTS sent_emails (id INTEGER PRIMARY KEY AUTOINCREMENT, resend_id TEXT, from_name TEXT, from_addr TEXT NOT NULL, to_addrs TEXT NOT NULL, subject TEXT NOT NULL, html_content TEXT, text_content TEXT, status TEXT DEFAULT 'queued', scheduled_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, provider TEXT NOT NULL DEFAULT 'resend');");
  await ensureCfAliasCodesTable(db);
  await ensureSystemSettingsTable(db);
  await ensureNotificationsTable(db);
  await ensurePushSubscriptionsTable(db);

  // 创建索引
  await createIndexes(db);
}

/**
 * 站内通知表（应用内通知中心使用）
 */
async function ensureNotificationsTable(db) {
  await db.exec("CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, mailbox_id INTEGER NOT NULL, message_id INTEGER, type TEXT NOT NULL DEFAULT 'new_mail', title TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_notifications_mailbox ON notifications(mailbox_id, created_at DESC);");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(mailbox_id, is_read);");
}

/**
 * Web Push 订阅表
 */
async function ensurePushSubscriptionsTable(db) {
  await db.exec("CREATE TABLE IF NOT EXISTS push_subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, mailbox_id INTEGER, endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);");
  await db.exec("CREATE INDEX IF NOT EXISTS idx_push_subs_mailbox ON push_subscriptions(mailbox_id);");
}

/**
 * 创建数据库索引
 * @param {object} db - 数据库连接对象
 */
async function createIndexes(db) {
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_mailboxes_address ON mailboxes(address);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_mailboxes_is_pinned ON mailboxes(is_pinned DESC);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_mailboxes_address_created ON mailboxes(address, created_at DESC);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_mailboxes_is_favorite ON mailboxes(is_favorite DESC);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_mailbox_id ON messages(mailbox_id);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_received_at ON messages(received_at DESC);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_r2_object_key ON messages(r2_object_key);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_mailbox_received ON messages(mailbox_id, received_at DESC);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_mailbox_received_read ON messages(mailbox_id, received_at DESC, is_read);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_is_starred ON messages(is_starred);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_user_mailboxes_user ON user_mailboxes(user_id);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_user_mailboxes_mailbox ON user_mailboxes(mailbox_id);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_user_mailboxes_user_pinned ON user_mailboxes(user_id, is_pinned DESC);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_user_mailboxes_composite ON user_mailboxes(user_id, mailbox_id, is_pinned);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_sent_emails_resend_id ON sent_emails(resend_id);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_sent_emails_status_created ON sent_emails(status, created_at DESC);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_sent_emails_from_addr ON sent_emails(from_addr);`);
}

async function ensureCfAliasCodesTable(db) {
  await db.exec("CREATE TABLE IF NOT EXISTS cf_alias_codes (id INTEGER PRIMARY KEY AUTOINCREMENT, prefix TEXT NOT NULL, domain TEXT NOT NULL, code TEXT NOT NULL, local_part TEXT NOT NULL, address TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(prefix, domain, code), UNIQUE(address));");
  await db.exec('CREATE INDEX IF NOT EXISTS idx_cf_alias_codes_prefix_domain ON cf_alias_codes(prefix, domain);');
  await backfillCfAliasCodes(db);
}

async function backfillCfAliasCodes(db) {
  try {
    const rows = await db.prepare(`
      SELECT address, local_part, domain
      FROM mailboxes
      WHERE local_part LIKE '%.cf___'
    `).all();
    for (const row of (rows?.results || [])) {
      const localPart = String(row.local_part || '').toLowerCase();
      const match = localPart.match(/^((?=[a-z0-9]*[a-z])[a-z0-9]+)\.cf([0-9]{3})$/);
      if (!match) continue;
      await db.prepare(`
        INSERT OR IGNORE INTO cf_alias_codes (prefix, domain, code, local_part, address)
        VALUES (?, ?, ?, ?, ?)
      `).bind(match[1], String(row.domain || '').toLowerCase(), match[2], localPart, String(row.address || '').toLowerCase()).run();
    }
  } catch (error) {
    console.error('cf_alias_codes 回填失败:', error);
  }
}

async function ensureSystemSettingsTable(db) {
  await db.exec("CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);");
  await db.prepare("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('auto_create_unknown_mailboxes', '0')").run();
}

/**
 * 迁移 mailboxes 表字段（向后兼容）
 * 检查并添加缺失的字段：forward_to, is_favorite
 * @param {object} db - 数据库连接对象
 * @returns {Promise<void>}
 */
async function migrateMailboxesFields(db) {
  try {
    const columns = await db.prepare("PRAGMA table_info(mailboxes)").all();
    const columnNames = (columns.results || []).map(c => c.name);

    // 添加 forward_to 字段（转发目标）
    if (!columnNames.includes('forward_to')) {
      await db.exec("ALTER TABLE mailboxes ADD COLUMN forward_to TEXT DEFAULT NULL;");
      console.log('已添加 mailboxes.forward_to 字段');
    }

    // 添加 is_favorite 字段（收藏状态）
    if (!columnNames.includes('is_favorite')) {
      await db.exec("ALTER TABLE mailboxes ADD COLUMN is_favorite INTEGER DEFAULT 0;");
      await db.exec("CREATE INDEX IF NOT EXISTS idx_mailboxes_is_favorite ON mailboxes(is_favorite DESC);");
      console.log('已添加 mailboxes.is_favorite 字段');
    }
  } catch (error) {
    console.error('mailboxes 字段迁移失败:', error);
    // 不抛出异常，允许继续运行
  }
}

/**
 * 迁移 messages 表字段（向后兼容）
 * 检查并添加缺失的字段：is_starred（邮件级星标，供聚合收件箱使用）
 * @param {object} db - 数据库连接对象
 * @returns {Promise<void>}
 */
async function migrateMessagesFields(db) {
  try {
    const columns = await db.prepare("PRAGMA table_info(messages)").all();
    const columnNames = (columns.results || []).map(c => c.name);

    // 添加 is_starred 字段（邮件级星标）
    if (!columnNames.includes('is_starred')) {
      await db.exec("ALTER TABLE messages ADD COLUMN is_starred INTEGER DEFAULT 0;");
      console.log('已添加 messages.is_starred 字段');
    }
    // 确保索引存在（列已具备时幂等；覆盖全新 CI 安装由 d1-init.sql 建表的场景）
    await db.exec("CREATE INDEX IF NOT EXISTS idx_messages_is_starred ON messages(is_starred);");
  } catch (error) {
    console.error('messages 字段迁移失败:', error);
    // 不抛出异常，允许继续运行
  }
}

/**
 * 迁移 sent_emails 表字段（向后兼容）
 * 检查并添加缺失的字段：provider（区分发件渠道：resend / sendflare）
 * @param {object} db - 数据库连接对象
 * @returns {Promise<void>}
 */
async function migrateSentEmailsFields(db) {
  try {
    const columns = await db.prepare("PRAGMA table_info(sent_emails)").all();
    const columnNames = (columns.results || []).map(c => c.name);

    if (!columnNames.includes('provider')) {
      await db.exec("ALTER TABLE sent_emails ADD COLUMN provider TEXT NOT NULL DEFAULT 'resend';");
      console.log('已添加 sent_emails.provider 字段');
    }
  } catch (error) {
    console.error('sent_emails 字段迁移失败:', error);
    // 不抛出异常，允许继续运行
  }
}

/**
 * 完整的数据库设置脚本（用于首次部署）
 * 可通过 wrangler d1 execute 或管理面板执行
 * @param {object} db - 数据库连接对象
 * @returns {Promise<void>}
 */
export async function setupDatabase(db) {
  await db.exec(`PRAGMA foreign_keys = ON;`);
  
  // 创建所有表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS mailboxes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address TEXT NOT NULL UNIQUE,
      local_part TEXT NOT NULL,
      domain TEXT NOT NULL,
      password_hash TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_accessed_at TEXT,
      expires_at TEXT,
      is_pinned INTEGER DEFAULT 0,
      can_login INTEGER DEFAULT 0,
      forward_to TEXT DEFAULT NULL,
      is_favorite INTEGER DEFAULT 0
    );
  `);
  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mailbox_id INTEGER NOT NULL,
      sender TEXT NOT NULL,
      to_addrs TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL,
      verification_code TEXT,
      preview TEXT,
      r2_bucket TEXT NOT NULL DEFAULT 'mail-eml',
      r2_object_key TEXT NOT NULL DEFAULT '',
      received_at TEXT DEFAULT CURRENT_TIMESTAMP,
      is_read INTEGER DEFAULT 0,
      is_starred INTEGER DEFAULT 0,
      FOREIGN KEY(mailbox_id) REFERENCES mailboxes(id)
    );
  `);
  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      can_send INTEGER NOT NULL DEFAULT 0,
      mailbox_limit INTEGER NOT NULL DEFAULT 10,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_mailboxes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      mailbox_id INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, mailbox_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE
    );
  `);
  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sent_emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resend_id TEXT,
      from_name TEXT,
      from_addr TEXT NOT NULL,
      to_addrs TEXT NOT NULL,
      subject TEXT NOT NULL,
      html_content TEXT,
      text_content TEXT,
      status TEXT DEFAULT 'queued',
      scheduled_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      provider TEXT NOT NULL DEFAULT 'resend'
    );
  `);

  await ensureCfAliasCodesTable(db);
  await ensureSystemSettingsTable(db);
  
  // 创建所有索引
  await createIndexes(db);
}
