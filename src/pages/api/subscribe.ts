import type { APIRoute } from 'astro';
import { addSubscriber } from '../../lib/db';

const SUBSCRIBE_LIMIT = 5; // max 5 subscriptions per IP per hour
const WINDOW_SECONDS = 3600;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as { runtime: { env: { DB: D1Database; MAILER_CONFIRM_URL?: string; CONFIRM_SECRET?: string } } }).runtime.env;
  const db = env.DB;

  // Rate limit by IP
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const windowKey = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
  const rateLimitKey = `rl:sub:${ip}:${windowKey}`;

  try {
    const row = await db.prepare("SELECT count FROM rate_limits WHERE key = ?").bind(rateLimitKey).first<{ count: number }>();
    if (row && row.count >= SUBSCRIBE_LIMIT) {
      return new Response(JSON.stringify({ error: 'Cok fazla istek gonderdiniz. Lutfen daha sonra tekrar deneyin.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': String(WINDOW_SECONDS) },
      });
    }
    await db.prepare(
      `INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, datetime('now', '+${WINDOW_SECONDS} seconds'))
       ON CONFLICT(key) DO UPDATE SET count = count + 1`
    ).bind(rateLimitKey).run();
  } catch {
    // Rate limiter failure should not block legitimate requests
  }

  const contentType = request.headers.get('content-type') ?? '';
  let email = '';

  if (contentType.includes('application/json')) {
    const body = await request.json();
    email = (body as { email?: string }).email ?? '';
  } else {
    const formData = await request.formData();
    email = formData.get('email')?.toString() ?? '';
  }

  email = email.trim().toLowerCase();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return new Response(JSON.stringify({ error: 'Gecerli bir email adresi girin.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await addSubscriber(db, email, ip);

  if (result.status === 'error') {
    return new Response(JSON.stringify({ error: 'Abonelik kaydedilemedi, lutfen tekrar deneyin.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  // 'already' returns the SAME generic response as 'confirm' below, so the
  // endpoint never reveals whether an address is already a confirmed subscriber
  // (no email enumeration). Only 'confirm' actually triggers a send.
  // status === 'confirm' -> ask the mailer to send the confirmation email
  if (env.MAILER_CONFIRM_URL && env.CONFIRM_SECRET && result.confirmToken) {
    try {
      await fetch(`${env.MAILER_CONFIRM_URL}/send-confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.CONFIRM_SECRET}` },
        body: JSON.stringify({ email, confirmToken: result.confirmToken }),
      });
    } catch {
      // Confirmation email is best-effort; token is stored so it can be re-sent.
    }
  }

  return new Response(JSON.stringify({ success: true, message: 'Onay maili gonderdik, lutfen e-posta kutunu kontrol et.' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
