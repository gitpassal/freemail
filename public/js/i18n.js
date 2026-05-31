/* =============================================
   i18n 轻量国际化（中文 / English）
   - 默认中文；用户在设置里切换并记住（localStorage）
   - 静态文案用 data-i18n / data-i18n-ph|title|aria 标注
   - JS 动态文案用 window.t(key, params)
   - 切换语言后整页 reload（渲染时读当前语言，最稳）
   ============================================= */
(function () {
  'use strict';

  var LANG_KEY = 'freemail:lang';
  var SUPPORTED = ['zh', 'en'];

  function readLang() {
    try {
      var v = localStorage.getItem(LANG_KEY);
      if (SUPPORTED.indexOf(v) !== -1) return v;
    } catch (e) {}
    return 'zh'; // 默认中文
  }

  var lang = readLang();

  // ===== 词典 =====
  // 约定：zh 为当前界面原文，en 为简洁商务译文。
  var DICT = {
    // —— 通用 ——
    'common.confirm': { zh: '确定', en: 'Confirm' },
    'common.cancel': { zh: '取消', en: 'Cancel' },
    'common.save': { zh: '保存', en: 'Save' },
    'common.delete': { zh: '删除', en: 'Delete' },
    'common.close': { zh: '关闭', en: 'Close' },
    'common.create': { zh: '创建', en: 'Create' },
    'common.copy': { zh: '复制', en: 'Copy' },
    'common.refresh': { zh: '刷新', en: 'Refresh' },
    'common.search': { zh: '搜索', en: 'Search' },
    'common.prev': { zh: '上一页', en: 'Previous' },
    'common.next': { zh: '下一页', en: 'Next' },
    'common.loading': { zh: '加载中…', en: 'Loading…' },
    'common.processing': { zh: '处理中...', en: 'Processing…' },
    'common.confirmAction': { zh: '确认操作', en: 'Confirm' },
    'common.gotIt': { zh: '知道了', en: 'Got it' },
    'common.selectAll': { zh: '全选', en: 'Select all' },
    'common.clear': { zh: '清空', en: 'Clear' },
    'common.noData': { zh: '暂无数据', en: 'No data' },

    // —— 弹窗默认标题 ——
    'modal.prompt': { zh: '确认', en: 'Confirm' },
    'modal.tip': { zh: '提示', en: 'Notice' },
    'modal.input': { zh: '输入', en: 'Input' },

    // —— 顶栏 / 导航 ——
    'nav.users': { zh: '用户管理', en: 'Users' },
    'nav.allMailboxes': { zh: '所有邮箱', en: 'All mailboxes' },
    'nav.signout': { zh: '退出登录', en: 'Sign out' },
    'nav.githubTitle': { zh: 'GitHub 开源仓库', en: 'GitHub repository' },
    'nav.home': { zh: '首页', en: 'Home' },
    'nav.back': { zh: '返回邮箱', en: 'Back' },
    'nav.backTitle': { zh: '返回邮箱页面', en: 'Back to mailbox' },
    'nav.welcome': { zh: '欢迎用户：', en: 'Welcome' },

    // —— 主题 ——
    'theme.toLight': { zh: '切换到明亮模式', en: 'Switch to light' },
    'theme.toDark': { zh: '切换到暗黑模式', en: 'Switch to dark' },
    'theme.toggle': { zh: '切换主题', en: 'Toggle theme' },

    // —— 语言 ——
    'lang.label': { zh: '语言', en: 'Language' },
    'lang.toggleTitle': { zh: '切换语言', en: 'Switch language' },

    // —— 角色徽章 ——
    'role.super': { zh: '超级管理员', en: 'admin' },
    'role.demo': { zh: '演示模式', en: 'Demo' },
    'role.advanced': { zh: '高级用户：{name}', en: 'Premium: {name}' },
    'role.user': { zh: '用户：{name}', en: 'User: {name}' },

    // —— 底部 Tab / 设置 sheet ——
    'tab.inbox': { zh: '收件箱', en: 'Inbox' },
    'tab.generate': { zh: '生成', en: 'Generate' },
    'tab.mailboxes': { zh: '邮箱', en: 'Mailboxes' },
    'tab.settings': { zh: '设置', en: 'Settings' },
    'settings.title': { zh: '设置', en: 'Settings' },
    'settings.appearance': { zh: '外观', en: 'Appearance' },
    'settings.manage': { zh: '管理', en: 'Management' },
    'settings.account': { zh: '账户', en: 'Account' },
    'settings.light': { zh: '浅色', en: 'Light' },
    'settings.dark': { zh: '深色', en: 'Dark' },
    'settings.theme': { zh: '切换主题', en: 'Theme' },
    'settings.language': { zh: '语言 / Language', en: 'Language / 语言' },
    'settings.users': { zh: '用户管理', en: 'Users' },
    'settings.allMailboxes': { zh: '所有邮箱', en: 'All mailboxes' },
    'settings.github': { zh: 'GitHub 仓库', en: 'GitHub' },
    'settings.notifGroup': { zh: '通知', en: 'Notifications' },
    'settings.notifCenter': { zh: '通知中心', en: 'Notification center' },
    'settings.forwardGroup': { zh: '转发邮箱', en: 'Forwarding emails' },
    'settings.forwardEmpty': { zh: '尚未添加转发邮箱', en: 'No forwarding emails yet' },
    'settings.forwardAdd': { zh: '添加转发邮箱', en: 'Add forwarding email' },
    'settings.forwardRemove': { zh: '删除', en: 'Remove' },
    'settings.forwardHint': { zh: '在此添加你自己的转发邮箱；创建别名时可在「转发到」选择。默认不转发，邮件只在本应用内查看。', en: 'Add your own forwarding emails here; pick one under “Forward to” when creating an alias. Forwarding is off by default — mail stays in this app.' },
    'settings.forwardPrompt': { zh: '输入要添加的转发邮箱', en: 'Enter a forwarding email to add' },
    'settings.forwardInvalid': { zh: '邮箱格式不正确', en: 'Invalid email address' },
    'settings.forwardExists': { zh: '该邮箱已添加', en: 'Already added' },
    'settings.forwardAdded': { zh: '已添加转发邮箱', en: 'Forwarding email added' },
    'settings.forwardRemoved': { zh: '已删除', en: 'Removed' },
    'settings.signout': { zh: '退出登录', en: 'Sign out' },

    // —— 邮箱列表（Proton 风 · 按时间分组）/ 详情管理卡 ——
    'mb.groupRecent': { zh: '最近一周', en: 'Last week' },
    'mb.groupTwoWeeks': { zh: '最近两周', en: 'Last two weeks' },
    'mb.groupEarlier': { zh: '更早', en: 'Earlier' },
    'mb.groupPinned': { zh: '置顶', en: 'Pinned' },
    'mb.detailAlias': { zh: '别名邮箱', en: 'Alias' },
    'mb.detailAddress': { zh: '邮箱地址', en: 'Email address' },
    'mb.detailForward': { zh: '转发到', en: 'Forward to' },
    'mb.detailForwardNone': { zh: '未设置（仅应用内查看）', en: 'Not set (view in app only)' },
    'mb.detailCreated': { zh: '创建于', en: 'Created' },
    'mb.detailCopy': { zh: '复制地址', en: 'Copy address' },
    'mb.detailInbox': { zh: '收件箱', en: 'Inbox' },

    // —— 首页 / 主应用 ——
    'app.history': { zh: '历史邮箱', en: 'Mailboxes' },
    'app.searchHistory': { zh: '搜索历史邮箱', en: 'Search mailboxes' },
    'app.collapseSidebar': { zh: '收起侧板', en: 'Collapse' },
    'app.collapseSidebarAria': { zh: '收起侧边栏', en: 'Collapse sidebar' },
    'app.toggleHistory': { zh: '展开/收起历史邮箱', en: 'Toggle mailboxes' },
    'app.toggleHistoryAria': { zh: '展开或收起历史邮箱列表', en: 'Toggle mailbox list' },
    'app.generateTitle': { zh: '生成临时邮箱', en: 'Generate alias' },
    'app.currentMailbox': { zh: '当前邮箱', en: 'Current address' },
    'app.placeholderGen': { zh: '点击右侧生成按钮创建邮箱地址', en: 'Tap Generate to create an address' },
    'app.prefixPh': { zh: 'Enter prefix, e.g. giffgaff', en: 'Enter prefix, e.g. giffgaff' },
    'app.usernamePh': { zh: '自定义邮箱用户名', en: 'Custom username' },
    'app.addSuffix': { zh: 'Add Suffix', en: 'Add Suffix' },
    'app.addSuffixTitle': { zh: '自动追加随机 Suffix', en: 'Append a random suffix' },
    'app.copyMailbox': { zh: '复制邮箱', en: 'Copy address' },
    'app.copyMailboxAria': { zh: '复制邮箱地址', en: 'Copy address' },
    'app.sendMail': { zh: '发邮件', en: 'Compose' },
    'app.clearMail': { zh: '清空邮件', en: 'Clear' },
    'app.refreshMail': { zh: '刷新邮件', en: 'Refresh' },
    'app.forwardSettings': { zh: '转发设置', en: 'Forwarding' },
    'app.favorite': { zh: '收藏邮箱', en: 'Favorite' },
    'app.unfavorite': { zh: '取消收藏', en: 'Unfavorite' },
    'app.config': { zh: '邮箱配置', en: 'Options' },
    'app.toggleConfig': { zh: '展开/收起配置', en: 'Toggle options' },
    'app.toggleConfigAria': { zh: '展开或收起配置面板', en: 'Toggle options panel' },
    'app.domain': { zh: '邮箱后缀', en: 'Domain' },
    'app.domainAria': { zh: '选择邮箱后缀域名', en: 'Select domain' },
    'app.length': { zh: '用户名长度', en: 'Length' },
    'app.lengthAria': { zh: '设置用户名长度', en: 'Set username length' },
    'app.unit': { zh: '位', en: 'chars' },
    'app.randomGen': { zh: '随机生成', en: 'Random' },
    'app.randomGenAria': { zh: '随机生成邮箱', en: 'Generate random address' },
    'app.randomName': { zh: '随机人名', en: 'Name-based' },
    'app.randomNameTitle': { zh: '使用随机人名生成邮箱', en: 'Generate from a random name' },
    'app.toggleCustom': { zh: '切换自定义', en: 'Custom' },
    'app.toggleCustomTitle': { zh: '自定义邮箱', en: 'Custom address' },
    'app.toggleCustomAria': { zh: '切换到自定义邮箱模式', en: 'Switch to custom mode' },
    'app.create': { zh: '创建', en: 'Create' },
    'app.boxInbox': { zh: '收件箱', en: 'Inbox' },
    'app.boxSent': { zh: '发件箱', en: 'Sent' },
    'app.enterMailbox': { zh: '进入邮箱', en: 'Open inbox' },
    'app.genMailbox': { zh: '生成邮箱', en: 'Generate' },

    // —— 撰写邮件 ——
    'compose.title': { zh: '新邮件', en: 'New message' },
    'compose.to': { zh: '收件人', en: 'To' },
    'compose.toHint': { zh: '多个地址请以逗号分隔', en: 'Separate addresses with commas' },
    'compose.fromName': { zh: '发件名称（可选）', en: 'Sender name (optional)' },
    'compose.fromNamePh': { zh: '例如：iDing 支持团队', en: 'e.g. Support Team' },
    'compose.subject': { zh: '主题', en: 'Subject' },
    'compose.subjectPh': { zh: '主题', en: 'Subject' },
    'compose.body': { zh: '内容', en: 'Message' },
    'compose.bodyPh': { zh: '请输入邮件内容', en: 'Write your message' },
    'compose.send': { zh: '发送', en: 'Send' },
    'compose.sending': { zh: '发送中...', en: 'Sending…' },

    // —— 邮件详情 / 列表 ——
    'mail.detail': { zh: '邮件详情', en: 'Message' },
    'mail.from': { zh: '发件人', en: 'From' },
    'mail.to': { zh: '收件人', en: 'To' },
    'mail.subject': { zh: '主题', en: 'Subject' },
    'mail.noSubject': { zh: '(无主题)', en: '(No subject)' },
    'mail.selectOne': { zh: '请选择一封邮件', en: 'Select a message' },
    'mail.empty': { zh: '暂无邮件', en: 'No messages' },
    'mail.deleteMail': { zh: '删除邮件', en: 'Delete' },
    'mail.code': { zh: '验证码', en: 'Code' },
    'mail.andMore': { zh: '等{n}人', en: 'and {n} more' },

    // —— 登录页 ——
    'login.title': { zh: '登录到临时邮箱', en: 'Sign in' },
    'login.guestHint': { zh: '账号：guest，密码：guest，将进入观看模式。', en: 'Use guest / guest for demo mode.' },
    'login.usernamePh': { zh: '用户名/邮箱', en: 'Username / email' },
    'login.usernameAria': { zh: '用户名或邮箱地址', en: 'Username or email' },
    'login.passwordPh': { zh: '密码', en: 'Password' },
    'login.passwordAria': { zh: '密码', en: 'Password' },
    'login.submit': { zh: '登录', en: 'Sign in' },
    'login.signingIn': { zh: '正在登录…', en: 'Signing in…' },
    'login.emptyPassword': { zh: '密码不能为空', en: 'Password is required' },
    'login.emptyUsername': { zh: '用户名不能为空', en: 'Username is required' },
    'login.failed': { zh: '登录失败', en: 'Sign-in failed' },
    'login.networkError': { zh: '网络错误，请重试', en: 'Network error, please retry' },
    'login.success': { zh: '登录成功，正在跳转...', en: 'Signed in, redirecting…' },
    'login.networkFailRetry': { zh: '网络连接失败，请检查网络后重试', en: 'Connection failed, check your network and retry' },

    // —— 页脚 / 加载页 ——
    'footer.tagline': { zh: '简约而不简单', en: 'Simple, not simplistic' },
    'loading.title': { zh: '临时邮箱', en: 'Temp Mail' },
    'loading.wait': { zh: '请稍候...', en: 'Please wait…' },
    'loading.checkingAuth': { zh: '正在校验权限…', en: 'Verifying access…' },
    'loading.openingMailboxes': { zh: '正在打开邮箱总览页面…', en: 'Opening mailboxes…' },

    // —— 文档标题 ——
    'title.home': { zh: 'Cloudflare Alias', en: 'Cloudflare Alias' },
    'title.login': { zh: '登录 - Cloudflare Alias', en: 'Sign in - Cloudflare Alias' },
    'title.admin': { zh: '用户管理 - Cloudflare Alias', en: 'Users - Cloudflare Alias' },
    'title.mailboxes': { zh: '邮箱管理 - Cloudflare Alias', en: 'Mailboxes - Cloudflare Alias' },
    'title.mailbox': { zh: '我的邮箱 - Cloudflare Alias', en: 'My Mailbox - Cloudflare Alias' },
    'title.loading': { zh: '加载中 - Cloudflare Alias', en: 'Loading - Cloudflare Alias' },

    // —— 相对时间 ——
    'time.justNow': { zh: '刚刚', en: 'just now' },
    'time.minutesAgo': { zh: '{n}分钟前', en: '{n} min ago' },
    'time.hoursAgo': { zh: '{n}小时前', en: '{n}h ago' },
    'time.daysAgo': { zh: '{n}天前', en: '{n}d ago' },

    // —— 分页 / 计数（带插值）——
    'page.info': { zh: '第 {page} / {total} 页', en: 'Page {page} of {total}' },
    'page.infoCount': { zh: '第 {page} / {total} 页 (共 {count} 个)', en: 'Page {page} of {total} ({count} total)' },
    'page.range': { zh: '显示 {start}-{end} 条，共 {total} 条', en: '{start}-{end} of {total}' },
    'count.users': { zh: '{n} 人', en: '{n} users' },
    'count.mailboxes': { zh: '{n} 个', en: '{n} mailboxes' },

    // —— Toast（通用动作反馈）——
    'toast.copied': { zh: '已复制', en: 'Copied' },
    'toast.copyFailed': { zh: '复制失败', en: 'Copy failed' },
    'toast.copiedAddr': { zh: '已复制：{addr}', en: 'Copied: {addr}' },
    'toast.codeCopied': { zh: '验证码 {code} 已复制', en: 'Code {code} copied' },
    'toast.saved': { zh: '保存成功', en: 'Saved' },
    'toast.deleted': { zh: '已删除', en: 'Deleted' },
    'toast.opFailed': { zh: '操作失败', en: 'Action failed' },
    'toast.loadFailed': { zh: '加载失败', en: 'Failed to load' },
    'toast.networkError': { zh: '网络错误', en: 'Network error' },
    'toast.created': { zh: '创建成功', en: 'Created' },
    'toast.sent': { zh: '发送成功', en: 'Sent' },
    'toast.sendFailed': { zh: '发送失败', en: 'Send failed' },
    'toast.cleared': { zh: '已清空', en: 'Cleared' },
    'toast.pinned': { zh: '已置顶', en: 'Pinned' },
    'toast.unpinned': { zh: '已取消置顶', en: 'Unpinned' },
    'toast.needMailbox': { zh: '请先生成或选择一个邮箱', en: 'Generate or select a mailbox first' },

    // —— 邮箱用户页 mailbox.html ——
    'mb.roleMailbox': { zh: '邮箱用户', en: 'Mailbox user' },
    'mb.myMailbox': { zh: '我的邮箱', en: 'My mailbox' },
    'mb.changePassword': { zh: '修改密码', en: 'Change password' },
    'mb.unread': { zh: '未读', en: 'Unread' },
    'mb.total': { zh: '全部', en: 'Total' },
    'mb.autoRefresh': { zh: '自动刷新', en: 'Auto refresh' },
    'mb.autoRefreshHint': { zh: '开启后按间隔自动刷新', en: 'Auto refresh at the set interval' },
    'mb.refreshInterval': { zh: '刷新间隔', en: 'Refresh interval' },
    'mb.interval10': { zh: '10秒', en: '10s' },
    'mb.interval30': { zh: '30秒', en: '30s' },
    'mb.interval60': { zh: '60秒', en: '60s' },
    'mb.searchPh': { zh: '搜索发件人/主题', en: 'Search sender or subject' },
    'mb.searchAria': { zh: '搜索发件人或主题', en: 'Search sender or subject' },
    'mb.clearFilter': { zh: '清空筛选', en: 'Clear filters' },
    'mb.refreshNow': { zh: '立即刷新', en: 'Refresh now' },
    'mb.refreshListAria': { zh: '刷新邮件列表', en: 'Refresh message list' },
    'mb.retentionHint': { zh: '仅保留24小时', en: 'Kept for 24 hours only' },
    'mb.changePwdHint': { zh: '修改密码后需要重新登录', en: 'Sign in again after changing your password' },
    'mb.currentPassword': { zh: '当前密码', en: 'Current password' },
    'mb.currentPasswordPh': { zh: '请输入当前密码', en: 'Enter your current password' },
    'mb.newPassword': { zh: '新密码', en: 'New password' },
    'mb.newPasswordPh': { zh: '请输入新密码（至少6位）', en: 'Enter a new password (min 6 chars)' },
    'mb.confirmPassword': { zh: '确认新密码', en: 'Confirm new password' },
    'mb.confirmPasswordPh': { zh: '请再次输入新密码', en: 'Re-enter the new password' },

    // —— 邮箱总览页 mailboxes.html ——
    'mbx.allMailboxes': { zh: '所有邮箱', en: 'All mailboxes' },
    'mbx.searchMailboxPh': { zh: '搜索邮箱地址', en: 'Search email address' },
    'mbx.filterByDomain': { zh: '按域名筛选', en: 'Filter by domain' },
    'mbx.allDomains': { zh: '全部域名', en: 'All domains' },
    'mbx.filterByLogin': { zh: '按登录权限筛选', en: 'Filter by login access' },
    'mbx.loginStatus': { zh: '登录状态', en: 'Login status' },
    'mbx.loginAllowed': { zh: '允许登录', en: 'Login allowed' },
    'mbx.loginDenied': { zh: '禁止登录', en: 'Login denied' },
    'mbx.filterByFavorite': { zh: '按收藏筛选', en: 'Filter by favorite' },
    'mbx.favoriteStatus': { zh: '收藏状态', en: 'Favorite status' },
    'mbx.favorited': { zh: '已收藏', en: 'Favorited' },
    'mbx.notFavorited': { zh: '未收藏', en: 'Not favorited' },
    'mbx.filterByForward': { zh: '按转发筛选', en: 'Filter by forwarding' },
    'mbx.forwardStatus': { zh: '转发状态', en: 'Forwarding status' },
    'mbx.forwardSet': { zh: '已设置', en: 'Configured' },
    'mbx.forwardNotSet': { zh: '未设置', en: 'Not configured' },
    'mbx.batchAllow': { zh: '批量放行', en: 'Bulk allow' },
    'mbx.batchAllowTitle': { zh: '批量放行邮箱登录', en: 'Bulk allow mailbox login' },
    'mbx.batchDeny': { zh: '批量禁止', en: 'Bulk deny' },
    'mbx.batchDenyTitle': { zh: '批量禁止邮箱登录', en: 'Bulk deny mailbox login' },
    'mbx.batchFavorite': { zh: '批量收藏', en: 'Bulk favorite' },
    'mbx.batchUnfavorite': { zh: '批量取消', en: 'Bulk unfavorite' },
    'mbx.batchUnfavoriteTitle': { zh: '批量取消收藏', en: 'Bulk unfavorite' },
    'mbx.batchForward': { zh: '批量转发', en: 'Bulk forward' },
    'mbx.batchForwardTitle': { zh: '批量设置转发', en: 'Bulk set forwarding' },
    'mbx.batchClearForward': { zh: '清除转发', en: 'Clear forwarding' },
    'mbx.batchClearForwardTitle': { zh: '批量清除转发', en: 'Bulk clear forwarding' },
    'mbx.gridView': { zh: '网格视图', en: 'Grid view' },
    'mbx.gridViewTitle': { zh: '卡片网格视图', en: 'Card grid view' },
    'mbx.listView': { zh: '列表视图', en: 'List view' },
    'mbx.listViewTitle': { zh: '列表行视图', en: 'List row view' },
    'mbx.resetPasswordTitle': { zh: '重置邮箱密码', en: 'Reset mailbox password' },
    'mbx.resetPasswordDesc': { zh: '将把该邮箱的密码重置为“默认”（即邮箱地址本身）。', en: 'This will reset the mailbox password to the default (the email address itself).' },
    'mbx.emailAddress': { zh: '邮箱地址', en: 'Email address' },
    'mbx.confirmReset': { zh: '确定重置', en: 'Reset' },
    'mbx.changePasswordTitle': { zh: '修改邮箱密码', en: 'Change mailbox password' },
    'mbx.changePasswordDesc': { zh: '为该邮箱设置新的自定义密码。', en: 'Set a new custom password for this mailbox.' },
    'mbx.newPassword': { zh: '新密码', en: 'New password' },
    'mbx.newPasswordPh': { zh: '请输入新密码（至少6位）', en: 'Enter a new password (min. 6 characters)' },
    'mbx.confirmNewPassword': { zh: '确认新密码', en: 'Confirm new password' },
    'mbx.confirmNewPasswordPh': { zh: '请再次输入新密码', en: 'Re-enter the new password' },
    'mbx.changePasswordSubmit': { zh: '修改密码', en: 'Change password' },
    'mbx.emailListLabel': { zh: '邮箱地址列表（一行一个）', en: 'Email address list (one per line)' },
    'mbx.emailListPh': { zh: '请输入邮箱地址，一行一个\n例如：\nuser1@example.com\nuser2@example.com\nuser3@example.com', en: 'Enter email addresses, one per line\ne.g.\nuser1@example.com\nuser2@example.com\nuser3@example.com' },
    'mbx.forwardTarget': { zh: '转发目标邮箱', en: 'Forwarding target' },
    'mbx.forwardTargetPh': { zh: '所有选中邮箱将转发到此地址', en: 'All selected mailboxes will forward to this address' },
    'mbx.confirmAction': { zh: '确定操作', en: 'Confirm' },
    'mbx.newPasswordSimplePh': { zh: '请输入新密码', en: 'Enter a new password' },
    'mbx.showPassword': { zh: '显示密码', en: 'Show password' },
    'mbx.assignTitle': { zh: '分配邮箱给用户', en: 'Assign mailbox to users' },
    'mbx.selectUsers': { zh: '选择要分配的用户', en: 'Select users to assign' },
    'mbx.searchUserPh': { zh: '搜索用户名或显示名称...', en: 'Search by username or display name…' },
    'mbx.loadingUsers': { zh: '正在加载用户列表...', en: 'Loading user list…' },
    'mbx.noAssignableUsers': { zh: '暂无可分配用户', en: 'No users available to assign' },
    'mbx.selectedUsers': { zh: '已选择用户', en: 'Selected users' },
    'mbx.confirmAssign': { zh: '确定分配', en: 'Assign' },
    'mbx.assigning': { zh: '分配中...', en: 'Assigning…' },

    // —— 顶栏品牌后缀（保留 __APP_NAME__，仅译后缀）——
    'adm.brandSuffix': { zh: ' - 用户管理', en: ' - Users' },
    'mbx.brandSuffix': { zh: ' - 邮箱总览', en: ' - Mailboxes' },

    // —— 用户管理页 admin.html ——
    'adm.demoBanner': { zh: '当前为演示管理页：所有改动仅在浏览器会话中模拟', en: 'Demo admin page: all changes are simulated in this browser session only' },
    'adm.statTotalUsers': { zh: '总用户数', en: 'Total users' },
    'adm.statAdmins': { zh: '管理员', en: 'Admins' },
    'adm.statMailboxes': { zh: '邮箱总数', en: 'Total mailboxes' },
    'adm.statActiveUsers': { zh: '可发件用户', en: 'Sending users' },
    'adm.actionsTitle': { zh: '管理操作', en: 'Actions' },
    'adm.createUser': { zh: '创建用户', en: 'Create user' },
    'adm.createUserAria': { zh: '创建新用户', en: 'Create new user' },
    'adm.assignMailbox': { zh: '分配邮箱', en: 'Assign mailbox' },
    'adm.unassignMailbox': { zh: '取消分配邮箱', en: 'Unassign mailbox' },
    'adm.unassign': { zh: '取消分配', en: 'Unassign' },
    'adm.assign': { zh: '分配', en: 'Assign' },
    'adm.sysSettings': { zh: '系统设置', en: 'System Settings' },
    'adm.autoCreate': { zh: '自动创建未知邮箱', en: 'Auto-create unknown mailboxes' },
    'adm.autoCreateDesc': { zh: '收到发往未知地址的邮件时允许自动创建', en: 'Allow new recipient addresses to be created when mail arrives.' },
    'adm.userListTitle': { zh: '用户列表', en: 'User list' },
    'adm.refreshUsers': { zh: '刷新用户列表', en: 'Refresh user list' },
    'adm.thUsername': { zh: '用户名', en: 'Username' },
    'adm.thRole': { zh: '角色', en: 'Role' },
    'adm.thMailbox': { zh: '邮箱', en: 'Mailbox' },
    'adm.thCanSend': { zh: '发件', en: 'Send' },
    'adm.thCreated': { zh: '创建时间', en: 'Created' },
    'adm.thActions': { zh: '操作', en: 'Actions' },
    'adm.userMailboxesTitle': { zh: '用户的邮箱', en: 'User mailboxes' },
    'adm.selectUserToView': { zh: '选择用户查看', en: 'Select a user to view' },
    'adm.emptyMailboxHint': { zh: '点击左侧用户查看其邮箱', en: 'Select a user on the left to view their mailboxes' },
    'adm.editUserTitle': { zh: '编辑用户', en: 'Edit user' },
    'adm.newPassword': { zh: '新密码', en: 'New password' },
    'adm.newUsername': { zh: '新用户名', en: 'New username' },
    'adm.mailboxLimit': { zh: '邮箱上限', en: 'Mailbox limit' },
    'adm.leaveBlankPh': { zh: '留空则不修改', en: 'Leave blank to keep unchanged' },
    'adm.premiumUser': { zh: '高级用户', en: 'Premium user' },
    'adm.allowSend': { zh: '允许发件', en: 'Allow sending' },
    'adm.username': { zh: '用户名', en: 'Username' },
    'adm.usernamePh': { zh: '输入用户名', en: 'Enter username' },
    'adm.password': { zh: '密码', en: 'Password' },
    'adm.passwordPh': { zh: '输入密码', en: 'Enter password' },
    'adm.role': { zh: '角色', en: 'Role' },
    'adm.roleUser': { zh: '普通用户', en: 'User' },
    'adm.roleAdmin': { zh: '管理员', en: 'Admin' },
    'adm.emailAddress': { zh: '邮箱地址', en: 'Email address' },
    'adm.assignHint': { zh: '每行一个邮箱地址，支持批量分配', en: 'One address per line; bulk assignment supported' },
    'adm.unassignHint': { zh: '每行一个邮箱地址，支持批量取消分配', en: 'One address per line; bulk unassignment supported' },

    // ===== 管理页动态文案（JS） =====
    'adm2.loadSettingsFailed': { zh: '加载系统设置失败', en: 'Failed to load system settings' },
    'adm2.saveSettingsFailed': { zh: '设置保存失败', en: 'Failed to save settings' },
    'adm2.userNotFound': { zh: '用户不存在', en: 'User not found' },
    'adm2.loadUserFailed': { zh: '加载用户信息失败', en: 'Failed to load user' },
    'adm2.saveFailed': { zh: '保存失败', en: 'Failed to save' },
    'adm2.createFailed': { zh: '创建失败', en: 'Failed to create' },
    'adm2.deleteFailed': { zh: '删除失败', en: 'Failed to delete' },
    'adm2.assignFailed': { zh: '分配失败', en: 'Failed to assign' },
    'adm2.unassignFailed': { zh: '取消分配失败', en: 'Failed to unassign' },
    'adm2.unassigned': { zh: '已取消分配', en: 'Unassigned' },
    'adm2.loadMailboxesFailed': { zh: '加载邮箱失败', en: 'Failed to load mailboxes' },
    'adm2.mailboxCount': { zh: '{n} 个', en: '{n} mailboxes' },
    'adm2.confirmUnassign': { zh: '确定取消分配邮箱 {address}？', en: 'Unassign mailbox {address}?' },
    'adm2.confirmDeleteUser': { zh: '确定删除用户 "{name}" 吗？此操作不可恢复。', en: 'Delete user "{name}"? This cannot be undone.' },
    'adm2.usernamePasswordRequired': { zh: '用户名和密码不能为空', en: 'Username and password are required' },
    'adm2.enterUsername': { zh: '请输入用户名', en: 'Enter a username' },
    'adm2.enterEmail': { zh: '请输入邮箱地址', en: 'Enter an email address' },
    'adm2.enterValidEmail': { zh: '请输入有效的邮箱地址', en: 'Enter a valid email address' },
    'adm2.assignedN': { zh: '成功分配 {n} 个邮箱', en: 'Assigned {n} mailboxes' },
    'adm2.unassignedN': { zh: '成功取消分配 {n} 个邮箱', en: 'Unassigned {n} mailboxes' },
    'adm2.batchResult': { zh: '成功 {a} 个，失败 {b} 个', en: '{a} succeeded, {b} failed' },
    'adm2.edit': { zh: '编辑', en: 'Edit' },
    'adm2.noUsers': { zh: '暂无用户', en: 'No users' },
    'adm2.totalCount': { zh: '共 {total} 条', en: '{total} total' },
    'adm2.pageInfo': { zh: '第 {currentPage} / {totalPages} 页，共 {total} 条', en: 'Page {currentPage} / {totalPages}, {total} total' },
    'adm2.usernameRequired': { zh: '用户名不能为空', en: 'Username is required' },
    'adm2.passwordRequired': { zh: '密码不能为空', en: 'Password is required' },
    'adm2.mailboxLimitInvalid': { zh: '邮箱上限必须是非负整数', en: 'Mailbox limit must be a non-negative integer' },
    'adm2.enterUsernamePh': { zh: '请输入用户名', en: 'Enter a username' },
    'adm2.enterPasswordPh': { zh: '请输入密码', en: 'Enter a password' }
  };

  // ===== 引擎 =====
  function interpolate(str, params) {
    if (!params) return str;
    return str.replace(/\{(\w+)\}/g, function (m, k) {
      return (params[k] !== undefined && params[k] !== null) ? params[k] : m;
    });
  }

  function t(key, params) {
    var entry = DICT[key];
    if (!entry) return interpolate(key, params); // 缺词典时回退键名（开发期可见）
    var str = entry[lang] || entry.zh || key;
    return interpolate(str, params);
  }

  function applyTo(el) {
    if (el.nodeType !== 1) return;
    var k;
    if ((k = el.getAttribute('data-i18n'))) el.textContent = t(k);
    if ((k = el.getAttribute('data-i18n-html'))) el.innerHTML = t(k);
    if ((k = el.getAttribute('data-i18n-ph'))) el.setAttribute('placeholder', t(k));
    if ((k = el.getAttribute('data-i18n-title'))) el.setAttribute('title', t(k));
    if ((k = el.getAttribute('data-i18n-aria'))) el.setAttribute('aria-label', t(k));
  }

  function applyTranslations(root) {
    root = root || document;
    if (root.nodeType === 1) {
      if (root.hasAttribute && (root.hasAttribute('data-i18n') || root.hasAttribute('data-i18n-ph') ||
          root.hasAttribute('data-i18n-title') || root.hasAttribute('data-i18n-aria') || root.hasAttribute('data-i18n-html'))) {
        applyTo(root);
      }
    }
    if (root.querySelectorAll) {
      var nodes = root.querySelectorAll('[data-i18n],[data-i18n-ph],[data-i18n-title],[data-i18n-aria],[data-i18n-html]');
      for (var i = 0; i < nodes.length; i++) applyTo(nodes[i]);
    }
  }

  function applyTitle() {
    try {
      var key = document.documentElement.getAttribute('data-i18n-doctitle');
      if (key) document.title = t(key);
    } catch (e) {}
  }

  function setLang(next) {
    if (SUPPORTED.indexOf(next) === -1 || next === lang) return;
    try { localStorage.setItem(LANG_KEY, next); } catch (e) {}
    // 切换即整页重载：所有渲染（含 JS 动态文案）按新语言重新生成
    try { location.reload(); } catch (e) { lang = next; applyTranslations(document); }
  }

  function getLang() { return lang; }

  // 立即设置 <html lang>，使其它脚本读到正确语言
  try { document.documentElement.setAttribute('lang', lang === 'en' ? 'en' : 'zh-CN'); } catch (e) {}

  // ===== 语言切换按钮（桌面顶栏 / 登录页 .nav-actions）=====
  function createLangButton() {
    var btn = document.createElement('button');
    btn.id = 'lang-toggle';
    btn.type = 'button';
    btn.className = 'btn btn-ghost lang-toggle-btn';
    btn.setAttribute('aria-label', t('lang.toggleTitle'));
    btn.title = t('lang.toggleTitle');
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<use href="/icons/sprites.svg#icon-globe"/></svg>' +
      '<span class="lang-label">' + (lang === 'en' ? '中' : 'EN') + '</span>';
    btn.onclick = function (e) {
      e.preventDefault(); e.stopPropagation();
      setLang(lang === 'en' ? 'zh' : 'en');
    };
    return btn;
  }

  var navTries = 0;
  function addLangButtonToNav() {
    if (document.getElementById('lang-toggle')) return;
    var nav = document.querySelector('.nav-actions');
    if (nav) { nav.appendChild(createLangButton()); return; }
    // 登录页等无 .nav-actions：挂到主题按钮旁（独立 #theme-toggle）
    var themeBtn = document.getElementById('theme-toggle');
    if (themeBtn && themeBtn.parentNode && !document.querySelector('.nav-actions')) {
      var b = createLangButton();
      b.className = 'lang-toggle-login';
      themeBtn.parentNode.insertBefore(b, themeBtn);
      return;
    }
    if (navTries++ < 50) setTimeout(addLangButtonToNav, 200);
  }

  // ===== 启动 =====
  // 尽早开始观察 DOM，捕获异步注入的片段（app.html）与动态渲染的 data-i18n 节点
  var observer = null;
  function startObserver() {
    if (observer || !window.MutationObserver) return;
    observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType === 1) applyTranslations(n);
        }
      }
    });
    try { observer.observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
  }

  function init() {
    applyTranslations(document);
    applyTitle();
    addLangButtonToNav();
  }

  startObserver();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); setTimeout(addLangButtonToNav, 300); });
  } else {
    init();
    setTimeout(addLangButtonToNav, 300);
  }

  // 跨标签页同步
  try {
    window.addEventListener('storage', function (e) {
      if (e.key === LANG_KEY && SUPPORTED.indexOf(e.newValue) !== -1 && e.newValue !== lang) {
        lang = e.newValue; applyTranslations(document); applyTitle();
      }
    });
  } catch (e) {}

  // ===== 全局 API =====
  window.t = t;
  window.i18n = {
    t: t,
    setLang: setLang,
    getLang: getLang,
    apply: applyTranslations,
    addKeys: function (obj) { for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) DICT[k] = obj[k]; }
  };
})();
