'use strict';

function config() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = String(process.env.SUPABASE_ANON_KEY || '').trim();
  return url && key ? { url, key } : null;
}

function bearerToken(req) {
  const header = String(req.headers?.authorization || '').trim();
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

async function getAuthenticatedUser(req) {
  const cfg = config();
  const token = bearerToken(req);
  if (!token) return null;
  if (!cfg) throw new Error('AUTH_UNAVAILABLE');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(`${cfg.url}/auth/v1/user`, {
      signal: controller.signal,
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });
    if ([401, 403].includes(response.status)) return null;
    if (!response.ok) throw new Error('AUTH_UNAVAILABLE');
    const user = await response.json().catch(() => null);
    if (!user?.id) throw new Error('AUTH_UNAVAILABLE');
    return user;
  } catch (_) {
    throw new Error('AUTH_UNAVAILABLE');
  } finally {
    clearTimeout(timer);
  }
}

async function requireUser(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const user = await getAuthenticatedUser(req);
    if (user) return user;
  } catch (_) {
    res.status(503).json({ error: 'Authentication is temporarily unavailable. Please try again.', code: 'AUTH_UNAVAILABLE' });
    return null;
  }
  res.status(401).json({ error: 'Sign in to use this Vertex feature.', code: 'AUTH_REQUIRED' });
  return null;
}

module.exports = { getAuthenticatedUser, requireUser };
