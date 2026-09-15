'use strict';

const crypto = require('crypto');
const { getProviderCache, setProviderCache } = require('../lib/provider-cache');

function clean(value, max) {
  return String(value || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim()) && String(value || '').length <= 180;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function rateKey(req, email) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  const input = `${ip}|${String(email || '').toLowerCase()}`;
  return `contact-rate:${crypto.createHash('sha256').update(input).digest('hex').slice(0, 32)}`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const resendKey = String(process.env.RESEND_API_KEY || '').trim();
  const fromEmail = clean(process.env.RESEND_FROM_EMAIL, 180);
  const inbox = clean(process.env.RESEND_REPLY_TO_EMAIL, 180);
  if (!resendKey || !fromEmail || !inbox) return res.status(503).json({ error: 'Email service is not configured.' });

  const name = clean(req.body?.name, 100);
  const email = clean(req.body?.email, 180);
  const message = clean(req.body?.message, 3000);
  if (!name || !validEmail(email) || message.length < 5) return res.status(400).json({ error: 'Enter a valid name, email and message.' });

  const key = rateKey(req, email);
  if (await getProviderCache(key)) return res.status(429).json({ error: 'Please wait before sending another message.' });

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        from: `Vertex Soccer AI <${fromEmail}>`,
        to: [inbox],
        reply_to: email,
        subject: `Vertex Soccer AI · Contact · ${name}`,
        text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.55"><h2>Vertex Soccer AI contact</h2><p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Message:</strong></p><p>${escapeHtml(message).replace(/\n/g, '<br>')}</p></div>`
      })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      console.error('contact resend', response.status, payload?.message || payload?.name || 'send_failed');
      return res.status(502).json({ error: 'Message delivery failed. Please try again later.' });
    }

    await setProviderCache(key, 'Contact Rate Limit', { sentAt: new Date().toISOString() }, 10 * 60);
    return res.status(200).json({ ok: true, id: payload?.id || null });
  } catch (error) {
    console.error('contact', error?.message || error);
    return res.status(502).json({ error: 'Message delivery failed. Please try again later.' });
  }
};
