// ============================================================
// RSS 订阅推送 Telegram Bot - Cloudflare Worker
// ============================================================
// 环境变量 (Secrets):
//   BOT_TOKEN      - Telegram Bot API Token
//   WEBHOOK_SECRET - Webhook URL 路径密钥
//   ADMIN_PASSWORD - 管理端点密码
//
// KV Namespace Binding:
//   RSS_KV - 数据存储 KV 命名空间
//
// Cron Trigger (wrangler.toml):
//   [triggers]
//   crons = ["*/5 * * * *"]
// ============================================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 首页 - 使用说明
    if (path === '/' && request.method === 'GET') {
      return handleHome(env, url.origin);
    }

    // 设置 Webhook 和命令
    if (path === '/setup') {
      const pw = url.searchParams.get('password') || '';
      if (pw !== env.ADMIN_PASSWORD) return jsonRes({ error: 'Unauthorized' }, 401);
      return await handleSetup(env, url.origin);
    }

    // 移除 Webhook
    if (path === '/remove') {
      const pw = url.searchParams.get('password') || '';
      if (pw !== env.ADMIN_PASSWORD) return jsonRes({ error: 'Unauthorized' }, 401);
      return await handleRemove(env);
    }

    // 手动触发 RSS 检查
    if (path === '/cron') {
      const pw = url.searchParams.get('password') || '';
      if (pw !== env.ADMIN_PASSWORD) return jsonRes({ error: 'Unauthorized' }, 401);
      ctx.waitUntil(checkAllFeeds(env));
      return jsonRes({ status: 'Feed check triggered' });
    }

    // Telegram Webhook 端点
    if (path === `/webhook/${env.WEBHOOK_SECRET}` && request.method === 'POST') {
      const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
      if (secret !== env.WEBHOOK_SECRET) {
        return new Response('Forbidden', { status: 403 });
      }
      try {
        const update = await request.json();
        ctx.waitUntil(processUpdate(update, env));
      } catch (e) {
        console.error('Webhook error:', e);
      }
      return new Response('OK');
    }

    return new Response('Not Found', { status: 404 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkAllFeeds(env));
  }
};

// ============================================================
// 1. 路由处理
// ============================================================

function handleHome(env, origin) {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RSS 订阅推送 Bot</title>
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body { font-family: 'Inter', system-ui, sans-serif; }
    .code-block { position: relative; }
    .copy-btn { position: absolute; top: 8px; right: 8px; }
  </style>
</head>
<body class="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100 min-h-screen">
  <div class="max-w-3xl mx-auto px-4 py-12">
    <!-- Header -->
    <div class="text-center mb-12">
      <div class="text-6xl mb-4">📡</div>
      <h1 class="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
        RSS 订阅推送 Bot
      </h1>
      <p class="text-gray-400 mt-3 text-lg">基于 Cloudflare Worker 的 Telegram RSS 订阅推送机器人</p>
    </div>

    <!-- 功能介绍 -->
    <div class="bg-gray-800/50 rounded-2xl p-6 mb-8 border border-gray-700/50 backdrop-blur">
      <h2 class="text-xl font-semibold text-blue-400 mb-4">✨ 功能特点</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="flex items-start gap-3">
          <span class="text-2xl">📰</span>
          <div>
            <h3 class="font-medium">RSS/Atom 订阅</h3>
            <p class="text-gray-400 text-sm">支持 RSS 2.0 和 Atom 格式订阅源</p>
          </div>
        </div>
        <div class="flex items-start gap-3">
          <span class="text-2xl">🔔</span>
          <div>
            <h3 class="font-medium">自动推送</h3>
            <p class="text-gray-400 text-sm">默认每 5 分钟检查更新并推送新内容</p>
          </div>
        </div>
        <div class="flex items-start gap-3">
          <span class="text-2xl">🎛️</span>
          <div>
            <h3 class="font-medium">便捷管理</h3>
            <p class="text-gray-400 text-sm">通过 Inline 按钮轻松管理所有订阅</p>
          </div>
        </div>
        <div class="flex items-start gap-3">
          <span class="text-2xl">⚡</span>
          <div>
            <h3 class="font-medium">Serverless</h3>
            <p class="text-gray-400 text-sm">基于 Cloudflare Worker，零运维成本</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 部署步骤 -->
    <div class="bg-gray-800/50 rounded-2xl p-6 mb-8 border border-gray-700/50">
      <h2 class="text-xl font-semibold text-green-400 mb-4">🚀 部署步骤</h2>
      <div class="space-y-4 text-sm">
        <div>
          <h3 class="font-medium text-white mb-2">1. 配置 wrangler.toml</h3>
          <div class="code-block">
            <pre class="bg-gray-900 rounded-lg p-4 overflow-x-auto text-green-300 border border-gray-700"><code>name = "rss-telegram-bot"
main = "worker.js"
compatibility_date = "2024-01-01"

[triggers]
crons = ["*/5 * * * *"]

[[kv_namespaces]]
binding = "RSS_KV"
id = "your-kv-namespace-id"</code></pre>
          </div>
        </div>
        <div>
          <h3 class="font-medium text-white mb-2">2. 设置环境变量 (Secrets)</h3>
          <div class="code-block">
            <pre class="bg-gray-900 rounded-lg p-4 overflow-x-auto text-yellow-300 border border-gray-700"><code>wrangler secret put BOT_TOKEN
wrangler secret put WEBHOOK_SECRET
wrangler secret put ADMIN_PASSWORD</code></pre>
          </div>
        </div>
        <div>
          <h3 class="font-medium text-white mb-2">3. 创建 KV 命名空间</h3>
          <div class="code-block">
            <pre class="bg-gray-900 rounded-lg p-4 overflow-x-auto text-cyan-300 border border-gray-700"><code>wrangler kv namespace create "RSS_KV"</code></pre>
          </div>
        </div>
        <div>
          <h3 class="font-medium text-white mb-2">4. 部署并设置 Webhook</h3>
          <div class="code-block">
            <pre class="bg-gray-900 rounded-lg p-4 overflow-x-auto text-purple-300 border border-gray-700"><code># 部署 Worker
wrangler deploy

# 一键设置 Webhook 和 Bot 命令
curl "${origin}/setup?password=YOUR_ADMIN_PASSWORD"

# 移除 Webhook（如需要）
curl "${origin}/remove?password=YOUR_ADMIN_PASSWORD"

# 手动触发 RSS 检查
curl "${origin}/cron?password=YOUR_ADMIN_PASSWORD"</code></pre>
          </div>
        </div>
      </div>
    </div>

    <!-- 使用说明 -->
    <div class="bg-gray-800/50 rounded-2xl p-6 mb-8 border border-gray-700/50">
      <h2 class="text-xl font-semibold text-purple-400 mb-4">📖 使用说明</h2>
      <div class="space-y-3 text-gray-300 text-sm">
        <p>1. 在 Telegram 中找到你的 Bot 并点击 <strong class="text-white">Start</strong></p>
        <p>2. Bot 会发送欢迎消息和 <strong class="text-white">订阅管理</strong> 按钮</p>
        <p>3. 点击 <strong class="text-white">订阅管理</strong> 查看订阅列表</p>
        <p>4. 点击 <strong class="text-white">添加订阅</strong> 并发送 RSS 链接来添加新订阅</p>
        <p>5. 点击订阅名称查看详情，可以编辑 URL 或删除订阅</p>
        <p>6. Bot 会每 5 分钟自动检查所有订阅源并推送新内容</p>
      </div>
    </div>

    <!-- 环境变量说明 -->
    <div class="bg-gray-800/50 rounded-2xl p-6 mb-8 border border-gray-700/50">
      <h2 class="text-xl font-semibold text-orange-400 mb-4">🔐 环境变量说明</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left border-b border-gray-700">
              <th class="pb-2 text-gray-400">变量名</th>
              <th class="pb-2 text-gray-400">说明</th>
              <th class="pb-2 text-gray-400">示例</th>
            </tr>
          </thead>
          <tbody class="text-gray-300">
            <tr class="border-b border-gray-700/50">
              <td class="py-2"><code class="text-blue-400">BOT_TOKEN</code></td>
              <td class="py-2">Telegram Bot Token</td>
              <td class="py-2 text-gray-500">123456:ABC-DEF...</td>
            </tr>
            <tr class="border-b border-gray-700/50">
              <td class="py-2"><code class="text-blue-400">WEBHOOK_SECRET</code></td>
              <td class="py-2">Webhook 密钥路径</td>
              <td class="py-2 text-gray-500">my_secret_path_123</td>
            </tr>
            <tr>
              <td class="py-2"><code class="text-blue-400">ADMIN_PASSWORD</code></td>
              <td class="py-2">管理端点密码</td>
              <td class="py-2 text-gray-500">your_secure_password</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div class="text-center text-gray-500 text-sm">
      <p>Powered by Cloudflare Workers & Telegram Bot API</p>
      <p class="mt-1">当前状态: ✅ 运行中</p>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

async function handleSetup(env, origin) {
  const webhookUrl = `${origin}/webhook/${env.WEBHOOK_SECRET}`;

  const whResult = await callTG(env, 'setWebhook', {
    url: webhookUrl,
    allowed_updates: ['message', 'callback_query'],
    secret_token: env.WEBHOOK_SECRET
  });

  const cmdResult = await callTG(env, 'setMyCommands', {
    commands: [
      { command: 'start', description: '开始使用 / 显示主菜单' }
    ]
  });

  return jsonRes({
    message: 'Setup complete',
    webhook: whResult,
    commands: cmdResult,
    webhook_url: webhookUrl
  });
}

async function handleRemove(env) {
  const whResult = await callTG(env, 'deleteWebhook', {});
  const cmdResult = await callTG(env, 'deleteMyCommands', {});
  return jsonRes({ message: 'Removed', webhook: whResult, commands: cmdResult });
}

// ============================================================
// 2. Telegram Update 处理
// ============================================================

async function processUpdate(update, env) {
  try {
    if (update.message) {
      await handleMessage(update.message, env);
    } else if (update.callback_query) {
      await handleCallback(update.callback_query, env);
    }
  } catch (e) {
    console.error('processUpdate error:', e, e.stack);
  }
}

async function handleMessage(msg, env) {
  if (!msg.chat || msg.chat.type !== 'private') return;
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const text = (msg.text || '').trim();
  const msgId = msg.message_id;

  // /start 命令
  if (text === '/start') {
    await tryDelete(env, chatId, msgId);
    await clearState(env, userId);
    await addUser(env, userId);
    await sendMainMenu(env, chatId, userId);
    return;
  }

  // 检查用户状态 (是否等待输入)
  const state = await getState(env, userId);
  if (state) {
    await tryDelete(env, chatId, msgId);

    if (state.action === 'awaiting_add_url') {
      await processAddSub(env, chatId, userId, text);
    } else if (state.action === 'awaiting_edit_url') {
      await processEditSub(env, chatId, userId, text, state.subId);
    }
    return;
  }

  // 无状态时收到文字，显示主菜单
  await tryDelete(env, chatId, msgId);
  await sendMainMenu(env, chatId, userId);
}

async function handleCallback(cb, env) {
  const chatId = cb.message.chat.id;
  const userId = String(cb.from.id);
  const data = cb.data || '';
  const cbId = cb.id;

  // 先应答 callback，避免 loading 状态
  await callTG(env, 'answerCallbackQuery', { callback_query_id: cbId });

  // 处理前清除任何等待状态
  if (!data.startsWith('confirm_del:')) {
    await clearState(env, userId);
  }

  if (data === 'main') {
    await sendMainMenu(env, chatId, userId);
  } else if (data === 'manage') {
    await showSubList(env, chatId, userId);
  } else if (data === 'add') {
    await promptAdd(env, chatId, userId);
  } else if (data.startsWith('sub:')) {
    const subId = data.substring(4);
    await showSubDetail(env, chatId, userId, subId);
  } else if (data.startsWith('edit:')) {
    const subId = data.substring(5);
    await promptEdit(env, chatId, userId, subId);
  } else if (data.startsWith('del:')) {
    const subId = data.substring(4);
    await confirmDelete(env, chatId, userId, subId);
  } else if (data.startsWith('confirm_del:')) {
    const subId = data.substring(12);
    await doDelete(env, chatId, userId, subId);
  } else if (data === 'cancel_del') {
    // 从确认删除返回列表
    await showSubList(env, chatId, userId);
  } else if (data === 'cancel') {
    await clearState(env, userId);
    await showSubList(env, chatId, userId);
  }
}

// ============================================================
// 3. Bot UI 界面
// ============================================================

async function sendMainMenu(env, chatId, userId) {
  const text =
    `🤖 <b>RSS 订阅推送机器人</b>\n\n` +
    `欢迎使用！本机器人可以帮助您：\n\n` +
    `📡 订阅 RSS / Atom 源\n` +
    `🔔 有新内容时自动推送\n` +
    `⏱ 默认每 5 分钟检查更新\n` +
    `🎛️ 通过按钮轻松管理订阅\n\n` +
    `点击下方按钮开始管理您的订阅：`;

  const kb = {
    inline_keyboard: [
      [{ text: '📋 订阅管理', callback_data: 'manage' }]
    ]
  };

  await updateBotMsg(env, chatId, userId, text, kb);
}

async function showSubList(env, chatId, userId) {
  const subs = await getSubs(env, userId);
  let text;
  const buttons = [];

  if (subs.length === 0) {
    text = `📋 <b>订阅列表</b>\n\n` +
      `<i>暂无订阅</i>\n\n` +
      `点击下方按钮添加您的第一个 RSS 订阅：`;
  } else {
    text = `📋 <b>订阅列表</b>（共 ${subs.length} 个）\n\n` +
      subs.map((s, i) => `${i + 1}. ${escHtml(s.title)}`).join('\n') +
      `\n\n点击订阅名称查看详情：`;

    for (const s of subs) {
      buttons.push([{
        text: `📰 ${s.title}`,
        callback_data: `sub:${s.id}`
      }]);
    }
  }

  buttons.push([{ text: '➕ 添加订阅', callback_data: 'add' }]);
  buttons.push([{ text: '🔙 返回主菜单', callback_data: 'main' }]);

  await updateBotMsg(env, chatId, userId, text, { inline_keyboard: buttons });
}

async function showSubDetail(env, chatId, userId, subId) {
  const subs = await getSubs(env, userId);
  const sub = subs.find(s => s.id === subId);

  if (!sub) {
    await showSubList(env, chatId, userId);
    return;
  }

  const addedDate = sub.addedAt ? new Date(sub.addedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '未知';
  const lastCheck = sub.lastCheck ? new Date(sub.lastCheck).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '尚未检查';

  const text =
    `📰 <b>订阅详情</b>\n\n` +
    `<b>标题：</b>${escHtml(sub.title)}\n` +
    `<b>URL：</b><code>${escHtml(sub.url)}</code>\n` +
    `<b>添加时间：</b>${addedDate}\n` +
    `<b>上次检查：</b>${lastCheck}`;

  const kb = {
    inline_keyboard: [
      [
        { text: '✏️ 编辑 URL', callback_data: `edit:${subId}` },
        { text: '🗑️ 删除', callback_data: `del:${subId}` }
      ],
      [{ text: '🔙 返回列表', callback_data: 'manage' }]
    ]
  };

  await updateBotMsg(env, chatId, userId, text, kb);
}

async function promptAdd(env, chatId, userId) {
  await setState(env, userId, { action: 'awaiting_add_url' });

  const text =
    `➕ <b>添加订阅</b>\n\n` +
    `请发送 RSS / Atom 订阅链接：\n\n` +
    `<i>例如：https://example.com/feed.xml</i>`;

  const kb = {
    inline_keyboard: [
      [{ text: '❌ 取消', callback_data: 'cancel' }]
    ]
  };

  await updateBotMsg(env, chatId, userId, text, kb);
}

async function promptEdit(env, chatId, userId, subId) {
  const subs = await getSubs(env, userId);
  const sub = subs.find(s => s.id === subId);
  if (!sub) {
    await showSubList(env, chatId, userId);
    return;
  }

  await setState(env, userId, { action: 'awaiting_edit_url', subId });

  const text =
    `✏️ <b>编辑订阅</b>\n\n` +
    `当前 URL：<code>${escHtml(sub.url)}</code>\n\n` +
    `请发送新的 RSS / Atom 订阅链接：`;

  const kb = {
    inline_keyboard: [
      [{ text: '❌ 取消', callback_data: `sub:${subId}` }]
    ]
  };

  await updateBotMsg(env, chatId, userId, text, kb);
}

async function confirmDelete(env, chatId, userId, subId) {
  const subs = await getSubs(env, userId);
  const sub = subs.find(s => s.id === subId);
  if (!sub) {
    await showSubList(env, chatId, userId);
    return;
  }

  const text =
    `🗑️ <b>确认删除</b>\n\n` +
    `确定要删除以下订阅吗？\n\n` +
    `📰 <b>${escHtml(sub.title)}</b>\n` +
    `<code>${escHtml(sub.url)}</code>`;

  const kb = {
    inline_keyboard: [
      [
        { text: '✅ 确认删除', callback_data: `confirm_del:${subId}` },
        { text: '❌ 取消', callback_data: 'cancel_del' }
      ]
    ]
  };

  await updateBotMsg(env, chatId, userId, text, kb);
}

// ============================================================
// 4. 订阅管理逻辑
// ============================================================

async function processAddSub(env, chatId, userId, url) {
  if (!isValidUrl(url)) {
    const text =
      `❌ <b>无效的 URL</b>\n\n` +
      `请发送一个有效的 RSS / Atom 链接：\n\n` +
      `<i>例如：https://example.com/feed.xml</i>`;

    const kb = { inline_keyboard: [[{ text: '❌ 取消', callback_data: 'cancel' }]] };
    await updateBotMsg(env, chatId, userId, text, kb);
    return;
  }

  // 验证 Feed
  const loadingText = `⏳ <b>正在验证订阅源...</b>\n\n<code>${escHtml(url)}</code>`;
  await updateBotMsg(env, chatId, userId, loadingText, { inline_keyboard: [] });

  let feed;
  try {
    feed = await fetchAndParseFeed(url);
  } catch (e) {
    const text =
      `❌ <b>无法获取订阅源</b>\n\n` +
      `URL：<code>${escHtml(url)}</code>\n` +
      `错误：${escHtml(e.message)}\n\n` +
      `请检查链接是否正确，然后重新发送：`;

    const kb = { inline_keyboard: [[{ text: '❌ 取消', callback_data: 'cancel' }]] };
    await updateBotMsg(env, chatId, userId, text, kb);
    return;
  }

  // 检查是否已订阅
  const subs = await getSubs(env, userId);
  if (subs.find(s => s.url === url)) {
    await clearState(env, userId);
    const text = `⚠️ <b>已存在相同订阅</b>\n\n该 URL 已在您的订阅列表中。`;
    const kb = { inline_keyboard: [[{ text: '🔙 返回列表', callback_data: 'manage' }]] };
    await updateBotMsg(env, chatId, userId, text, kb);
    return;
  }

  // 添加订阅
  const newSub = {
    id: genId(),
    url: url,
    title: feed.title || url,
    addedAt: Date.now(),
    lastCheck: null
  };

  subs.push(newSub);
  await setSubs(env, userId, subs);
  await clearState(env, userId);

  // 存储当前 feed 项目为已读，避免推送历史内容
  if (feed.items.length > 0) {
    const seenIds = feed.items.map(item => item.guid || item.link).filter(Boolean).slice(0, 100);
    await env.RSS_KV.put(`seen:${userId}:${newSub.id}`, JSON.stringify(seenIds));
  }

  const text =
    `✅ <b>订阅添加成功！</b>\n\n` +
    `📰 <b>${escHtml(newSub.title)}</b>\n` +
    `🔗 <code>${escHtml(url)}</code>\n` +
    `📝 当前共 ${feed.items.length} 篇文章\n\n` +
    `新内容将自动推送给您。`;

  const kb = {
    inline_keyboard: [
      [{ text: '📋 查看订阅列表', callback_data: 'manage' }],
      [{ text: '➕ 继续添加', callback_data: 'add' }],
      [{ text: '🔙 返回主菜单', callback_data: 'main' }]
    ]
  };

  await updateBotMsg(env, chatId, userId, text, kb);
}

async function processEditSub(env, chatId, userId, url, subId) {
  if (!isValidUrl(url)) {
    const text =
      `❌ <b>无效的 URL</b>\n\n请发送一个有效的 RSS / Atom 链接：`;
    const kb = { inline_keyboard: [[{ text: '❌ 取消', callback_data: `sub:${subId}` }]] };
    await updateBotMsg(env, chatId, userId, text, kb);
    return;
  }

  const loadingText = `⏳ <b>正在验证订阅源...</b>\n\n<code>${escHtml(url)}</code>`;
  await updateBotMsg(env, chatId, userId, loadingText, { inline_keyboard: [] });

  let feed;
  try {
    feed = await fetchAndParseFeed(url);
  } catch (e) {
    const text =
      `❌ <b>无法获取订阅源</b>\n\n` +
      `错误：${escHtml(e.message)}\n\n请重新发送：`;
    const kb = { inline_keyboard: [[{ text: '❌ 取消', callback_data: `sub:${subId}` }]] };
    await updateBotMsg(env, chatId, userId, text, kb);
    return;
  }

  const subs = await getSubs(env, userId);
  const idx = subs.findIndex(s => s.id === subId);
  if (idx === -1) {
    await clearState(env, userId);
    await showSubList(env, chatId, userId);
    return;
  }

  subs[idx].url = url;
  subs[idx].title = feed.title || url;
  subs[idx].lastCheck = null;
  await setSubs(env, userId, subs);
  await clearState(env, userId);

  // 重置已读列表
  if (feed.items.length > 0) {
    const seenIds = feed.items.map(item => item.guid || item.link).filter(Boolean).slice(0, 100);
    await env.RSS_KV.put(`seen:${userId}:${subId}`, JSON.stringify(seenIds));
  }

  const text =
    `✅ <b>订阅已更新！</b>\n\n` +
    `📰 <b>${escHtml(subs[idx].title)}</b>\n` +
    `🔗 <code>${escHtml(url)}</code>`;

  const kb = {
    inline_keyboard: [
      [{ text: '📰 查看详情', callback_data: `sub:${subId}` }],
      [{ text: '🔙 返回列表', callback_data: 'manage' }]
    ]
  };

  await updateBotMsg(env, chatId, userId, text, kb);
}

async function doDelete(env, chatId, userId, subId) {
  const subs = await getSubs(env, userId);
  const idx = subs.findIndex(s => s.id === subId);

  if (idx !== -1) {
    subs.splice(idx, 1);
    await setSubs(env, userId, subs);
    // 清理已读记录
    try { await env.RSS_KV.delete(`seen:${userId}:${subId}`); } catch (e) {}
  }

  await clearState(env, userId);

  const text = `✅ <b>订阅已删除</b>`;
  const kb = {
    inline_keyboard: [
      [{ text: '📋 返回列表', callback_data: 'manage' }]
    ]
  };
  await updateBotMsg(env, chatId, userId, text, kb);

  // 延迟一下后显示列表
  await sleep(500);
  await showSubList(env, chatId, userId);
}

// ============================================================
// 5. RSS Feed 抓取与检查
// ============================================================

async function checkAllFeeds(env) {
  let users;
  try {
    const raw = await env.RSS_KV.get('all_users');
    users = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to get users:', e);
    return;
  }

  for (const userId of users) {
    try {
      await checkUserFeeds(env, userId);
    } catch (e) {
      console.error(`Error checking feeds for user ${userId}:`, e);
    }
  }
}

async function checkUserFeeds(env, userId) {
  const subs = await getSubs(env, userId);
  if (subs.length === 0) return;

  let updated = false;

  for (const sub of subs) {
    try {
      const feed = await fetchAndParseFeed(sub.url);

      // 获取已读 ID 列表
      const seenRaw = await env.RSS_KV.get(`seen:${userId}:${sub.id}`);
      const seenIds = seenRaw ? JSON.parse(seenRaw) : [];
      const seenSet = new Set(seenIds);

      // 找到新条目
      const newItems = feed.items.filter(item => {
        const id = item.guid || item.link;
        return id && !seenSet.has(id);
      });

      // 限制每次最多推送 5 条
      const toSend = newItems.slice(0, 5);

      for (const item of toSend) {
        await sendFeedItem(env, userId, sub, item);
        await sleep(300); // 避免发送太快
      }

      // 更新已读列表
      if (newItems.length > 0) {
        const allNewIds = newItems.map(item => item.guid || item.link).filter(Boolean);
        const updatedSeen = [...allNewIds, ...seenIds].slice(0, 200);
        await env.RSS_KV.put(`seen:${userId}:${sub.id}`, JSON.stringify(updatedSeen));
      }

      // 更新最后检查时间
      sub.lastCheck = Date.now();
      if (feed.title && feed.title !== sub.title) {
        sub.title = feed.title;
      }
      updated = true;
    } catch (e) {
      console.error(`Error fetching feed ${sub.url} for user ${userId}:`, e);
    }
  }

  if (updated) {
    await setSubs(env, userId, subs);
  }
}

async function sendFeedItem(env, chatId, sub, item) {
  const title = item.title || '无标题';
  const link = item.link || '';
  // 先解码 HTML 实体，再去除 HTML 标签，再解码一次（处理双重编码）
  const rawDesc = item.description || '';
  const decoded = decodeEntities(rawDesc);
  const stripped = stripHtml(decoded);
  const cleanDesc = decodeEntities(stripped);
  const truncDesc = cleanDesc ? truncate(cleanDesc, 300) : '';

  let text = `📢 <b>${escHtml(sub.title)}</b>\n\n`;
  text += `<b>${escHtml(title)}</b>\n`;
  if (truncDesc) {
    text += `\n${escHtml(truncDesc)}\n`;
  }
  if (link) {
    text += `\n🔗 <a href="${escHtml(link)}">阅读原文</a>`;
  }

  const kb = link ? {
    inline_keyboard: [
      [{ text: '🔗 阅读原文', url: link }]
    ]
  } : undefined;

  try {
    await callTG(env, 'sendMessage', {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
      reply_markup: kb ? JSON.stringify(kb) : undefined
    });
  } catch (e) {
    console.error('Failed to send feed item:', e);
  }
}

async function fetchAndParseFeed(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSSBot/1.0)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
      },
      signal: controller.signal,
      redirect: 'follow'
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();

    if (!xml || xml.trim().length === 0) {
      throw new Error('空响应');
    }

    return parseFeed(xml);
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      throw new Error('请求超时 (15s)');
    }
    throw e;
  }
}

function parseFeed(xml) {
  const items = [];
  let feedTitle = '';

  const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);

  if (isAtom) {
    // Atom 格式
    feedTitle = extractTag(xml, 'title');
    const entryBlocks = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];

    for (const block of entryBlocks) {
      const linkMatch = block.match(/<link[^>]*href\s*=\s*["']([^"']*?)["'][^>]*\/?>/i);
      const altLink = block.match(/<link[^>]*rel\s*=\s*["']alternate["'][^>]*href\s*=\s*["']([^"']*?)["']/i);
      const hrefLink = block.match(/<link[^>]*href\s*=\s*["']([^"']*?)["'][^>]*rel\s*=\s*["']alternate["']/i);

      items.push({
        title: extractTag(block, 'title') || 'Untitled',
        link: altLink?.[1] || hrefLink?.[1] || linkMatch?.[1] || '',
        description: extractTag(block, 'summary') || extractTag(block, 'content') || '',
        guid: extractTag(block, 'id') || altLink?.[1] || linkMatch?.[1] || '',
        pubDate: extractTag(block, 'updated') || extractTag(block, 'published') || ''
      });
    }
  } else {
    // RSS 2.0 / RSS 1.0 / RDF
    // 获取 channel 标题 (避免匹配到 item 内的 title)
    const channelMatch = xml.match(/<channel[\s>][\s\S]*?(?=<item[\s>]|$)/i);
    if (channelMatch) {
      feedTitle = extractTag(channelMatch[0], 'title');
    }
    if (!feedTitle) {
      feedTitle = extractTag(xml, 'title');
    }

    const itemBlocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];

    for (const block of itemBlocks) {
      items.push({
        title: extractTag(block, 'title') || 'Untitled',
        link: extractTag(block, 'link') || '',
        description: extractTag(block, 'description') || extractTag(block, 'content:encoded') || '',
        guid: extractTag(block, 'guid') || extractTag(block, 'link') || '',
        pubDate: extractTag(block, 'pubDate') || extractTag(block, 'dc:date') || ''
      });
    }
  }

  if (items.length === 0) {
    throw new Error('未找到任何订阅条目，请确认 URL 是否为有效的 RSS/Atom 源');
  }

  return {
    title: decodeEntities(feedTitle) || 'Unknown Feed',
    items: items.map(item => ({
      ...item,
      title: decodeEntities(item.title),
      link: decodeEntities(item.link),
      description: item.description,
      guid: decodeEntities(item.guid)
    }))
  };
}

function extractTag(xml, tagName) {
  // 处理带命名空间的标签 (如 content:encoded)
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    `<${escapedTag}[^>]*>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*|([\\s\\S]*?))\\s*<\\/${escapedTag}>`,
    'i'
  );
  const match = xml.match(regex);
  if (!match) return '';
  return (match[1] !== undefined ? match[1] : match[2] || '').trim();
}

// ============================================================
// 6. Telegram API 工具
// ============================================================

async function callTG(env, method, params) {
  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return await res.json();
  } catch (e) {
    console.error(`TG API error [${method}]:`, e);
    return { ok: false, error: e.message };
  }
}

async function sendMsg(env, chatId, text, replyMarkup) {
  const params = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    disable_web_page_preview: true
  };
  if (replyMarkup) {
    params.reply_markup = JSON.stringify(replyMarkup);
  }
  return await callTG(env, 'sendMessage', params);
}

async function editMsg(env, chatId, msgId, text, replyMarkup) {
  const params = {
    chat_id: chatId,
    message_id: msgId,
    text: text,
    parse_mode: 'HTML',
    disable_web_page_preview: true
  };
  if (replyMarkup) {
    params.reply_markup = JSON.stringify(replyMarkup);
  }
  return await callTG(env, 'editMessageText', params);
}

async function tryDelete(env, chatId, msgId) {
  try {
    await callTG(env, 'deleteMessage', { chat_id: chatId, message_id: msgId });
  } catch (e) { /* ignore */ }
}

async function updateBotMsg(env, chatId, userId, text, kb) {
  const storedMsgId = await getBotMsgId(env, userId);

  if (storedMsgId) {
    const result = await editMsg(env, chatId, storedMsgId, text, kb);
    if (result && result.ok) return;
    // 编辑失败，可能消息被删除了，发送新消息
  }

  const result = await sendMsg(env, chatId, text, kb);
  if (result && result.ok && result.result) {
    await setBotMsgId(env, userId, result.result.message_id);
  }
}

// ============================================================
// 7. KV 存储工具
// ============================================================

async function getSubs(env, userId) {
  try {
    const raw = await env.RSS_KV.get(`subs:${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

async function setSubs(env, userId, subs) {
  await env.RSS_KV.put(`subs:${userId}`, JSON.stringify(subs));
}

async function getState(env, userId) {
  try {
    const raw = await env.RSS_KV.get(`state:${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

async function setState(env, userId, state) {
  await env.RSS_KV.put(`state:${userId}`, JSON.stringify(state), { expirationTtl: 300 });
}

async function clearState(env, userId) {
  try {
    await env.RSS_KV.delete(`state:${userId}`);
  } catch (e) { /* ignore */ }
}

async function getBotMsgId(env, userId) {
  try {
    const raw = await env.RSS_KV.get(`botmsg:${userId}`);
    return raw ? parseInt(raw) : null;
  } catch (e) {
    return null;
  }
}

async function setBotMsgId(env, userId, msgId) {
  await env.RSS_KV.put(`botmsg:${userId}`, String(msgId));
}

async function addUser(env, userId) {
  try {
    const raw = await env.RSS_KV.get('all_users');
    const users = raw ? JSON.parse(raw) : [];
    if (!users.includes(userId)) {
      users.push(userId);
      await env.RSS_KV.put('all_users', JSON.stringify(users));
    }
  } catch (e) {
    await env.RSS_KV.put('all_users', JSON.stringify([userId]));
  }
}

// ============================================================
// 8. 工具函数
// ============================================================

function genId() {
  return Math.random().toString(36).substring(2, 10);
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodeEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function stripHtml(str) {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(str, maxLen = 200) {
  if (!str || str.length <= maxLen) return str;
  return str.substring(0, maxLen) + '...';
}

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function jsonRes(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
