import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import router from '../src/routes/static.js';

const APP_TEMPLATE = '<span class="brand-text">__APP_NAME__</span><a id="repo" href="__APP_REPO_URL__">GitHub</a>';

function assetsWithTemplate(template = APP_TEMPLATE) {
  return {
    fetch: async () => new Response(template, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  };
}

function trackingAssets(responseBody = '<meta name="mail-domains" content="">') {
  const paths = [];
  return {
    paths,
    fetch: async (request) => {
      paths.push(new URL(request.url).pathname);
      return new Response(responseBody, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
  };
}

test('injects public app branding into the app template from env', async () => {
  const response = await router.request('https://example.com/html/app.html', {}, {
    ASSETS: assetsWithTemplate(),
    APP_NAME: '<Passal & Mail>',
    APP_REPO_URL: 'https://github.com/gitpassal/freemail'
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store, no-cache, must-revalidate, max-age=0');

  const body = await response.text();
  assert.match(body, /&lt;Passal &amp; Mail&gt;/);
  assert.match(body, /href="https:\/\/github\.com\/gitpassal\/freemail"/);
  assert.doesNotMatch(body, /__APP_NAME__|__APP_REPO_URL__/);
});

test('falls back to safe default branding when repo URL is not http or https', async () => {
  const response = await router.request('https://example.com/html/app.html', {}, {
    ASSETS: assetsWithTemplate(),
    APP_REPO_URL: 'javascript:alert(1)'
  });

  assert.equal(response.status, 200);

  const body = await response.text();
  assert.match(body, /iDing&#39;s临时邮箱/);
  assert.match(body, /href="https:\/\/github\.com\/idinging\/freemail"/);
});

test('injects branding on the extensionless app template route', async () => {
  const response = await router.request('https://example.com/html/app', {}, {
    ASSETS: assetsWithTemplate(),
    APP_NAME: 'Passal 临时邮箱',
    APP_REPO_URL: 'https://github.com/gitpassal/freemail'
  });

  assert.equal(response.status, 200);

  const body = await response.text();
  assert.match(body, /Passal 临时邮箱/);
  assert.doesNotMatch(body, /__APP_NAME__|__APP_REPO_URL__/);
});

test('runs worker before serving the app template asset', async () => {
  const wranglerConfig = await readFile(new URL('../wrangler.toml', import.meta.url), 'utf8');

  assert.match(wranglerConfig, /run_worker_first\s*=\s*\[[\s\S]*"\/html\/app\.html"/);
  assert.match(wranglerConfig, /run_worker_first\s*=\s*\[[\s\S]*"\/html\/app"/);
  assert.match(wranglerConfig, /run_worker_first\s*=\s*\[[\s\S]*"\/templates\/footer\.html"/);
  assert.match(wranglerConfig, /html_handling\s*=\s*"none"/);
});

test('serves index and login html explicitly when html handling is disabled', async () => {
  const indexAssets = trackingAssets();
  const indexResponse = await router.request('https://example.com/', {}, {
    ASSETS: indexAssets,
    MAIL_DOMAIN: 'protonpass.org'
  });

  assert.equal(indexAssets.paths[0], '/index.html');
  assert.match(await indexResponse.text(), /protonpass\.org/);

  const loginAssets = trackingAssets('<html>login</html>');
  await router.request('https://example.com/login', {}, {
    ASSETS: loginAssets
  });

  assert.equal(loginAssets.paths[0], '/login.html');
});

test('serves protected page aliases with explicit html asset paths', async () => {
  const assets = trackingAssets('<html><title>用户管理 - __APP_NAME__</title><span>__APP_NAME__ - 用户管理</span></html>');
  const response = await router.request('https://example.com/admin.html', {
    headers: { Authorization: 'Bearer test-secret' }
  }, {
    ASSETS: assets,
    JWT_TOKEN: 'test-secret',
    APP_NAME: 'Cloudflare Alias'
  });

  assert.equal(response.status, 200);
  assert.equal(assets.paths[0], '/html/admin.html');

  const body = await response.text();
  assert.match(body, /用户管理 - Cloudflare Alias/);
  assert.match(body, /Cloudflare Alias - 用户管理/);
  assert.doesNotMatch(body, /__APP_NAME__/);
});

test('serves the PWA manifest without auth redirects', async () => {
  const assets = trackingAssets('{"name":"Cloudflare Alias"}');
  const response = await router.request('https://example.com/manifest.webmanifest', {}, {
    ASSETS: assets
  });

  assert.equal(response.status, 200);
  assert.equal(assets.paths[0], '/manifest.webmanifest');
  assert.equal(response.headers.get('Content-Type'), 'application/manifest+json; charset=utf-8');
  assert.match(await response.text(), /Cloudflare Alias/);
});

test('serves the PWA preview harness without auth redirects', async () => {
  const assets = trackingAssets('<title>PWA Preview - Cloudflare Alias</title>');
  const response = await router.request('https://example.com/pwa-preview.html', {}, {
    ASSETS: assets
  });

  assert.equal(response.status, 200);
  assert.equal(assets.paths[0], '/pwa-preview.html');
  assert.match(await response.text(), /PWA Preview/);
});

test('injects branding into mailbox subpages', async () => {
  const assets = trackingAssets('<title>邮箱管理 - __APP_NAME__</title><a href="__APP_REPO_URL__">repo</a>');
  const response = await router.request('https://example.com/mailboxes.html', {
    headers: { Authorization: 'Bearer test-secret' }
  }, {
    ASSETS: assets,
    JWT_TOKEN: 'test-secret',
    APP_NAME: 'Cloudflare Alias',
    APP_REPO_URL: 'https://github.com/gitpassal/freemail'
  });

  assert.equal(response.status, 200);
  assert.equal(assets.paths[0], '/html/mailboxes.html');

  const body = await response.text();
  assert.match(body, /邮箱管理 - Cloudflare Alias/);
  assert.match(body, /href="https:\/\/github\.com\/gitpassal\/freemail"/);
  assert.doesNotMatch(body, /__APP_NAME__|__APP_REPO_URL__/);
});

test('injects branding into the shared footer template', async () => {
  const response = await router.request('https://example.com/templates/footer.html', {}, {
    ASSETS: assetsWithTemplate('© <span id="footer-year"></span> __APP_NAME__ - 简约而不简单'),
    APP_NAME: 'Cloudflare Alias'
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store, no-cache, must-revalidate, max-age=0');

  const body = await response.text();
  assert.match(body, /Cloudflare Alias - 简约而不简单/);
  assert.doesNotMatch(body, /__APP_NAME__/);
});
