// api/reminders.js
// GET  /api/reminders?token=75H-XXXX        → fetch custom reminders for this token's chatId
// POST /api/reminders?token=75H-XXXX        → save custom reminders array
// DELETE /api/reminders?token=75H-XXXX&id=X → delete one reminder

import { kv } from '@vercel/kv';

// Resolve token → chatId (same pattern as store.js linkToken)
async function chatIdForToken(token) {
  return kv.get(`token:${token}`);
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

  const key = `reminders:${chatId}`;

  if (req.method === 'GET') {
    const reminders = (await kv.get(key)) || [];
    return res.status(200).json({ reminders });
  }

  if (req.method === 'POST') {
    // Body: { reminders: [{ id, label, hourIST, enabled }] }
    const { reminders } = req.body || {};
    if (!Array.isArray(reminders)) {
      return res.status(400).json({ error: 'reminders must be an array' });
    }
    // Validate each entry
    const clean = reminders
      .filter(r => r && typeof r.hourIST === 'number' && r.hourIST >= 0 && r.hourIST <= 23)
      .map(r => ({
        id:      String(r.id || Date.now()),
        label:   String(r.label || 'Reminder').slice(0, 60),
        hourIST: Math.round(r.hourIST),
        enabled: r.enabled !== false,
      }))
      .slice(0, 10); // max 10 custom reminders

    await kv.set(key, clean);
    return res.status(200).json({ ok: true, reminders: clean });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
