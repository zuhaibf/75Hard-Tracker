// api/reminders.js
// GET  /api/reminders?token=75H-XXXX  → fetch custom reminders for this token
// POST /api/reminders?token=75H-XXXX  → replace all custom reminders for this token

import { chatIdForToken } from '../lib/store.js';
import { createClient } from '@supabase/supabase-js';

function getClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export default async function handler(req, res) {
  const { token } = req.query;
  if (!token || !token.startsWith('75H-')) {
    return res.status(400).json({ error: 'Missing or invalid token' });
  }

  const chatId = await chatIdForToken(token);
  if (!chatId) {
    return res.status(404).json({ error: 'Token not linked to any chat' });
  }

  const supabase = getClient();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('reminders')
      .select('id, label, hour_ist, enabled')
      .eq('chat_id', chatId)
      .order('hour_ist');
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ reminders: data });
  }

  if (req.method === 'POST') {
    const { reminders } = req.body || {};
    if (!Array.isArray(reminders)) {
      return res.status(400).json({ error: 'reminders must be an array' });
    }

    // Validate and clean
    const clean = reminders
      .filter(r => r && typeof r.hourIST === 'number' && r.hourIST >= 0 && r.hourIST <= 23)
      .slice(0, 10)
      .map(r => ({
        id:       String(r.id || Date.now()),
        chat_id:  chatId,
        label:    String(r.label || 'Reminder').slice(0, 60),
        hour_ist: Math.round(r.hourIST),
        enabled:  r.enabled !== false,
      }));

    // Replace all reminders for this chat — delete then insert
    const { error: delErr } = await supabase
      .from('reminders')
      .delete()
      .eq('chat_id', chatId);
    if (delErr) return res.status(500).json({ error: delErr.message });

    if (clean.length > 0) {
      const { error: insErr } = await supabase
        .from('reminders')
        .insert(clean);
      if (insErr) return res.status(500).json({ error: insErr.message });
    }

    return res.status(200).json({ ok: true, reminders: clean });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
