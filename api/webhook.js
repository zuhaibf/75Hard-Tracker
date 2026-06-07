// api/webhook.js
// Vercel serverless function — receives all Telegram messages via webhook.

import { sendMessage, sendWithAppButton } from '../lib/telegram.js';
import { linkToken, tokenForChat, unlinkChat } from '../lib/store.js';

const APP_URL = process.env.APP_URL || 'https://75-hard-tracker.vercel.app/track.html';

async function handleStart(chatId, args, firstName) {
  const token = args[0];

  if (!token || !token.startsWith('75H-')) {
    return sendMessage(chatId,
      `👋 <b>Welcome to 75 Hard Tracker!</b>\n\n` +
      `To link your account:\n` +
      `1. Open the app\n` +
      `2. Go to <b>Settings → Telegram Reminders</b>\n` +
      `3. Tap the copy button next to the <code>/start</code> command\n` +
      `4. Paste it here and send\n\n` +
      `That's it — reminders start immediately. 💪`
    );
  }

  await linkToken(token, chatId, firstName);

  return sendWithAppButton(chatId,
    `✅ <b>Connected, ${firstName}!</b>\n\n` +
    `Your 75 Hard tracker is now linked. Daily reminders:\n\n` +
    `🌅 <b>07:00</b> — Morning check-in\n` +
    `💧 <b>12:00</b> — Water check\n` +
    `☀️ <b>18:00</b> — Outdoor workout check\n` +
    `📋 <b>21:00</b> — Evening wrap-up\n\n` +
    `Send /help to see all commands.`,
    APP_URL
  );
}

async function handleHelp(chatId) {
  return sendMessage(chatId,
    `<b>75 Hard Bot Commands</b>\n\n` +
    `/status — Open today's tracker\n` +
    `/remind — Get an immediate checklist\n` +
    `/unlink — Stop reminders for this chat\n` +
    `/help — Show this message`
  );
}

async function handleStatus(chatId) {
  return sendWithAppButton(chatId,
    `📊 <b>Your 75 Hard Tracker</b>\n\nTap below to see today's tasks, water intake, streak, and stats:`,
    APP_URL
  );
}

async function handleRemind(chatId) {
  return sendWithAppButton(chatId,
    `⚡ <b>Daily Checklist</b>\n\n` +
    `Have you done all of these today?\n\n` +
    `🏋️ Workout 1 — 45 min\n` +
    `🚴 Workout 2 — 45 min (must be different)\n` +
    `☀️ One workout must be <b>outdoors</b>\n` +
    `💧 1 Gallon of water (~3.8L)\n` +
    `📚 Read 10 pages (non-fiction)\n` +
    `📸 Progress photo\n` +
    `🥗 Follow your diet — no cheat meals\n\n` +
    `<i>"No substitutions. No modifications. No excuses."</i>`,
    APP_URL
  );
}

async function handleUnlink(chatId) {
  const token = await tokenForChat(chatId);
  if (!token) {
    return sendMessage(chatId, `ℹ️ This chat isn't linked to any tracker.`);
  }
  await unlinkChat(chatId);
  return sendMessage(chatId,
    `✅ Disconnected. No more reminders.\n\n` +
    `Send <code>/start YOUR_TOKEN</code> anytime to reconnect.`
  );
}

// ── Main entry point ──────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const message = req.body?.message;
  if (!message) return res.status(200).json({ ok: true });

  const chatId = message.chat.id;
  const text = (message.text || '').trim();
  const firstName = message.from?.first_name || 'Warrior';
  const [rawCmd, ...args] = text.split(/\s+/);
  const cmd = rawCmd.replace(/@\w+$/, '').toLowerCase();

  try {
    switch (cmd) {
      case '/start':  await handleStart(chatId, args, firstName); break;
      case '/help':   await handleHelp(chatId); break;
      case '/status': await handleStatus(chatId); break;
      case '/remind': await handleRemind(chatId); break;
      case '/unlink': await handleUnlink(chatId); break;
      default: await sendMessage(chatId, `🤔 Unknown command. Send /help to see what I can do.`);
    }
  } catch (err) {
    console.error('[webhook] error:', err);
    await sendMessage(chatId, `⚠️ Something went wrong. Try again in a moment.`).catch(() => {});
  }

  return res.status(200).json({ ok: true });
}
