'use strict';

function config() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SECRET_KEY || '').trim();
  return url && key ? { url, key } : null;
}

function headers(key, extra = {}) {
  // New sb_secret_* keys are opaque API keys, not JWTs. Sending them as
  // Authorization: Bearer causes Invalid JWT; the apikey header maps the
  // request to service_role and bypasses RLS server-side.
  return {
    apikey: key,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...extra
  };
}

async function getProviderCache(cacheKey) {
  const cfg = config();
  if (!cfg || !cacheKey) return null;
  try {
    const url = new URL(`${cfg.url}/rest/v1/provider_cache`);
    url.searchParams.set('cache_key', `eq.${cacheKey}`);
    url.searchParams.set('expires_at', `gt.${new Date().toISOString()}`);
    url.searchParams.set('select', 'payload');
    url.searchParams.set('limit', '1');
    const response = await fetch(url, { headers: headers(cfg.key) });
    if (!response.ok) return null;
    const rows = await response.json().catch(() => []);
    return Array.isArray(rows) && rows[0]?.payload != null ? rows[0].payload : null;
  } catch (_) {
    return null;
  }
}

async function setProviderCache(cacheKey, provider, payload, ttlSeconds = 3600) {
  const cfg = config();
  if (!cfg || !cacheKey || payload == null) return false;
  try {
    const expiresAt = new Date(Date.now() + Math.max(60, Number(ttlSeconds) || 3600) * 1000).toISOString();
    const url = new URL(`${cfg.url}/rest/v1/provider_cache`);
    url.searchParams.set('on_conflict', 'cache_key');
    const response = await fetch(url, {
      method: 'POST',
      headers: headers(cfg.key, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify([{
        cache_key: String(cacheKey).slice(0, 500),
        provider: String(provider || 'unknown').slice(0, 100),
        payload,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      }])
    });
    return response.ok;
  } catch (_) {
    return false;
  }
}

async function cachedProviderCall({ cacheKey, provider, ttlSeconds, loader }) {
  const cached = await getProviderCache(cacheKey);
  if (cached != null) return { payload: cached, cacheHit: true };
  const payload = await loader();
  if (payload != null) await setProviderCache(cacheKey, provider, payload, ttlSeconds);
  return { payload, cacheHit: false };
}

module.exports = { getProviderCache, setProviderCache, cachedProviderCall };
