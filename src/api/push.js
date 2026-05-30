/**
 * Web Push 订阅与发送 API
 * @module api/push
 */

import { getAuthContext, errorResponse } from './helpers.js';
import { getOrCreateVapidKeys, getVapidPublicKey, sendWebPush } from '../utils/webpush.js';

export async function handlePushApi(request, db, url, path, options) {
  if (!path.startsWith('/api/push')) return null;
  const isMock = !!options.mockOnly;

  // 下发 VAPID 公钥（前端 applicationServerKey）
  if (path === '/api/push/key' && request.method === 'GET') {
    try {
      const key = await getVapidPublicKey(db);
      return Response.json({ key: key || '' });
    } catch (e) { return Response.json({ key: '' }); }
  }

  // 订阅
  if (path === '/api/push/subscribe' && request.method === 'POST') {
    if (isMock) return errorResponse('演示模式不可订阅', 403);
    try {
      const ctx = getAuthContext(request, options);
      if (!ctx.userId && !ctx.mailboxId) return errorResponse('需要登录', 401);
      const sub = await request.json();
      const endpoint = sub && sub.endpoint;
      const p256dh = sub && sub.keys && sub.keys.p256dh;
      const auth = sub && sub.keys && sub.keys.auth;
      if (!endpoint || !p256dh || !auth) return errorResponse('无效订阅', 400);
      await db.prepare(
        `INSERT INTO push_subscriptions (user_id, mailbox_id, endpoint, p256dh, auth)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id, mailbox_id=excluded.mailbox_id, p256dh=excluded.p256dh, auth=excluded.auth`
      ).bind(ctx.userId || null, ctx.mailboxId || null, endpoint, p256dh, auth).run();
      return Response.json({ success: true });
    } catch (e) {
      console.error('订阅失败:', e);
      return errorResponse('订阅失败', 500);
    }
  }

  // 退订
  if (path === '/api/push/unsubscribe' && request.method === 'POST') {
    if (isMock) return Response.json({ success: true });
    try {
      const body = await request.json().catch(function () { return {}; });
      const endpoint = body && body.endpoint;
      if (endpoint) await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();
      return Response.json({ success: true });
    } catch (e) { return errorResponse('退订失败', 500); }
  }

  // 测试推送（给当前身份的订阅发一条）
  if (path === '/api/push/test' && request.method === 'POST') {
    if (isMock) return errorResponse('演示模式不可用', 403);
    try {
      const ctx = getAuthContext(request, options);
      if (!ctx.userId && !ctx.mailboxId) return errorResponse('需要登录', 401);
      const vapid = await getOrCreateVapidKeys(db);
      if (!vapid) return errorResponse('VAPID 未就绪', 500);
      const { results: subs } = await db.prepare(
        `SELECT id, endpoint, p256dh, auth FROM push_subscriptions
         WHERE (user_id IS NOT NULL AND user_id = ?) OR (mailbox_id IS NOT NULL AND mailbox_id = ?)`
      ).bind(ctx.userId || -1, ctx.mailboxId || -1).all();
      let sent = 0;
      for (const s of (subs || [])) {
        try {
          const res = await sendWebPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
            { title: '测试通知', body: '推送已成功开启 🎉', url: '/' }, vapid);
          if (res.status === 404 || res.status === 410) await db.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(s.id).run();
          else if (res.status >= 200 && res.status < 300) sent++;
        } catch (_) {}
      }
      return Response.json({ success: true, sent, total: (subs || []).length });
    } catch (e) {
      console.error('测试推送失败:', e);
      return errorResponse('测试推送失败', 500);
    }
  }

  return null;
}
