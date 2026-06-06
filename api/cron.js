// api/cron.js
// Vercel Cron Job — runs every hour UTC, sends built-in + custom reminders.
// vercel.json schedule: "0 * * * *"

import { kv } from '@vercel/kv';
import { sendWithAppButton, sendMessage } from '../lib/telegram.js';

const APP_URL = process.env.APP_URL || 'https://75-hard-tracker-one.vercel.app/track.html';

// Built-in reminders keyed by IST hour
const BUILTIN = {
  7: {
    text: `🌅 <b>Good morning, Warrior!</b>\n\nDay starts now. Remember:\n📸 Take your progress photo early\n🥗 Commit to your diet from the first meal\n💧 Start hydrating — 4L to go\n\n<i>"The only easy day was yesterday."</i>`,
  },
  12: {
    text: `💧 <b>Midday Water Check</b>\n\nYou should be at least halfway to your 4L goal by now.\n\nAlso — have you done Workout 1 yet? If not, now's a great window. ⏰`,
  },
  18: {
    text: `☀️ <b>Outdoor Workout Check</b>\n\nReminder: <b>Workout 2 must be outdoors.</b>\n\nIf you haven't done it yet, golden hour is perfect. 🌇`,
  },
  21: {
    text: `📋 <b>Evening Wrap-up</b>\n\nOnly a few hours left. Quick checklist:\n\n🏋️ Both workouts done?\n💧 Water goal hit?\n📚 10 pages read?\n📸 Progress photo taken?\n🥗 Diet followed all day?\n☀️ Outdoor workout done?\n\n<i>Don't stop when you're tired. Stop when you're done.</i>`,
  },
};

// IST = UTC + 5:30, so istHour = (utcHour + 5 + floor((utcMin+30)/60)) % 24
function utcToIST(utcHour, utcMin) {
  const totalMin = utcHour * 60 + utcMin + 330; // +5:30
  return Math.floor(totalMin / 60) % 24;
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = new Date();
  const istHour = utcToIST(now.getUTCHours(), now.getUTCMinutes());

  let sent = 0, failed = 0;

  // Scan all linked chats
  let cursor = 0;
  do {
    const [nextCursor, keys] = await kv.scan(cursor, { match: 'chat:*', count: 100 });
    cursor = nextCursor;

    for (const key of keys) {
      const chatId = key.replace('chat:', '');

      // 1. Check built-in reminder for this IST hour
      const builtin = BUILTIN[istHour];
      if (builtin) {
        try {
          await sendWithAppButton(chatId, builtin.text, APP_URL);
          sent++;
        } catch (err) {
          console.error(`[cron] builtin failed for ${chatId}:`, err.message);
          failed++;
        }
      }

      // 2. Check custom reminders for this chatId
      try {
        const customs = (await kv.get(`reminders:${chatId}`)) || [];
        for (const r of customs) {
          if (r.enabled && r.hourIST === istHour) {
            const msg = `🔔 <b>${r.label}</b>\n\n<i>Custom reminder from your 75 Hard tracker.</i>`;
            try {
              await sendWithAppButton(chatId, msg, APP_URL);
              sent++;
            } catch (err) {
              console.error(`[cron] custom reminder failed for ${chatId}:`, err.message);
              failed++;
            }
          }
        }
      } catch (err) {
        console.error(`[cron] error fetching customs for ${chatId}:`, err.message);
      }
    }
  } while (cursor !== 0);

  console.log(`[cron] IST ${istHour}:00 — sent: ${sent}, failed: ${failed}`);
  return res.status(200).json({ ok: true, istHour, sent, failed });
}
