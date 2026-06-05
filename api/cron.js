// api/cron.js
// Vercel Cron Job — sends scheduled reminders to all linked users.
// Configured in vercel.json to run at 07:00, 12:00, 18:00, 21:00 IST (UTC+5:30).
// IST offsets: 07:00 IST = 01:30 UTC, 12:00 IST = 06:30 UTC,
//              18:00 IST = 12:30 UTC, 21:00 IST = 15:30 UTC

import { kv } from '@vercel/kv';
import { sendWithAppButton, sendMessage } from '../lib/telegram.js';

const APP_URL = process.env.APP_URL || 'https://7-hard-tracker.vercel.app/track.html';

// Returns which reminder slot we're in based on UTC hour
function reminderType(utcHour) {
  // 01:30 UTC → morning (07:00 IST)
  // 06:30 UTC → midday  (12:00 IST)
  // 12:30 UTC → evening (18:00 IST)
  // 15:30 UTC → night   (21:00 IST)
  if (utcHour === 1)  return 'morning';
  if (utcHour === 6)  return 'midday';
  if (utcHour === 12) return 'evening';
  if (utcHour === 15) return 'night';
  return null;
}

const MESSAGES = {
  morning: {
    text: `🌅 <b>Good morning, Warrior!</b>\n\nDay starts now. Remember:\n📸 Take your progress photo early\n🥗 Commit to your diet from the first meal\n💧 Start hydrating — 3.8L to go\n\n<i>"The only easy day was yesterday."</i>`,
  },
  midday: {
    text: `💧 <b>Midday Water Check</b>\n\nYou should be at least halfway to your 1-gallon goal by now.\n\nAlso — have you done Workout 1 yet? If not, now's a great window. ⏰`,
  },
  evening: {
    text: `☀️ <b>Outdoor Workout Check</b>\n\nReminder: <b>one of your two workouts must be outdoors.</b>\n\nIf you haven't done your outdoor session yet, golden hour is perfect. 🌇`,
  },
  night: {
    text: `📋 <b>Evening Wrap-up</b>\n\nOnly a few hours left in the day. Quick checklist:\n\n🏋️ Both workouts done?\n💧 Water goal hit?\n📚 10 pages read?\n📸 Progress photo taken?\n🥗 Diet followed all day?\n☀️ Outdoor workout done?\n\n<i>Don't stop when you're tired. Stop when you're done.</i>`,
  },
};

export default async function handler(req, res) {
  // Protect the endpoint — Vercel sets CRON_SECRET automatically
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const utcHour = new Date().getUTCHours();
  const type = reminderType(utcHour);

  if (!type) {
    console.log(`[cron] No reminder for UTC hour ${utcHour}`);
    return res.status(200).json({ ok: true, skipped: true });
  }

  const { text } = MESSAGES[type];

  // Scan all linked chatIds from KV
  // Keys are stored as "chat:<chatId>"
  let cursor = 0;
  let sent = 0;
  let failed = 0;

  do {
    const [nextCursor, keys] = await kv.scan(cursor, { match: 'chat:*', count: 100 });
    cursor = nextCursor;

    for (const key of keys) {
      const chatId = key.replace('chat:', '');
      try {
        await sendWithAppButton(chatId, text, APP_URL);
        sent++;
      } catch (err) {
        console.error(`[cron] Failed to send to ${chatId}:`, err.message);
        failed++;
      }
    }
  } while (cursor !== 0);

  console.log(`[cron] ${type} reminders — sent: ${sent}, failed: ${failed}`);
  return res.status(200).json({ ok: true, type, sent, failed });
}
