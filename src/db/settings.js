/**
 * 系统设置数据库操作模块
 * @module db/settings
 */

export const AUTO_CREATE_UNKNOWN_MAILBOXES_KEY = 'auto_create_unknown_mailboxes';

function normalizeBooleanSetting(value) {
  return value ? '1' : '0';
}

function parseBooleanSetting(value, fallback = false) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

export async function getSystemSetting(db, key, fallback = '') {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey) return fallback;

  try {
    const row = await db.prepare('SELECT value FROM system_settings WHERE key = ? LIMIT 1')
      .bind(normalizedKey).first();
    return row?.value ?? fallback;
  } catch (_) {
    return fallback;
  }
}

export async function setSystemSetting(db, key, value) {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey) throw new Error('设置键不能为空');

  await db.prepare(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `).bind(normalizedKey, String(value ?? '')).run();
}

export async function getAutoCreateUnknownMailboxes(db) {
  const value = await getSystemSetting(db, AUTO_CREATE_UNKNOWN_MAILBOXES_KEY, '0');
  return parseBooleanSetting(value, false);
}

export async function setAutoCreateUnknownMailboxes(db, enabled) {
  await setSystemSetting(db, AUTO_CREATE_UNKNOWN_MAILBOXES_KEY, normalizeBooleanSetting(enabled));
  return getAutoCreateUnknownMailboxes(db);
}
