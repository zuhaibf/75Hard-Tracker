// lib/telegram.js
// Minimal Telegram Bot API wrapper.

const BASE = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

async function call(method, body) {
  const res = await fetch(`${BASE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export function sendMessage(chatId, text, extra = {}) {
  return call('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    ...extra,
  });
}

export function sendMarkdown(chatId, text, extra = {}) {
  return call('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'MarkdownV2',
    ...extra,
  });
}

/** Convenience: send a message with a single "Open App" button */
export function sendWithAppButton(chatId, text, appUrl) {
  return sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [[
        { text: '📱 Open App', url: appUrl },
      ]],
    },
  });
}

/** Register the webhook URL with Telegram (call once during setup) */
export async function setWebhook(webhookUrl) {
  return call('setWebhook', { url: webhookUrl });
}
