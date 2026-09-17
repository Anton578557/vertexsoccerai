'use strict';

const localBuckets = new Map();

function supabaseConfig() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SECRET_KEY || '').trim();
  return url && key ? { url, key } : null;
}

function localConsume(subject, scope, windowSeconds, limit) {
  const now = Date.now();
  const windowMs = Math.max(1, Number(windowSeconds) || 60) * 1000;
  const bucketStart = Math.floor(now / windowMs) * windowMs;
  const key = `${subject}:${scope}:${bucketStart}`;
  const next = (localBuckets.get(key) || 0) + 1;
  localBuckets.set(key, next);

  if (localBuckets.size > 5000) {
    for (const existing of localBuckets.keys()) {
      const parts = existing.split(':');
      const start = Number(parts[parts.length - 1]);
      if (!Number.isFinite(start) || start + windowMs * 2 < now) localBuckets.delete(existing);
    }
  }

  return {
    allowed: next <= limit,
    remaining: Math.max(limit - next, 0),
    resetAt: new Date(bucketStart + windowMs).toISOString(),
    source: 'local-fallback'
  };
}

async function consumeRateLimit(subject, scope, { windowSeconds = 3600, limit = 30 } = {}) {
  const safeSubject = String(subject || '').trim().slice(0, 180) || 'anonymous';
  const safeScope = String(scope || '').trim().slice(0, 80) || 'default';
  const safeWindow = Math.max(1, Math.floor(Number(windowSeconds) || 3600));
  const safeLimit = Math.max(1, Math.floor(Number(limit) || 30));
  const cfg = supabaseConfig();

  if (!cfg) return localConsume(safeSubject, safeScope, safeWindow, safeLimit);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(`${cfg.url}/rest/v1/rpc/vertex_consume_rate_limit`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        apikey: cfg.key,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_subject: safeSubject,
        p_scope: safeScope,
        p_window_seconds: safeWindow,
        p_limit: safeLimit
      })
    });

    if (!response.ok) return localConsume(safeSubject, safeScope, safeWindow, safeLimit);
    const rows = await response.json().catch(() => []);
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row || typeof row.allowed !== 'boolean') return localConsume(safeSubject, safeScope, safeWindow, safeLimit);

    return {
      allowed: row.allowed,
      remaining: Number(row.remaining ?? 0),
      resetAt: row.reset_at || null,
      source: 'supabase'
    };
  } catch (_) {
    return localConsume(safeSubject, safeScope, safeWindow, safeLimit);
  } finally {
    clearTimeout(timer);
  }
}

async function enforceRateLimit(req, res, user, scope, options) {
  const subject = user?.id || String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'anonymous').split(',')[0].trim();
  const result = await consumeRateLimit(subject, scope, options);
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, Number(result.remaining || 0))));
  if (result.resetAt) res.setHeader('X-RateLimit-Reset', String(result.resetAt));
  if (result.allowed) return true;

  res.setHeader('Retry-After', '60');
  res.status(429).json({
    error: 'Too many requests. Please try again shortly.',
    code: 'RATE_LIMITED',
    resetAt: result.resetAt || null
  });
  return false;
}

module.exports = { consumeRateLimit, enforceRateLimit };
