// lib/store.js
// Thin wrapper around Vercel KV (Redis).
// Keys:
//   token:<token>   → chatId  (string)
//   chat:<chatId>   → token   (string, reverse lookup)

import { kv } from '@vercel/kv';

export async function linkToken(token, chatId) {
  await kv.set(`token:${token}`, String(chatId));
  await kv.set(`chat:${chatId}`, token);
}

export async function chatIdForToken(token) {
  return kv.get(`token:${token}`);
}

export async function tokenForChat(chatId) {
  return kv.get(`chat:${chatId}`);
}

export async function isLinked(chatId) {
  const t = await tokenForChat(chatId);
  return !!t;
}
