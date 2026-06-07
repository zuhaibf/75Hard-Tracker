// api/photos.js
// POST /api/photos?token=75H-XXXX  → upload a photo, returns { url }
// DELETE /api/photos?token=75H-XXXX&path=photos/75H-XXXX/...  → delete a photo

import { createClient } from '@supabase/supabase-js';
import { chatIdForToken } from '../lib/store.js';

const BUCKET = 'photos';

function getClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export default async function handler(req, res) {
  const { token, path: filePath } = req.query;

  if (!token || !token.startsWith('75H-')) {
    return res.status(400).json({ error: 'Missing or invalid token' });
  }

  // Verify token exists (don't need chatId, just confirming it's a real token)
  const chatId = await chatIdForToken(token);
  if (!chatId) {
    return res.status(404).json({ error: 'Token not linked to any chat' });
  }

  const supabase = getClient();

  // ── DELETE ─────────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    if (!filePath || !filePath.startsWith(`photos/${token}/`)) {
      return res.status(400).json({ error: 'Invalid or missing file path' });
    }
    // Strip the leading "photos/" since remove() takes paths relative to bucket root
    const objectPath = filePath.replace(/^photos\//, '');
    const { error } = await supabase.storage.from(BUCKET).remove([objectPath]);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  // ── POST (upload) ──────────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Expect: { date: "2025-01-15", imageData: "<base64 string>", mimeType: "image/jpeg" }
  const { date, imageData, mimeType = 'image/jpeg' } = req.body || {};

  if (!date || !imageData) {
    return res.status(400).json({ error: 'Missing date or imageData' });
  }

  // Convert base64 to buffer
  const buffer = Buffer.from(imageData, 'base64');

  // Safety check: reject anything over 5MB (client should compress, but belt-and-suspenders)
  if (buffer.length > 5 * 1024 * 1024) {
    return res.status(413).json({ error: 'Image too large (max 5MB after compression)' });
  }

  const timestamp = Date.now();
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  // Path is scoped to the token so one user can't overwrite another's photos
  const objectPath = `${token}/${date}_${timestamp}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, buffer, {
      contentType: mimeType,
      cacheControl: '31536000', // 1 year — photos never change
      upsert: false,
    });

  if (uploadError) {
    console.error('[photos] upload error:', uploadError.message);
    return res.status(500).json({ error: uploadError.message });
  }

  // Return the public URL (bucket must be public — see setup instructions below)
  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(objectPath);

  return res.status(200).json({ url: publicUrl, path: `photos/${objectPath}` });
}
