import test from 'node:test';
import assert from 'node:assert/strict';
import router from '../src/routes/static.js';

const APP_TEMPLATE = '<span class="brand-text">__APP_NAME__</span><a id="repo" href="__APP_REPO_URL__">GitHub</a>';

function assetsWithTemplate(template = APP_TEMPLATE) {
  return {
    fetch: async () => new Response(template, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
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
