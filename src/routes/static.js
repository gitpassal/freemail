/**
 * 静态资源路由：首页、登录页、受保护页面、通配符
 * @module routes/static
 */

import { Hono } from 'hono';
import { resolveAuthPayload } from '../middleware/auth.js';

const PATH_MAP = {
  '/admin': '/html/admin.html',
  '/admin.html': '/html/admin.html',
  '/mailbox': '/html/mailbox.html',
  '/mailbox.html': '/html/mailbox.html',
  '/mailboxes.html': '/html/mailboxes.html',
};

const PROTECTED = new Set([
  '/admin', '/admin.html', '/html/admin.html',
  '/mailboxes.html', '/html/mailboxes.html',
  '/mailbox', '/mailbox.html', '/html/mailbox.html'
]);

const MAILBOX_ONLY = new Set([
  '/mailbox', '/mailbox.html', '/html/mailbox.html'
]);

const DEFAULT_APP_NAME = "iDing's临时邮箱";
const DEFAULT_APP_REPO_URL = 'https://github.com/idinging/freemail';
const APP_TEMPLATE_PATH = '/html/app.html';
const APP_TEMPLATE_PATHS = new Set([APP_TEMPLATE_PATH, '/html/app']);
const BRANDED_TEMPLATE_PATHS = new Set([
  ...APP_TEMPLATE_PATHS,
  '/html/admin.html',
  '/html/mailbox.html',
  '/html/mailboxes.html',
  '/templates/footer.html',
]);
const NO_STORE_CACHE_CONTROL = 'no-store, no-cache, must-revalidate, max-age=0';

const KNOWN_PATHS = new Set([
  '/', '/index.html', '/favicon.svg',
  '/manifest.webmanifest', '/apple-touch-icon.png', '/pwa-preview.html',
  '/login', '/login.html',
  ...Object.keys(PATH_MAP),
  '/app.js', '/app.css', '/app-router.js',
  '/admin.js', '/admin.css', '/login.js', '/login.css',
  '/mailbox.js', '/mailbox.css', '/mailboxes.js',
  '/mock.js', '/route-guard.js', '/app-mobile.js', '/app-mobile.css',
  '/auth-guard.js', '/storage.js', '/theme-toggle.js', '/pwa.js', '/pwa.css',
  '/toast-utils.js', '/mailbox-settings.js',
  '/html/mailbox.html', '/html/mailboxes.html', '/html/admin.html', '/html/app.html', '/html/app',
  '/templates/app.html', '/templates/footer.html',
  '/templates/loading.html', '/templates/loading-inline.html', '/templates/toast.html',
]);

function serveAsset(c, targetPath) {
  if (!c.env.ASSETS?.fetch) return c.notFound();
  if (targetPath) return c.env.ASSETS.fetch(new Request(new URL(targetPath, c.req.url), c.req.raw));
  return c.env.ASSETS.fetch(c.req.raw);
}

async function serveManifest(c) {
  const resp = await serveAsset(c, '/manifest.webmanifest');
  const headers = new Headers(resp.headers);
  headers.set('Content-Type', 'application/manifest+json; charset=utf-8');
  headers.set('Cache-Control', 'public, max-age=3600');
  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function getAppName(value) {
  const appName = String(value || '').trim();
  return appName || DEFAULT_APP_NAME;
}

function getAppRepoUrl(value) {
  const repoUrl = String(value || '').trim();
  if (!repoUrl) return DEFAULT_APP_REPO_URL;

  try {
    const parsed = new URL(repoUrl);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString();
  } catch (_) {}

  return DEFAULT_APP_REPO_URL;
}

async function serveBrandedTemplate(c, targetPath) {
  const assetPath = APP_TEMPLATE_PATHS.has(targetPath) ? APP_TEMPLATE_PATH : targetPath;
  const resp = await serveAsset(c, assetPath);

  try {
    const text = await resp.text();
    const body = text
      .replace(/__APP_NAME__/g, escapeHtml(getAppName(c.env.APP_NAME)))
      .replace(/__APP_REPO_URL__/g, escapeHtml(getAppRepoUrl(c.env.APP_REPO_URL)));
    const headers = new Headers(resp.headers);
    headers.set('Content-Type', 'text/html; charset=utf-8');
    headers.set('Cache-Control', NO_STORE_CACHE_CONTROL);
    return new Response(body, {
      status: resp.status,
      statusText: resp.statusText,
      headers
    });
  } catch (_) {
    return resp;
  }
}

async function serveBrandedAsset(c, targetPath) {
  if (BRANDED_TEMPLATE_PATHS.has(targetPath)) return serveBrandedTemplate(c, targetPath);
  return serveAsset(c, targetPath);
}

async function redirectIfLoggedIn(c, redirectTo, assetPath = null) {
  const JWT_TOKEN = c.env.JWT_TOKEN || c.env.JWT_SECRET || '';
  const payload = await resolveAuthPayload(c.req.raw, JWT_TOKEN);
  if (payload) return c.redirect(redirectTo, 302);
  return serveAsset(c, assetPath);
}

const router = new Hono();

router.get('/', async (c) => {
  const domains = (c.env.MAIL_DOMAIN || 'temp.example.com').split(/[,\s]+/).map(d => d.trim()).filter(Boolean);
  const JWT_TOKEN = c.env.JWT_TOKEN || c.env.JWT_SECRET || '';
  const payload = await resolveAuthPayload(c.req.raw, JWT_TOKEN);
  if (payload?.role === 'mailbox') return c.redirect('/html/mailbox.html', 302);
  if (!c.env.ASSETS?.fetch) return c.redirect('/login.html', 302);

  const resp = await serveAsset(c, '/index.html');
  try {
    const text = await resp.text();
    return new Response(
      text.replace('<meta name="mail-domains" content="">', `<meta name="mail-domains" content="${domains.join(',')}">`),
      { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
    );
  } catch (_) { return resp; }
});

router.get('/login', async (c) => redirectIfLoggedIn(c, '/', '/login.html'));
router.get('/login.html', async (c) => redirectIfLoggedIn(c, '/', '/login.html'));

router.get('*', async (c) => {
  const pathname = new URL(c.req.url).pathname;
  const JWT_TOKEN = c.env.JWT_TOKEN || c.env.JWT_SECRET || '';

  if (pathname === '/manifest.webmanifest') return serveManifest(c);

  if (!KNOWN_PATHS.has(pathname)
      && !pathname.startsWith('/assets/')
      && !pathname.startsWith('/pic/')
      && !pathname.startsWith('/templates/')
      && !pathname.startsWith('/public/')
      && !pathname.startsWith('/js/')
      && !pathname.startsWith('/css/')
      && !pathname.startsWith('/html/')
      && !pathname.startsWith('/icons/')) {
    const payload = await resolveAuthPayload(c.req.raw, JWT_TOKEN);
    if (!payload) return c.redirect('/templates/loading.html', 302);
  }

  if (PROTECTED.has(pathname)) {
    const payload = await resolveAuthPayload(c.req.raw, JWT_TOKEN);
    if (!payload) {
      const redirect = MAILBOX_ONLY.has(pathname) ? '/html/mailbox.html' : '/admin.html';
      return c.redirect(`/templates/loading.html?redirect=${encodeURIComponent(redirect)}`, 302);
    }
    if (MAILBOX_ONLY.has(pathname) && payload.role !== 'mailbox') return c.redirect('/', 302);
    if (!MAILBOX_ONLY.has(pathname)) {
      const allowed = (payload.role === 'admin' || payload.role === 'guest' || payload.role === 'mailbox');
      if (!allowed) return c.redirect('/', 302);
    }
  }

  if (APP_TEMPLATE_PATHS.has(pathname)) return serveBrandedTemplate(c, pathname);

  const targetPath = PATH_MAP[pathname] || null;
  return serveBrandedAsset(c, targetPath || pathname);
});

export default router;
