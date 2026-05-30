/**
 * 新邮件通知（站内通知中心写入 + Web Push 推送），收信两条路径共用。
 * @module email/notify
 */

/**
 * 写入站内通知（应用内通知中心）。
 */
export async function recordInboxNotification(db, { mailboxId, messageId, subject, sender }) {
  if (!db || !mailboxId) return;
  try {
    const subj = String(subject || '(无主题)').slice(0, 120);
    await db.prepare(
      "INSERT INTO notifications (mailbox_id, message_id, type, title, body) VALUES (?, ?, 'new_mail', ?, ?)"
    ).bind(mailboxId, messageId || null, '新邮件：' + subj, String(sender || '').slice(0, 160)).run();
  } catch (e) {
    console.error('站内通知写入失败:', e);
  }
}

/**
 * 向该邮箱可见的订阅推送 Web Push（新邮件到达）。失效订阅自动清理。
 */
export async function pushNewMail(db, env, { mailboxId, messageId, subject, sender }) {
  if (!db || !mailboxId) return;
  try {
    const { getOrCreateVapidKeys, sendWebPush } = await import('../utils/webpush.js');
    const vapid = await getOrCreateVapidKeys(db);
    if (!vapid) return;
    const { results: subs } = await db.prepare(
      `SELECT DISTINCT ps.id, ps.endpoint, ps.p256dh, ps.auth
       FROM push_subscriptions ps
       WHERE ps.mailbox_id = ?1
          OR ps.user_id IN (SELECT um.user_id FROM user_mailboxes um WHERE um.mailbox_id = ?1)`
    ).bind(mailboxId).all();
    if (!subs || !subs.length) return;
    const payload = {
      title: '新邮件：' + String(subject || '(无主题)').slice(0, 120),
      body: String(sender || ''),
      url: '/',
      messageId: messageId || null
    };
    for (const s of subs) {
      try {
        const res = await sendWebPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload, vapid);
        if (res && (res.status === 404 || res.status === 410)) {
          try { await db.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(s.id).run(); } catch (_) { }
        }
      } catch (e) { console.error('单条推送失败:', e); }
    }
  } catch (e) {
    console.error('Web Push 流程失败:', e);
  }
}
