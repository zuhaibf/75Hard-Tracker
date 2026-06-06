// lib/store.js
// Supabase-backed store for token↔chatId mappings.
// Uses the Supabase JS SDK v2 with the service role key (server-side only).

import { createClient } from '@supabase/supabase-js';

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

// ── Link a tracker token to a Telegram chat ───────────────────────────────────
export async function linkToken(token, chatId, firstName = '') {
  const supabase = getClient();
  const { error } = await supabase
    .from('users')
    .upsert(
      { token, chat_id: String(chatId), first_name: firstName, linked_at: new Date().toISOString() },
      { onConflict: 'token' }
    );
  if (error) throw error;
}

// ── Look up chatId by tracker token ──────────────────────────────────────────
export async function chatIdForToken(token) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('users')
    .select('chat_id')
    .eq('token', token)
    .single();
  if (error) return null;
  return data?.chat_id ?? null;
}

// ── Look up token by chatId ───────────────────────────────────────────────────
export async function tokenForChat(chatId) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('users')
    .select('token')
    .eq('chat_id', String(chatId))
    .single();
  if (error) return null;
  return data?.token ?? null;
}

// ── Get all chatIds (used by cron to broadcast reminders) ─────────────────────
export async function getAllChatIds() {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('users')
    .select('chat_id')
    .eq('active', true);
  if (error) return [];
  return data.map(row => row.chat_id);
}

// ── Unlink a chat (soft delete — keeps the row, sets active=false) ────────────
export async function unlinkChat(chatId) {
  const supabase = getClient();
  const { error } = await supabase
    .from('users')
    .update({ active: false })
    .eq('chat_id', String(chatId));
  if (error) throw error;
}
