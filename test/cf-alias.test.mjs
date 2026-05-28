import test from 'node:test';
import assert from 'node:assert/strict';

import { handleEmailReceive } from '../src/email/receiver.js';
import { issueCfAliasMailbox } from '../src/db/mailboxes.js';
import { AUTO_CREATE_UNKNOWN_MAILBOXES_KEY } from '../src/db/settings.js';
import { normalizeEmailAlias } from '../src/utils/common.js';

class FakeStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = String(sql || '').replace(/\s+/g, ' ').trim();
    this.args = [];
  }

  bind(...args) {
    this.args = args;
    return this;
  }

  async all() {
    const sql = this.sql.toLowerCase();

    if (sql === 'select 1') return { results: [{ 1: 1 }] };

    if (sql.includes('select code from cf_alias_codes')) {
      const [prefix, domain] = this.args;
      return {
        results: this.db.cfAliasCodes
          .filter(row => row.prefix === prefix && row.domain === domain)
          .map(row => ({ code: row.code }))
      };
    }

    if (sql.includes('select id from mailboxes where address = ?')) {
      const [address] = this.args;
      const row = this.db.mailboxes.find(item => item.address === String(address).toLowerCase());
      return { results: row ? [{ id: row.id }] : [] };
    }

    return { results: [] };
  }

  async first() {
    const sql = this.sql.toLowerCase();

    if (sql.includes('select value from system_settings')) {
      const [key] = this.args;
      if (!this.db.systemSettings.has(key)) return null;
      return { value: this.db.systemSettings.get(key) };
    }

    const result = await this.all();
    return result.results?.[0] || null;
  }

  async run() {
    const sql = this.sql.toLowerCase();

    if (sql.includes('insert into cf_alias_codes')) {
      const [prefix, domain, code, localPart, address] = this.args.map(value => String(value).toLowerCase());
      const duplicate = this.db.cfAliasCodes.some(row =>
        (row.prefix === prefix && row.domain === domain && row.code === code) ||
        row.address === address
      );
      if (duplicate) throw new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed');
      this.db.cfAliasCodes.push({ prefix, domain, code, local_part: localPart, address });
      return { success: true };
    }

    if (sql.includes('insert into mailboxes')) {
      const [address, localPart, domain] = this.args.map(value => String(value).toLowerCase());
      if (this.db.mailboxes.some(row => row.address === address)) {
        throw new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed');
      }
      this.db.mailboxes.push({
        id: this.db.nextMailboxId++,
        address,
        local_part: localPart,
        domain
      });
      return { success: true };
    }

    if (sql.includes('insert into messages')) {
      this.db.messages.push({ args: [...this.args] });
      return { success: true };
    }

    if (sql.includes('insert into system_settings')) {
      const [key, value] = this.args;
      this.db.systemSettings.set(String(key), String(value));
      return { success: true };
    }

    return { success: true };
  }
}

class FakeD1 {
  constructor() {
    this.name = `fake-${Math.random()}`;
    this.mailboxes = [];
    this.messages = [];
    this.cfAliasCodes = [];
    this.systemSettings = new Map([[AUTO_CREATE_UNKNOWN_MAILBOXES_KEY, '0']]);
    this.nextMailboxId = 1;
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }

  async exec() {}
}

test('normalizes legacy aliases while preserving .cf### mailboxes', () => {
  assert.equal(
    normalizeEmailAlias('Giffgaff.cf123@ProtonPass.org'),
    'giffgaff.cf123@protonpass.org'
  );
  assert.equal(normalizeEmailAlias('foo.bar@protonpass.org'), 'bar@protonpass.org');
  assert.equal(normalizeEmailAlias('foo+bar@protonpass.org'), 'bar@protonpass.org');
  assert.equal(normalizeEmailAlias('foo-bar@protonpass.org'), 'bar@protonpass.org');
});

test('issues unique .cf### mailboxes and does not reuse deleted codes', async () => {
  const db = new FakeD1();

  const first = await issueCfAliasMailbox(db, { prefix: 'Giffgaff', domain: 'ProtonPass.org' });
  assert.match(first.address, /^giffgaff\.cf[0-9]{3}@protonpass\.org$/);
  assert.equal(first.prefix, 'giffgaff');

  db.mailboxes = db.mailboxes.filter(row => row.address !== first.address);

  const second = await issueCfAliasMailbox(db, { prefix: 'giffgaff', domain: 'protonpass.org' });
  assert.match(second.address, /^giffgaff\.cf[0-9]{3}@protonpass\.org$/);
  assert.notEqual(second.cfCode, first.cfCode);
  assert.equal(new Set(db.cfAliasCodes.map(row => row.code)).size, 2);
});

test('returns 409 when all .cf### codes are already issued for a prefix and domain', async () => {
  const db = new FakeD1();
  for (let i = 0; i < 1000; i++) {
    const code = String(i).padStart(3, '0');
    db.cfAliasCodes.push({
      prefix: 'full',
      domain: 'protonpass.org',
      code,
      local_part: `full.cf${code}`,
      address: `full.cf${code}@protonpass.org`
    });
  }

  await assert.rejects(
    issueCfAliasMailbox(db, { prefix: 'full', domain: 'protonpass.org' }),
    error => error?.statusCode === 409
  );
});

test('rejects unknown HTTP-received mailboxes when auto-create is disabled', async () => {
  const db = new FakeD1();
  let r2Writes = 0;
  const request = new Request('https://example.com/receive', {
    method: 'POST',
    body: JSON.stringify({
      to: 'missing@protonpass.org',
      from: 'sender@example.com',
      subject: 'test',
      text: 'body'
    })
  });

  const response = await handleEmailReceive(request, db, {
    MAIL_EML: { put: async () => { r2Writes++; } }
  });

  assert.equal(response.status, 404);
  assert.equal(await response.text(), 'Mailbox not found');
  assert.equal(db.mailboxes.length, 0);
  assert.equal(db.messages.length, 0);
  assert.equal(r2Writes, 0);
});

test('auto-creates unknown HTTP-received mailboxes when the setting is enabled', async () => {
  const db = new FakeD1();
  db.systemSettings.set(AUTO_CREATE_UNKNOWN_MAILBOXES_KEY, '1');
  let r2Writes = 0;
  const request = new Request('https://example.com/receive', {
    method: 'POST',
    body: JSON.stringify({
      to: 'newbox@protonpass.org',
      from: 'sender@example.com',
      subject: 'test',
      text: 'body'
    })
  });

  const response = await handleEmailReceive(request, db, {
    MAIL_EML: { put: async () => { r2Writes++; } }
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.equal(db.mailboxes[0].address, 'newbox@protonpass.org');
  assert.equal(db.messages.length, 1);
  assert.equal(r2Writes, 1);
});
