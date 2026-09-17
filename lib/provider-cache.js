'use strict';

const inflight = new Map();

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

async function readCacheEntry(cacheKey, { allowExpired = false, maxStaleSeconds = 0 } = {}) {
  const cfg = config();
  if (!cfg || !cacheKey) return null;
  try {
    const url = new URL(`${cfg.url}/rest/v1/provider_cache`);
    url.searchParams.set('cache_key', `eq.${cacheKey}`);
    url.searchParams.set('select', 'payload,expires_at,updated_at');
    url.searchParams.set('limit', '1');
    const response = await fetch(url, { headers: headers(cfg.key) });
    if (!response.ok) return null;
    const rows = await response.json().catch(() => []);
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row || row.payload == null) return null;

    const expiresAt = new Date(row.expires_at || 0).getTime();
    const now = Date.now();
    const fresh = Number.isFinite(expiresAt) && expiresAt > now;
    if (fresh) return { payload: row.payload, stale: false, expiresAt: row.expires_at || null };
    if (!allowExpired) return null;

    const maxStaleMs = Math.max(0, Number(maxStaleSeconds) || 0) * 1000;
    if (!maxStaleMs || !Number.isFinite(expiresAt) || now - expiresAt > maxStaleMs) return null;
    return { payload: row.payload, stale: true, expiresAt: row.expires_at || null };
  } catch (_) {
    return null;
  }
}

async function getProviderCache(cacheKey) {
  const entry = await readCacheEntry(cacheKey);
  return entry?.payload ?? null;
}

async function getStaleProviderCache(cacheKey, maxStaleSeconds = 0) {
  const entry = await readCacheEntry(cacheKey, { allowExpired: true, maxStaleSeconds });
  return entry?.stale ? entry.payload : null;
}

async function setProviderCache(cacheKey, provider, payload, ttlSeconds = 3600) {
  const cfg = config();
  if (!cfg || !cacheKey || payload == null) return false;
  try {
    const expiresAt = new Date(Date.now() + Math.max(15, Number(ttlSeconds) || 3600) * 1000).toISOString();
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

async function cachedProviderCall({ cacheKey, provider, ttlSeconds, staleSeconds = 0, loader }) {
  const cached = await getProviderCache(cacheKey);
  if (cached != null) return { payload: cached, cacheHit: true, staleHit: false, shared: false };

  if (inflight.has(cacheKey)) {
    const result = await inflight.get(cacheKey);
    return { ...result, shared: true };
  }

  const work = (async () => {
    try {
      const payload = await loader();
      if (payload != null) {
        await setProviderCache(cacheKey, provider, payload, ttlSeconds);
        return { payload, cacheHit: false, staleHit: false, shared: false };
      }

      const stale = staleSeconds > 0 ? await getStaleProviderCache(cacheKey, staleSeconds) : null;
      if (stale != null) return { payload: stale, cacheHit: true, staleHit: true, shared: false };
      return { payload: null, cacheHit: false, staleHit: false, shared: false };
    } catch (error) {
      const stale = staleSeconds > 0 ? await getStaleProviderCache(cacheKey, staleSeconds) : null;
      if (stale != null) return { payload: stale, cacheHit: true, staleHit: true, shared: false };
      throw error;
    } finally {
      inflight.delete(cacheKey);
    }
  })();

  inflight.set(cacheKey, work);
  return work;
}

module.exports = { getProviderCache, getStaleProviderCache, setProviderCache, cachedProviderCall };
