-- Cloudflare D1 数据库初始化脚本
-- 首次部署时执行：wrangler d1 execute maill_free_db --file=./d1-init.sql
-- 或修改 wrangler.toml 绑定后执行：wrangler d1 execute <database_name> --file=./d1-init.sql

-- 启用外键约束
PRAGMA foreign_keys = ON;

-- ────────────────────────────────────────
-- 邮箱地址表
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mailboxes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  address         TEXT    NOT NULL UNIQUE,
  local_part      TEXT    NOT NULL,
  domain          TEXT    NOT NULL,
  password_hash   TEXT,
  can_login       INTEGER DEFAULT 0,
  created_at      TEXT    DEFAULT CURRENT_TIMESTAMP,
  last_accessed_at TEXT,
  expires_at      TEXT,
  is_pinned       INTEGER DEFAULT 0,
  forward_to      TEXT    DEFAULT NULL,
  is_favorite     INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_mailboxes_address          ON mailboxes(address);
CREATE INDEX IF NOT EXISTS idx_mailboxes_is_pinned        ON mailboxes(is_pinned DESC);
CREATE INDEX IF NOT EXISTS idx_mailboxes_is_favorite      ON mailboxes(is_favorite DESC);
CREATE INDEX IF NOT EXISTS idx_mailboxes_address_created  ON mailboxes(address, created_at DESC);

-- ────────────────────────────────────────
-- .cf### 邮箱发行记录表
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cf_alias_codes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  prefix      TEXT NOT NULL,
  domain      TEXT NOT NULL,
  code        TEXT NOT NULL,
  local_part  TEXT NOT NULL,
  address     TEXT NOT NULL,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(prefix, domain, code),
  UNIQUE(address)
);

CREATE INDEX IF NOT EXISTS idx_cf_alias_codes_prefix_domain ON cf_alias_codes(prefix, domain);

INSERT OR IGNORE INTO cf_alias_codes (prefix, domain, code, local_part, address)
SELECT
  substr(local_part, 1, instr(local_part, '.cf') - 1) AS prefix,
  domain,
  substr(local_part, instr(local_part, '.cf') + 3, 3) AS code,
  local_part,
  address
FROM mailboxes
WHERE local_part GLOB '[a-zA-Z0-9]*.cf[0-9][0-9][0-9]'
  AND substr(local_part, 1, instr(local_part, '.cf') - 1) GLOB '*[a-zA-Z]*'
  AND substr(local_part, 1, instr(local_part, '.cf') - 1) NOT GLOB '*[^a-zA-Z0-9]*';

-- ────────────────────────────────────────
-- 邮件消息表
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  mailbox_id        INTEGER NOT NULL,
  sender            TEXT    NOT NULL,
  to_addrs          TEXT    NOT NULL DEFAULT '',
  subject           TEXT    NOT NULL,
  verification_code TEXT,
  preview           TEXT,
  r2_bucket         TEXT    NOT NULL DEFAULT 'mail-eml',
  r2_object_key     TEXT    NOT NULL DEFAULT '',
  received_at       TEXT    DEFAULT CURRENT_TIMESTAMP,
  is_read           INTEGER DEFAULT 0,
  is_starred        INTEGER DEFAULT 0,
  FOREIGN KEY(mailbox_id) REFERENCES mailboxes(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_mailbox_id           ON messages(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_messages_received_at          ON messages(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_r2_object_key        ON messages(r2_object_key);
CREATE INDEX IF NOT EXISTS idx_messages_mailbox_received     ON messages(mailbox_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_mailbox_received_read ON messages(mailbox_id, received_at DESC, is_read);
-- 注意：is_starred 列在已有生产库中由运行时迁移 (src/db/init.js migrateMessagesFields) 添加，
-- 其索引也在迁移中创建；此处不建索引，避免对"尚未补列"的现有库执行 d1-init.sql 时报错。

-- ────────────────────────────────────────
-- 用户表
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT    NOT NULL UNIQUE,
  password_hash  TEXT,
  role           TEXT    NOT NULL DEFAULT 'user',
  can_send       INTEGER NOT NULL DEFAULT 0,
  mailbox_limit  INTEGER NOT NULL DEFAULT 10,
  created_at     TEXT    DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ────────────────────────────────────────
-- 用户-邮箱关联表
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_mailboxes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  mailbox_id  INTEGER NOT NULL,
  created_at  TEXT    DEFAULT CURRENT_TIMESTAMP,
  is_pinned   INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, mailbox_id),
  FOREIGN KEY(user_id)    REFERENCES users(id)     ON DELETE CASCADE,
  FOREIGN KEY(mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_mailboxes_user       ON user_mailboxes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_mailboxes_mailbox    ON user_mailboxes(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_user_mailboxes_user_pinned ON user_mailboxes(user_id, is_pinned DESC);
CREATE INDEX IF NOT EXISTS idx_user_mailboxes_composite  ON user_mailboxes(user_id, mailbox_id, is_pinned);

-- ────────────────────────────────────────
-- 发送邮件记录表
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sent_emails (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  resend_id     TEXT,
  from_name     TEXT,
  from_addr     TEXT    NOT NULL,
  to_addrs      TEXT    NOT NULL,
  subject       TEXT    NOT NULL,
  html_content  TEXT,
  text_content  TEXT,
  status        TEXT    DEFAULT 'queued',
  scheduled_at  TEXT,
  created_at    TEXT    DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT    DEFAULT CURRENT_TIMESTAMP,
  provider      TEXT    NOT NULL DEFAULT 'resend'
);

CREATE INDEX IF NOT EXISTS idx_sent_emails_resend_id      ON sent_emails(resend_id);
CREATE INDEX IF NOT EXISTS idx_sent_emails_status_created ON sent_emails(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sent_emails_from_addr      ON sent_emails(from_addr);

-- ────────────────────────────────────────
-- 系统设置表
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO system_settings (key, value)
VALUES ('auto_create_unknown_mailboxes', '0');
