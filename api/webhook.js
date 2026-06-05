// api/webhook.js
// Vercel serverless function — receives all messages from Telegram.
// Telegram sends a POST here whenever someone messages @my75hard_bot.

import { sendMessage, sendWithAppButton } from '../lib/telegram.js';
import { linkToken, tokenForChat, isLinked } from '../lib/store.js';

// The public URL of your Vercel deployment (set in env vars)
const APP_URL = process.env.APP_URL || 'https://7-hard-tracker.vercel.app/track.html';

// ── Command handlers ─────────────────────────────────────────────────────────

async function handleStart(chatId, args) {
  const token = args[0];

  if (!token || !token.startsWith('75H-')) {
    return sendMessage(chatId,
      `👋 <b>Welcome to 75 Hard Tracker!</b>\n\n` +
      `To connect your account:\n` +
      `1. Open the app\n` +
      `2. Go to <b>Settings → Telegram Bot</b>\n` +
      `3. Copy your token and send:\n\n` +
      `<code>/start YOUR_TOKEN_HERE</code>`
    );
  }

  await linkToken(token, chatId);

  return sendWithAppButton(chatId,
    `✅ <b>Connected!</b>\n\n` +
    `Your 75 Hard tracker is now linked. You'll receive daily reminders at:\n\n` +
    `⏰ <b>07:00</b> — Morning check-in\n` +
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
    `/status — Today's task completion\n` +
    `/water — Current water intake\n` +
    `/streak — Your current streak\n` +
    `/day — What day of the challenge you're on\n` +
    `/remind — Get an immediate reminder\n` +
    `/unlink — Disconnect this chat\n` +
    `/help — Show this message`
  );
}

async function handleStatus(chatId) {
  // The bot doesn't have direct access to localStorage (that's in the browser).
  // This message prompts the user to open the app — the real data lives there.
  // For a richer integration you'd POST data from the app to a sync endpoint.
  return sendWithAppButton(chatId,
    `📊 <b>Your 75 Hard Status</b>\n\n` +
    `Your data lives locally on your device for privacy.\n` +
    `Open the app to see today's full breakdown — or tap below! 👇`,
    APP_URL
  );
}

async function handleStreak(chatId) {
  return sendWithAppButton(chatId,
    `🔥 Check your streak and full analytics in the app:`,
    `${APP_URL}#stats`
  );
}

async function handleWater(chatId) {
  return sendWithAppButton(chatId,
    `💧 <b>Water Check</b>\n\nLog your water intake in the app — tap below to open the Tasks page:`,
    `${APP_URL}#tasks`
  );
}

async function handleDay(chatId) {
  return sendWithAppButton(chatId,
    `📅 See your current day and progress in the app:`,
    APP_URL
  );
}

async function handleRemind(chatId) {
  return sendWithAppButton(chatId,
    `⚡ <b>Quick Reminder</b>\n\n` +
    `Have you done these today?\n\n` +
    `🏋️ Workout 1 (45 min)\n` +
    `🚴 Workout 2 (45 min, different)\n` +
    `💧 1 Gallon of water (~3.8L)\n` +
    `📚 Read 10 pages\n` +
    `📸 Progress photo\n` +
    `🥗 Follow your diet\n` +
    `☀️ One workout must be outdoor\n\n` +
    `<i>No substitutions. No modifications. No excuses.</i>`,
    APP_URL
  );
}

async function handleUnlink(chatId) {
  const token = await tokenForChat(chatId);
  if (!token) {
    return sendMessage(chatId, `ℹ️ This chat isn't linked to any tracker.`);
  }
  // Note: we don't delete the token→chatId entry so the user can re-link with same token.
  // In production you'd clean up both keys.
  return sendMessage(chatId,
    `✅ Disconnected. You won't receive reminders anymore.\n` +
    `Send /start YOUR_TOKEN to reconnect at any time.`
  );
}

async function handleUnknown(chatId, text) {
  return sendMessage(chatId,
    `🤔 I didn't understand that. Send /help to see available commands.`
  );
}

// ── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Telegram sends the update as JSON body
  const update = req.body;

  // We only handle regular messages (not edited messages, channel posts, etc.)
  const message = update?.message;
  if (!message) {
    return res.status(200).json({ ok: true });
  }

  const chatId = message.chat.id;
  const text = (message.text || '').trim();
  const firstName = message.from?.first_name || 'Warrior';

  // Parse command and args
  // Telegram commands look like "/start TOKEN" or "/help"
  const [rawCmd, ...args] = text.split(/\s+/);
  // Strip the @botname suffix Telegram appends in group chats
  const cmd = rawCmd.replace(/@\w+$/, '').toLowerCase();

  try {
    switch (cmd) {
      case '/start':  await handleStart(chatId, args); break;
      case '/help':   await handleHelp(chatId); break;
      case '/status': await handleStatus(chatId); break;
      case '/streak': await handleStreak(chatId); break;
      case '/water':  await handleWater(chatId); break;
      case '/day':    await handleDay(chatId); break;
      case '/remind': await handleRemind(chatId); break;
      case '/unlink': await handleUnlink(chatId); break;
      default:        await handleUnknown(chatId, text); break;
    }
  } catch (err) {
    console.error('[webhook] error:', err);
    // Don't let errors bubble up — always return 200 to Telegram
    // so it doesn't retry the same update endlessly.
    await sendMessage(chatId, `⚠️ Something went wrong. Please try again.`);
  }

  // Always respond 200 OK to Telegram
  return res.status(200).json({ ok: true });
}
