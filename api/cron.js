// api/cron.js
// Called every hour by cron-job.org.
// Sends built-in reminders at fixed IST hours, plus any custom reminders due now.

import { createClient } from '@supabase/supabase-js';
import { getAllChatIds } from '../lib/store.js';
import { sendWithAppButton } from '../lib/telegram.js';

const APP_URL = process.env.APP_URL || 'https://75-hard-tracker-one.vercel.app/track.html';

function getClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// IST = UTC + 5:30
function utcToISTHour(utcHour, utcMin) {
  return Math.floor((utcHour * 60 + utcMin + 330) / 60) % 24;
}

const BUILTIN = {
  7: `🌅 <b>Good morning, Warrior!</b>\n\nDay starts now. Remember:\n📸 Take your progress photo early\n🥗 Commit to your diet from the first meal\n💧 Start hydrating — 4L to go\n\n<i>"The only easy day was yesterday."</i>`,
  12: `💧 <b>Midday Water Check</b>\n\nYou should be at least halfway to your 4L goal by now.\n\nAlso — have you done Workout 1 yet? If not, now's a great window. ⏰`,
  18: `☀️ <b>Outdoor Workout Check</b>\n\nReminder: <b>Workout 2 must be outdoors.</b>\n\nIf you haven't done it yet, golden hour is perfect. 🌇`,
  21: `📋 <b>Evening Wrap-up</b>\n\nOnly a few hours left. Quick checklist:\n\n🏋️ Both workouts done?\n💧 Water goal hit?\n📚 10 pages read?\n📸 Progress photo taken?\n🥗 Diet followed all day?\n☀️ Outdoor workout done?\n\n<i>Don't stop when you're tired. Stop when you're done.</i>`,
};

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = new Date();
  const istHour = utcToISTHour(now.getUTCHours(), now.getUTCMinutes());
  const supabase = getClient();
  let sent = 0, failed = 0;

  // 1. Built-in reminders — broadcast to all active users
  const builtinText = BUILTIN[istHour];
  if (builtinText) {
    const chatIds = await getAllChatIds();
    for (const chatId of chatIds) {
      try {
        await sendWithAppButton(chatId, builtinText, APP_URL);
        sent++;
      } catch (err) {
        console.error(`[cron] builtin failed for ${chatId}:`, err.message);
        failed++;
      }
    }
  }

  // 2. Custom reminders — query only rows due this IST hour
  const { data: customs, error } = await supabase
    .from('reminders')
    .select('chat_id, label')
    .eq('hour_ist', istHour)
    .eq('enabled', true);

  if (error) {
    console.error('[cron] custom reminders query failed:', error.message);
  } else {
    for (const r of customs) {
      const msg = `🔔 <b>${r.label}</b>\n\n<i>Your custom 75 Hard reminder.</i>`;
      try {
        await sendWithAppButton(r.chat_id, msg, APP_URL);
        sent++;
      } catch (err) {
        console.error(`[cron] custom failed for ${r.chat_id}:`, err.message);
        failed++;
      }
    }
  }

  console.log(`[cron] IST ${istHour}:00 — sent: ${sent}, failed: ${failed}`);
  return res.status(200).json({ ok: true, istHour, sent, failed });
}
