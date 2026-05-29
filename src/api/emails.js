/**
 * 邮件 API 处理器。
 * @module api/emails
 */

import { getMailboxAccess, getMessageAccess, getAuthContext, errorResponse } from './helpers.js';
import { buildMockEmails, buildMockEmailDetail, buildMockAggregateInbox } from './mock.js';
import { extractEmail } from '../utils/common.js';
import { getMailboxIdByAddress } from '../db/index.js';
import { parseEmailBody, parseEmailFull } from '../email/parser.js';

// 邮箱登录模式只允许查看最近 24 小时内的邮件。
function mailboxOnlyTimeFilter(enabled) {
  if (!enabled) return { sql: '', params: [] };
  return {
    sql: ' AND received_at >= ?',
    params: [new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()]
  };
}

// 邮件正文优先从 R2 原始 EML 解析，失败时由调用方回退到数据库字段。
async function loadEmailBodyFromR2(r2, objectKey) {
  if (!r2 || !objectKey) return { content: '', html_content: '' };
  try {
    const obj = await r2.get(objectKey);
    if (!obj) return { content: '', html_content: '' };
    let raw = '';
    if (typeof obj.text === 'function') raw = await obj.text();
    else if (typeof obj.arrayBuffer === 'function') raw = await new Response(await obj.arrayBuffer()).text();
    else raw = await new Response(obj.body).text();
    const parsed = await parseEmailBody(raw || '');
    return { content: parsed.text || '', html_content: parsed.html || '' };
  } catch (_) {
    return { content: '', html_content: '' };
  }
}

// 完整加载：正文 + 附件（一次解析）。attachments 含二进制 content，仅下载端点使用。
async function loadEmailFullFromR2(r2, objectKey) {
  if (!r2 || !objectKey) return { content: '', html_content: '', attachments: [] };
  try {
    const obj = await r2.get(objectKey);
    if (!obj) return { content: '', html_content: '', attachments: [] };
    let raw = '';
    if (typeof obj.text === 'function') raw = await obj.text();
    else if (typeof obj.arrayBuffer === 'function') raw = await new Response(await obj.arrayBuffer()).text();
    else raw = await new Response(obj.body).text();
    const parsed = await parseEmailFull(raw || '');
    return { content: parsed.text || '', html_content: parsed.html || '', attachments: parsed.attachments || [] };
  } catch (_) {
    return { content: '', html_content: '', attachments: [] };
  }
}

export async function handleEmailsApi(request, db, url, path, options) {
  const isMock = !!options.mockOnly;
  const isMailboxOnly = !!options.mailboxOnly;
  const r2 = options.r2;

  // 聚合收件箱：当前身份所有可见邮箱的全部邮件（仅 iOS Web App 使用；时间倒序、分页）
  if (path === '/api/inbox' && request.method === 'GET') {
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10), 1), 50);
    const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10), 1);
    const offset = (page - 1) * limit;
    try {
      if (isMock) return Response.json(buildMockAggregateInbox(page, limit));

      const ctx = getAuthContext(request, options);
      const COLS = `msg.id, msg.sender, msg.to_addrs, msg.subject, msg.received_at, msg.is_read, msg.preview, msg.verification_code, COALESCE(msg.is_starred, 0) AS is_starred, m.address AS mailbox_address`;
      const COLS_NOSTAR = `msg.id, msg.sender, msg.to_addrs, msg.subject, msg.received_at, msg.is_read, msg.preview, msg.verification_code, 0 AS is_starred, m.address AS mailbox_address`;

      let joins = '', where = '', binds = [];
      if (ctx.strictAdmin) {
        joins = 'JOIN mailboxes m ON m.id = msg.mailbox_id';
        where = '1=1';
      } else if (ctx.role === 'mailbox' && ctx.mailboxId) {
        const tf = mailboxOnlyTimeFilter(isMailboxOnly);
        joins = 'JOIN mailboxes m ON m.id = msg.mailbox_id';
        where = 'msg.mailbox_id = ?' + tf.sql;
        binds = [ctx.mailboxId, ...tf.params];
      } else if (ctx.userId) {
        joins = 'JOIN mailboxes m ON m.id = msg.mailbox_id JOIN user_mailboxes um ON um.mailbox_id = msg.mailbox_id AND um.user_id = ?';
        where = '1=1';
        binds = [ctx.userId];
      } else {
        return Response.json({ list: [], page, hasMore: false });
      }

      const buildSql = (cols) => `SELECT ${cols} FROM messages msg ${joins} WHERE ${where} ORDER BY msg.received_at DESC LIMIT ? OFFSET ?`;
      let results;
      try {
        ({ results } = await db.prepare(buildSql(COLS)).bind(...binds, limit, offset).all());
      } catch (_) {
        ({ results } = await db.prepare(buildSql(COLS_NOSTAR)).bind(...binds, limit, offset).all());
      }
      const list = results || [];
      return Response.json({ list, page, hasMore: list.length === limit });
    } catch (e) {
      console.error('聚合收件箱查询失败:', e);
      return errorResponse('查询失败', 500);
    }
  }

  if (path === '/api/emails' && request.method === 'GET') {
    const mailbox = url.searchParams.get('mailbox');
    if (!mailbox) return errorResponse('缺少 mailbox 参数', 400);
    try {
      if (isMock) return Response.json(buildMockEmails(6));

      const normalized = extractEmail(mailbox).trim().toLowerCase();
      const mailboxId = await getMailboxIdByAddress(db, normalized);
      if (!mailboxId) return Response.json([]);
      const access = await getMailboxAccess(db, request, options, { mailboxId });
      if (!access.allowed) return errorResponse('Forbidden', 403);

      const filter = mailboxOnlyTimeFilter(isMailboxOnly);
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);
      try {
        const { results } = await db.prepare(`
          SELECT id, sender, to_addrs, subject, received_at, is_read, preview, verification_code
          FROM messages
          WHERE mailbox_id = ?${filter.sql}
          ORDER BY received_at DESC
          LIMIT ?
        `).bind(mailboxId, ...filter.params, limit).all();
        return Response.json(results || []);
      } catch (_) {
        const { results } = await db.prepare(`
          SELECT id, sender, to_addrs, subject, received_at, is_read,
                 CASE WHEN content IS NOT NULL AND content <> ''
                      THEN SUBSTR(content, 1, 120)
                      ELSE SUBSTR(COALESCE(html_content, ''), 1, 120)
                 END AS preview
          FROM messages
          WHERE mailbox_id = ?${filter.sql}
          ORDER BY received_at DESC
          LIMIT ?
        `).bind(mailboxId, ...filter.params, limit).all();
        return Response.json(results || []);
      }
    } catch (e) {
      console.error('查询邮件失败:', e);
      return errorResponse('查询邮件失败', 500);
    }
  }

  if (path === '/api/emails/batch' && request.method === 'GET') {
    try {
      const idsParam = String(url.searchParams.get('ids') || '').trim();
      if (!idsParam) return Response.json([]);
      const ids = idsParam.split(',').map(s => parseInt(s, 10)).filter(n => Number.isInteger(n) && n > 0);
      if (!ids.length) return Response.json([]);
      if (ids.length > 50) return errorResponse('单次最多查询50封邮件', 400);
      if (isMock) return Response.json(ids.map(id => buildMockEmailDetail(id)));

      for (const id of ids) {
        const access = await getMessageAccess(db, request, options, id);
        if (access.exists && !access.allowed) return errorResponse('Forbidden', 403);
      }

      const filter = mailboxOnlyTimeFilter(isMailboxOnly);
      const placeholders = ids.map(() => '?').join(',');
      try {
        const { results } = await db.prepare(`
          SELECT id, sender, to_addrs, subject, verification_code, preview, r2_bucket, r2_object_key, received_at, is_read
          FROM messages WHERE id IN (${placeholders})${filter.sql}
        `).bind(...ids, ...filter.params).all();
        return Response.json(results || []);
      } catch (_) {
        const { results } = await db.prepare(`
          SELECT id, sender, to_addrs, subject, content, html_content, received_at, is_read
          FROM messages WHERE id IN (${placeholders})${filter.sql}
        `).bind(...ids, ...filter.params).all();
        return Response.json(results || []);
      }
    } catch (_) {
      return errorResponse('批量查询失败', 500);
    }
  }

  if (request.method === 'DELETE' && path === '/api/emails') {
    if (isMock) return errorResponse('演示模式不可清空', 403);
    const mailbox = url.searchParams.get('mailbox');
    if (!mailbox) return errorResponse('缺少 mailbox 参数', 400);
    try {
      const normalized = extractEmail(mailbox).trim().toLowerCase();
      const mailboxId = await getMailboxIdByAddress(db, normalized);
      if (!mailboxId) return Response.json({ success: true, deletedCount: 0 });
      const access = await getMailboxAccess(db, request, options, { mailboxId });
      if (!access.allowed) return errorResponse('Forbidden', 403);

      const { results: toDelete } = await db.prepare(
        'SELECT r2_object_key FROM messages WHERE mailbox_id = ? AND r2_object_key IS NOT NULL'
      ).bind(mailboxId).all();
      const result = await db.prepare('DELETE FROM messages WHERE mailbox_id = ?').bind(mailboxId).run();
      const deletedCount = result?.meta?.changes || 0;

      if (r2 && toDelete?.length) {
        for (const { r2_object_key } of toDelete) {
          try { await r2.delete(r2_object_key); } catch (err) {
            console.error('清空邮件时删除 R2 对象失败:', err);
          }
        }
      }

      return Response.json({ success: true, deletedCount });
    } catch (e) {
      console.error('清空邮件失败:', e);
      return errorResponse('清空邮件失败', 500);
    }
  }

  if (request.method === 'GET' && path.startsWith('/api/email/') && path.endsWith('/download')) {
    if (isMock) return errorResponse('演示模式不可下载', 403);
    const id = path.split('/')[3];
    const access = await getMessageAccess(db, request, options, id);
    if (!access.exists) return errorResponse('未找到邮件', 404);
    if (!access.allowed) return errorResponse('Forbidden', 403);

    const { results } = await db.prepare('SELECT r2_bucket, r2_object_key FROM messages WHERE id = ?').bind(id).all();
    const row = (results || [])[0];
    if (!row || !row.r2_object_key) return errorResponse('未找到对象', 404);
    try {
      if (!r2) return errorResponse('R2 未绑定', 500);
      const obj = await r2.get(row.r2_object_key);
      if (!obj) return errorResponse('对象不存在', 404);
      const headers = new Headers({ 'Content-Type': 'message/rfc822' });
      headers.set('Content-Disposition', `attachment; filename="${String(row.r2_object_key).split('/').pop()}"`);
      return new Response(obj.body, { headers });
    } catch (_) {
      return errorResponse('下载失败', 500);
    }
  }

  // 附件下载：从 R2 原始 EML 解析并提取单个附件
  if (request.method === 'GET' && path.startsWith('/api/email/') && path.includes('/attachment/')) {
    if (isMock) return errorResponse('演示模式无附件', 404);
    const parts = path.split('/');
    const id = parts[3];
    const idx = parseInt(parts[5], 10);
    const access = await getMessageAccess(db, request, options, id);
    if (!access.exists) return errorResponse('未找到邮件', 404);
    if (!access.allowed) return errorResponse('Forbidden', 403);
    if (!Number.isInteger(idx) || idx < 0) return errorResponse('无效附件序号', 400);

    const row = await db.prepare('SELECT r2_object_key FROM messages WHERE id = ?').bind(id).first();
    if (!row || !row.r2_object_key) return errorResponse('未找到对象', 404);
    if (!r2) return errorResponse('R2 未绑定', 500);
    try {
      const { attachments } = await loadEmailFullFromR2(r2, row.r2_object_key);
      const att = (attachments || [])[idx];
      if (!att) return errorResponse('未找到附件', 404);
      let body = att.content;
      if (typeof body === 'string') body = new TextEncoder().encode(body);
      const headers = new Headers({ 'Content-Type': att.mimeType || 'application/octet-stream' });
      const safeName = String(att.filename || `attachment-${idx + 1}`).replace(/["\r\n]/g, '_');
      headers.set('Content-Disposition', `attachment; filename="${safeName}"`);
      return new Response(body, { headers });
    } catch (_) {
      return errorResponse('附件下载失败', 500);
    }
  }

  // 星标切换
  if (request.method === 'PATCH' && path.startsWith('/api/email/') && path.endsWith('/star')) {
    if (isMock) return errorResponse('演示模式不可操作', 403);
    const id = path.split('/')[3];
    const access = await getMessageAccess(db, request, options, id);
    if (!access.exists) return errorResponse('未找到邮件', 404);
    if (!access.allowed) return errorResponse('Forbidden', 403);
    let starred = 1;
    try {
      const body = await request.json();
      if (typeof body?.starred !== 'undefined') starred = body.starred ? 1 : 0;
    } catch (_) { }
    try {
      await db.prepare('UPDATE messages SET is_starred = ? WHERE id = ?').bind(starred, id).run();
      return Response.json({ success: true, id: Number(id), is_starred: starred });
    } catch (e) {
      console.error('星标更新失败:', e);
      return errorResponse('星标更新失败', 500);
    }
  }

  // 标记未读
  if (request.method === 'PATCH' && path.startsWith('/api/email/') && path.endsWith('/unread')) {
    if (isMock) return errorResponse('演示模式不可操作', 403);
    const id = path.split('/')[3];
    const access = await getMessageAccess(db, request, options, id);
    if (!access.exists) return errorResponse('未找到邮件', 404);
    if (!access.allowed) return errorResponse('Forbidden', 403);
    try {
      await db.prepare('UPDATE messages SET is_read = 0 WHERE id = ?').bind(id).run();
      return Response.json({ success: true, id: Number(id), is_read: 0 });
    } catch (e) {
      console.error('标记未读失败:', e);
      return errorResponse('标记未读失败', 500);
    }
  }

  if (request.method === 'GET' && path.startsWith('/api/email/')) {
    const emailId = path.split('/')[3];
    if (isMock) return Response.json(buildMockEmailDetail(emailId));

    const access = await getMessageAccess(db, request, options, emailId);
    if (!access.exists) return errorResponse('未找到邮件', 404);
    if (!access.allowed) return errorResponse('Forbidden', 403);

    try {
      const filter = mailboxOnlyTimeFilter(isMailboxOnly);
      let results;
      try {
        ({ results } = await db.prepare(`
          SELECT id, sender, to_addrs, subject, verification_code, preview, r2_bucket, r2_object_key, received_at, is_read, COALESCE(is_starred, 0) AS is_starred,
                 (SELECT address FROM mailboxes WHERE id = messages.mailbox_id) AS mailbox_address
          FROM messages WHERE id = ?${filter.sql}
        `).bind(emailId, ...filter.params).all());
      } catch (_) {
        ({ results } = await db.prepare(`
          SELECT id, sender, to_addrs, subject, verification_code, preview, r2_bucket, r2_object_key, received_at, is_read, 0 AS is_starred,
                 (SELECT address FROM mailboxes WHERE id = messages.mailbox_id) AS mailbox_address
          FROM messages WHERE id = ?${filter.sql}
        `).bind(emailId, ...filter.params).all());
      }
      if (!results || results.length === 0) return errorResponse('未找到邮件', 404);

      await db.prepare('UPDATE messages SET is_read = 1 WHERE id = ?').bind(emailId).run();
      const row = results[0];
      let { content, html_content, attachments } = await loadEmailFullFromR2(r2, row.r2_object_key);

      if (!content && !html_content) {
        try {
          const fallback = await db.prepare('SELECT content, html_content FROM messages WHERE id = ?').bind(emailId).all();
          const fr = (fallback?.results || [])[0] || {};
          content = fr.content || '';
          html_content = fr.html_content || '';
        } catch (_) { }
      }

      // 仅返回附件元信息（不含二进制），下载走独立端点
      const attMeta = (attachments || []).map(a => ({
        index: a.index,
        filename: a.filename,
        mimeType: a.mimeType,
        disposition: a.disposition,
        inline: a.inline,
        size: a.size,
        url: `/api/email/${emailId}/attachment/${a.index}`
      }));

      return Response.json({
        ...row,
        content,
        html_content,
        attachments: attMeta,
        download: row.r2_object_key ? `/api/email/${emailId}/download` : ''
      });
    } catch (_) {
      const { results } = await db.prepare(`
        SELECT id, sender, to_addrs, subject, content, html_content, received_at, is_read
        FROM messages WHERE id = ?
      `).bind(emailId).all();
      if (!results || !results.length) return errorResponse('未找到邮件', 404);
      await db.prepare('UPDATE messages SET is_read = 1 WHERE id = ?').bind(emailId).run();
      return Response.json(results[0]);
    }
  }

  if (request.method === 'DELETE' && path.startsWith('/api/email/')) {
    if (isMock) return errorResponse('演示模式不可删除', 403);
    const emailId = path.split('/')[3];
    if (!emailId || !Number.isInteger(parseInt(emailId, 10))) return errorResponse('无效的邮件ID', 400);

    const access = await getMessageAccess(db, request, options, emailId);
    if (!access.exists) return errorResponse('未找到邮件', 404);
    if (!access.allowed) return errorResponse('Forbidden', 403);

    try {
      const row = await db.prepare('SELECT r2_object_key FROM messages WHERE id = ?').bind(emailId).first();
      const result = await db.prepare('DELETE FROM messages WHERE id = ?').bind(emailId).run();
      const deleted = (result?.meta?.changes || 0) > 0;

      if (deleted && r2 && row?.r2_object_key) {
        try { await r2.delete(row.r2_object_key); } catch (err) {
          console.error('删除 R2 对象失败:', err);
        }
      }

      return Response.json({
        success: true,
        deleted,
        message: deleted ? '邮件已删除' : '邮件不存在或已被删除'
      });
    } catch (e) {
      console.error('删除邮件失败:', e);
      return errorResponse('删除邮件时发生错误: ' + e.message, 500);
    }
  }

  return null;
}
