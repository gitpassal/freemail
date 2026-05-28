/**
 * 系统设置 API 模块
 * @module api/settings
 */

import { isStrictAdmin, errorResponse } from './helpers.js';
import {
  getAutoCreateUnknownMailboxes,
  setAutoCreateUnknownMailboxes
} from '../db/index.js';

function getMockSettings() {
  if (!globalThis.__MOCK_SYSTEM_SETTINGS__) {
    globalThis.__MOCK_SYSTEM_SETTINGS__ = { auto_create_unknown_mailboxes: false };
  }
  return globalThis.__MOCK_SYSTEM_SETTINGS__;
}

export async function handleSettingsApi(request, db, url, path, options) {
  const isMock = !!options.mockOnly;

  if (path === '/api/settings' && request.method === 'GET') {
    if (isMock) return Response.json(getMockSettings());
    if (!isStrictAdmin(request, options)) return errorResponse('Forbidden', 403);

    const autoCreate = await getAutoCreateUnknownMailboxes(db);
    return Response.json({ auto_create_unknown_mailboxes: autoCreate });
  }

  if (path === '/api/settings' && request.method === 'PATCH') {
    if (isMock) {
      try {
        const body = await request.json();
        const settings = getMockSettings();
        if (typeof body.auto_create_unknown_mailboxes !== 'undefined') {
          settings.auto_create_unknown_mailboxes = !!body.auto_create_unknown_mailboxes;
        }
        return Response.json(settings);
      } catch (_) {
        return errorResponse('Bad Request', 400);
      }
    }

    if (!isStrictAdmin(request, options)) return errorResponse('Forbidden', 403);

    try {
      const body = await request.json();
      if (typeof body.auto_create_unknown_mailboxes !== 'undefined') {
        const autoCreate = await setAutoCreateUnknownMailboxes(db, !!body.auto_create_unknown_mailboxes);
        return Response.json({ auto_create_unknown_mailboxes: autoCreate });
      }
      return errorResponse('没有可更新的设置', 400);
    } catch (_) {
      return errorResponse('Bad Request', 400);
    }
  }

  return null;
}
