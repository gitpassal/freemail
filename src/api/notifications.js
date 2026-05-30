/**
 * 站内通知中心 API（应用内通知；仅 iOS Web App 使用，但端点对所有身份开放）
 * @module api/notifications
 */

import { getAuthContext, errorResponse } from './helpers.js';

// 按当前身份计算"可见 mailbox"谓词（admin 全量 / mailbox 自身 / user 经 user_mailboxes）
function mailboxScope(ctx, col) {
  if (ctx.strictAdmin) return { sql: '1=1', binds: [] };
  if (ctx.role === 'mailbox' && ctx.mailboxId) return { sql: `${col} = ?`, binds: [ctx.mailboxId] };
  if (ctx.userId) return { sql: `${col} IN (SELECT mailbox_id FROM user_mailboxes WHERE user_id = ?)`, binds: [ctx.userId] };
  return null;
}

export async function handleNotificationsApi(request, db, url, path, options) {
  if (!path.startsWith('/api/notifications')) return null;
  const isMock = !!options.mockOnly;

  // 未读数
  if (path === '/api/notifications/unread-count' && request.method === 'GET') {
    if (isMock) return Response.json({ count: 0 });
    try {
      const ctx = getAuthContext(request, options);
      const scope = mailboxScope(ctx, 'mailbox_id');
      if (!scope) return Response.json({ count: 0 });
      const row = await db.prepare(
        `SELECT COUNT(*) AS c FROM notifications WHERE ${scope.sql} AND is_read = 0`
      ).bind(...scope.binds).first();
      return Response.json({ count: (row && row.c) || 0 });
    } catch (e) { return Response.json({ count: 0 }); }
  }

  // 全部已读
  if (path === '/api/notifications/read-all' && request.method === 'POST') {
    if (isMock) return Response.json({ success: true });
    try {
      const ctx = getAuthContext(request, options);
      const scope = mailboxScope(ctx, 'mailbox_id');
      if (!scope) return Response.json({ success: true, updated: 0 });
      const res = await db.prepare(
        `UPDATE notifications SET is_read = 1 WHERE ${scope.sql} AND is_read = 0`
      ).bind(...scope.binds).run();
      return Response.json({ success: true, updated: res?.meta?.changes || 0 });
    } catch (e) { return errorResponse('操作失败', 500); }
  }

  // 单条标记已读：/api/notifications/:id/read
  if (path.startsWith('/api/notifications/') && path.endsWith('/read') && request.method === 'POST') {
    if (isMock) return Response.json({ success: true });
    const id = parseInt(path.split('/')[3], 10);
    if (!Number.isInteger(id)) return errorResponse('无效ID', 400);
    try {
      const ctx = getAuthContext(request, options);
      const scope = mailboxScope(ctx, 'mailbox_id');
      if (!scope) return errorResponse('Forbidden', 403);
      await db.prepare(
        `UPDATE notifications SET is_read = 1 WHERE id = ? AND ${scope.sql}`
      ).bind(id, ...scope.binds).run();
      return Response.json({ success: true });
    } catch (e) { return errorResponse('操作失败', 500); }
  }

  // 列表
  if (path === '/api/notifications' && request.method === 'GET') {
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10), 1), 50);
    const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10), 1);
    const offset = (page - 1) * limit;
    if (isMock) return Response.json({ list: [], page, hasMore: false, unread: 0 });
    try {
      const ctx = getAuthContext(request, options);
      const scope = mailboxScope(ctx, 'mailbox_id');
      if (!scope) return Response.json({ list: [], page, hasMore: false, unread: 0 });
      const { results } = await db.prepare(
        `SELECT id, message_id, type, title, body, is_read, created_at,
                (SELECT address FROM mailboxes WHERE id = notifications.mailbox_id) AS mailbox_address
         FROM notifications WHERE ${scope.sql}
         ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).bind(...scope.binds, limit, offset).all();
      const list = results || [];
      let unread = 0;
      try {
        const ur = await db.prepare(`SELECT COUNT(*) AS c FROM notifications WHERE ${scope.sql} AND is_read = 0`).bind(...scope.binds).first();
        unread = (ur && ur.c) || 0;
      } catch (_) { }
      return Response.json({ list, page, hasMore: list.length === limit, unread });
    } catch (e) {
      console.error('通知列表查询失败:', e);
      return errorResponse('查询失败', 500);
    }
  }

  return null;
}
