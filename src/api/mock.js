/**
 * 演示模式数据模块
 * @module api/mock
 */

// 演示模式邮箱域名
export const MOCK_DOMAINS = ['exa.cc', 'exr.yp', 'duio.ty'];

/**
 * 初始化演示模式用户数据
 */
export function initMockUsers() {
  if (!globalThis.__MOCK_USERS__) {
    const now = new Date();
    globalThis.__MOCK_USERS__ = [
      { id: 1, username: 'demo1', role: 'user', can_send: 0, mailbox_limit: 5, created_at: now.toISOString().replace('T', ' ').slice(0, 19) },
      { id: 2, username: 'demo2', role: 'user', can_send: 0, mailbox_limit: 8, created_at: now.toISOString().replace('T', ' ').slice(0, 19) },
      { id: 3, username: 'operator', role: 'admin', can_send: 0, mailbox_limit: 20, created_at: now.toISOString().replace('T', ' ').slice(0, 19) },
    ];
    globalThis.__MOCK_USER_MAILBOXES__ = new Map();
    
    // 为每个演示用户预生成若干邮箱
    try {
      for (const u of globalThis.__MOCK_USERS__) {
        const maxCount = Math.min(u.mailbox_limit || 10, 8);
        const minCount = Math.min(3, maxCount);
        const count = Math.max(minCount, Math.min(maxCount, Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount));
        const boxes = buildMockMailboxes(count, 0, MOCK_DOMAINS);
        globalThis.__MOCK_USER_MAILBOXES__.set(u.id, boxes);
      }
    } catch (_) {
      // 忽略演示数据预生成失败
    }
    globalThis.__MOCK_USER_LAST_ID__ = 3;
  }
}

/**
 * 生成模拟邮件列表
 * @param {number} count - 邮件数量
 * @returns {Array<object>} 模拟邮件列表
 */
export function buildMockEmails(count = 5) {
  const senders = ['support@example.com', 'noreply@service.com', 'admin@mock.test'];
  const subjects = [
    '[演示数据] 欢迎使用临时邮箱',
    '[演示数据] 您的验证码是 123456',
    '[演示数据] 订单已发货',
    '[演示数据] 密码重置请求',
    '[演示数据] 账户安全提醒'
  ];
  const previews = [
    '这是一封演示邮件，用于展示系统功能...',
    '您的验证码是 123456，请在5分钟内使用...',
    '您的订单已发货，预计3-5天送达...',
    '您请求重置密码，请点击链接...',
    '检测到您的账户有异常登录...'
  ];
  
  const emails = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    emails.push({
      id: 1000 + i,
      sender: senders[i % senders.length],
      to_addrs: 'demo@exa.cc',
      subject: subjects[i % subjects.length],
      received_at: new Date(now - i * 3600000).toISOString(),
      is_read: i > 2 ? 1 : 0,
      is_starred: 0,
      preview: previews[i % previews.length],
      verification_code: i === 1 ? '123456' : null,
      mailbox_address: 'demo@exa.cc'
    });
  }

  return emails;
}

/**
 * 生成模拟聚合收件箱（跨多个演示邮箱、时间倒序、分页），供 iOS 聚合收件箱预览。
 * @param {number} page - 页码（从 1 开始）
 * @param {number} limit - 每页数量
 * @returns {{list: Array<object>, page: number, hasMore: boolean}}
 */
export function buildMockAggregateInbox(page = 1, limit = 20) {
  if (!globalThis.__MOCK_INBOX__) {
    const now = Date.now();
    const pool = [
      { sender: 'ChatGPT <noreply@openai.com>', subject: 'New personal finance tools in ChatGPT Pro', preview: 'Connect your accounts to see balances, track spending and get personalized guidance.', mailbox: 'demo001@exa.cc', starred: 0, read: 0 },
      { sender: 'OpenAI <noreply@openai.com>', subject: 'Advanced Account Security is now enabled', preview: 'Advanced Account Security is now enabled on your account. If this was not you...', mailbox: 'demo001@exa.cc', starred: 0, read: 1 },
      { sender: 'LINUX DO <system@linux.do>', subject: '您已被批准加入 LINUX DO！', preview: '新帐户已被批准。欢迎来到 LINUX DO！管理员已审核通过。', mailbox: 'demo002@exr.yp', starred: 1, read: 1 },
      { sender: 'netcup GmbH <billing@netcup.de>', subject: 'Your invoice (R.-No. nc-5180050)', preview: 'Hello Xin Chen, Together with this email you will receive your invoice...', mailbox: 'demo002@exr.yp', starred: 0, read: 1 },
      { sender: 'OpenAI <noreply@openai.com>', subject: 'ChatGPT - Your plan will not renew', preview: 'Your plan will not renew and will be canceled at the end of the billing period...', mailbox: 'demo001@exa.cc', starred: 0, read: 1 },
      { sender: 'Anthropic <noreply@anthropic.com>', subject: 'Your account has been suspended', preview: 'Hello, An internal investigation of suspicious sign-in activity on your account...', mailbox: 'demo003@duio.ty', starred: 0, read: 1 },
      { sender: 'Accounting <accounting@hetzner.com>', subject: 'Hetzner Online GmbH - Invoice 08400082921', preview: 'Dear XIN CHEN, Enclosed you will find your invoice for the past month...', mailbox: 'demo002@exr.yp', starred: 0, read: 1 },
      { sender: 'GitHub <noreply@github.com>', subject: '[GitHub] A new SSH key was added to your account', preview: 'A new SSH key was added to your account. If you did not expect this...', mailbox: 'demo003@duio.ty', starred: 0, read: 1 },
      { sender: 'Cloudflare <noreply@notify.cloudflare.com>', subject: 'Your domain was successfully added', preview: 'You have successfully added a new domain to your Cloudflare account...', mailbox: 'demo001@exa.cc', starred: 1, read: 1 },
      { sender: 'Stripe <support@stripe.com>', subject: 'Your receipt from Acme Inc.', preview: 'Receipt #2847-1029. Thanks for your payment. Amount paid $20.00...', mailbox: 'demo002@exr.yp', starred: 0, read: 1 },
      { sender: 'Google <no-reply@accounts.google.com>', subject: 'Security alert', preview: 'A new sign-in on Windows. We noticed a new sign-in to your Google Account...', mailbox: 'demo003@duio.ty', starred: 0, read: 1 },
      { sender: 'Vercel <notifications@vercel.com>', subject: 'Your deployment is ready', preview: 'Your project mailfree was deployed to production successfully...', mailbox: 'demo001@exa.cc', starred: 0, read: 1 },
      { sender: 'Apple <no_reply@email.apple.com>', subject: 'Your Apple ID was used to sign in', preview: 'Your Apple ID was used to sign in to iCloud on a new iPhone...', mailbox: 'demo003@duio.ty', starred: 0, read: 1 },
      { sender: 'Notion <team@makenotion.com>', subject: 'Welcome to your new workspace', preview: 'Get started with Notion. Here are a few tips to help you set things up...', mailbox: 'demo002@exr.yp', starred: 0, read: 1 },
    ];
    globalThis.__MOCK_INBOX__ = pool.map((e, i) => ({
      id: 1000 + i,
      sender: e.sender,
      to_addrs: e.mailbox,
      subject: e.subject,
      received_at: new Date(now - i * 5400000).toISOString(),
      is_read: e.read,
      is_starred: e.starred,
      preview: e.preview,
      verification_code: null,
      mailbox_address: e.mailbox
    }));
  }
  const all = globalThis.__MOCK_INBOX__;
  const start = (Math.max(1, page) - 1) * limit;
  const list = all.slice(start, start + limit);
  return { list, page, hasMore: start + list.length < all.length };
}

/**
 * 生成模拟邮箱列表
 * @param {number} count - 邮箱数量
 * @param {number} offset - 偏移量
 * @param {Array<string>} domains - 域名列表
 * @returns {Array<object>} 模拟邮箱列表
 */
export function buildMockMailboxes(count = 5, offset = 0, domains = MOCK_DOMAINS) {
  const mailboxes = [];
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    const idx = offset + i;
    const domain = domains[idx % domains.length];
    const local = `demo${String(idx + 1).padStart(3, '0')}`;
    
    mailboxes.push({
      id: 2000 + idx,
      address: `${local}@${domain}`,
      created_at: new Date(now - idx * 86400000).toISOString().replace('T', ' ').slice(0, 19),
      is_pinned: idx < 2 ? 1 : 0,
      password_is_default: 1,
      can_login: 0,
      forward_to: null,
      is_favorite: idx < 1 ? 1 : 0
    });
  }
  
  return mailboxes;
}

/**
 * 生成模拟邮件详情
 * @param {number|string} emailId - 邮件ID
 * @returns {object} 模拟邮件详情
 */
export function buildMockEmailDetail(emailId) {
  return {
    id: Number(emailId),
    sender: 'support@example.com',
    to_addrs: 'demo@exa.cc',
    subject: '[演示数据] 这是一封演示邮件',
    verification_code: '123456',
    preview: '这是演示邮件的内容预览...',
    content: '这是演示邮件的纯文本内容。\n\n您的验证码是：123456\n\n请在5分钟内使用。',
    html_content: '<div style="padding:20px;"><h2>演示邮件</h2><p>您的验证码是：<strong>123456</strong></p><p>请在5分钟内使用。</p></div>',
    received_at: new Date().toISOString(),
    is_read: 1,
    is_starred: 0,
    r2_bucket: null,
    r2_object_key: null,
    attachments: [
      { index: 0, filename: 'invoice.pdf', mimeType: 'application/pdf', disposition: 'attachment', size: 102400, inline: false, url: `/api/email/${Number(emailId)}/attachment/0` }
    ]
  };
}
