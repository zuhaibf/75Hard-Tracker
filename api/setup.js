// api/setup.js
// Visit this URL once after deploying to register the Telegram webhook.
// Protected by SETUP_SECRET env var.
// Usage: GET https://your-domain.vercel.app/api/setup?secret=YOUR_SETUP_SECRET

import { setWebhook } from '../lib/telegram.js';

export default async function handler(req, res) {
  const { secret } = req.query;

  if (!secret || secret !== process.env.SETUP_SECRET) {
    return res.status(401).json({ error: 'Missing or wrong secret' });
  }

  // The webhook URL is this Vercel deployment's /api/webhook endpoint
  const host = req.headers.host;
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const webhookUrl = `${protocol}://${host}/api/webhook`;

  const result = await setWebhook(webhookUrl);

  return res.status(200).json({
    webhookUrl,
    telegramResponse: result,
  });
}
