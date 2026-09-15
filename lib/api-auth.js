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
  if (!cfg || !token) return null;

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
    if (!response.ok) return null;
    const user = await response.json().catch(() => null);
    return user?.id ? user : null;
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function requireUser(req, res) {
  const user = await getAuthenticatedUser(req);
  if (user) return user;
  res.status(401).json({ error: 'Sign in to use this Vertex feature.', code: 'AUTH_REQUIRED' });
  return null;
}

module.exports = { getAuthenticatedUser, requireUser };
