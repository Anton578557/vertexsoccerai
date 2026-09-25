'use strict';

const { boundedFetch: fetch } = require('./analysis-budget');

const inflight = new Map();
const memoryCache = new Map();
const MEMORY_MAX_ENTRIES = 1500;
const MEMORY_MAX_TTL_MS = 60 * 1000;

function config() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SECRET_KEY || '').trim();
  return url && key ? { url, key } : null;
}

function headers(key, extra = {}) {
  return {
    apikey: key,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...extra
  };
}

function trimMemoryCache(now = Date.now()) {
  if (memoryCache.size <= MEMORY_MAX_ENTRIES) return;
  for (const [key, entry] of memoryCache.entries()) {
    if (!entry || Number(entry.expiresAt || 0) <= now) memoryCache.delete(key);
  }
  if (memoryCache.size <= MEMORY_MAX_ENTRIES) return;
  const excess = memoryCache.size - MEMORY_MAX_ENTRIES;
  let removed = 0;
  for (const key of memoryCache.keys()) {
    memoryCache.delete(key);
    removed += 1;
    if (removed >= excess) break;
  }
}

function readMemoryCache(cacheKey) {
  const entry = memoryCache.get(cacheKey);
  if (!entry) return null;
  if (Number(entry.expiresAt || 0) <= Date.now()) {
    memoryCache.delete(cacheKey);
    return null;
  }
  return entry.payload ?? null;
}

function writeMemoryCache(cacheKey, payload, ttlMs) {
  if (!cacheKey || payload == null) return;
  const safeTtl = Math.max(1000, Math.min(Number(ttlMs) || MEMORY_MAX_TTL_MS, MEMORY_MAX_TTL_MS));
  memoryCache.set(cacheKey, { payload, expiresAt: Date.now() + safeTtl });
  trimMemoryCache();
}

async function readCacheEntry(cacheKey, { allowExpired = false, maxStaleSeconds = 0 } = {}) {
  const cfg = config();
  if (!cfg || !cacheKey) return null;
  try {
    const url = new URL(`${cfg.url}/rest/v1/provider_cache`);
    url.searchParams.set('cache_key', `eq.${cacheKey}`);
    url.searchParams.set('select', 'payload,expires_at,updated_at');
    url.searchParams.set('limit', '1');
    const response = await fetch(url, { headers: headers(cfg.key), signal: AbortSignal.timeout(2000) });
    if (!response.ok) return null;
    const rows = await response.json().catch(() => []);
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row || row.payload == null) return null;

    const expiresAt = new Date(row.expires_at || 0).getTime();
    const now = Date.now();
    const fresh = Number.isFinite(expiresAt) && expiresAt > now;
    if (fresh) {
      writeMemoryCache(cacheKey, row.payload, expiresAt - now);
      return { payload: row.payload, stale: false, expiresAt: row.expires_at || null };
    }
    if (!allowExpired) return null;

    const maxStaleMs = Math.max(0, Number(maxStaleSeconds) || 0) * 1000;
    if (!maxStaleMs || !Number.isFinite(expiresAt) || now - expiresAt > maxStaleMs) return null;
    return { payload: row.payload, stale: true, expiresAt: row.expires_at || null };
  } catch (_) {
    return null;
  }
}

async function getProviderCache(cacheKey) {
  const memory = readMemoryCache(cacheKey);
  if (memory != null) return memory;
  const entry = await readCacheEntry(cacheKey);
  return entry?.payload ?? null;
}

async function getStaleProviderCache(cacheKey, maxStaleSeconds = 0) {
  const entry = await readCacheEntry(cacheKey, { allowExpired: true, maxStaleSeconds });
  return entry?.stale ? entry.payload : null;
}

async function setProviderCache(cacheKey, provider, payload, ttlSeconds = 3600) {
  if (!cacheKey || payload == null) return false;
  const safeTtlSeconds = Math.max(15, Number(ttlSeconds) || 3600);
  writeMemoryCache(cacheKey, payload, safeTtlSeconds * 1000);

  const cfg = config();
  if (!cfg) return true;
  try {
    const expiresAt = new Date(Date.now() + safeTtlSeconds * 1000).toISOString();
    const url = new URL(`${cfg.url}/rest/v1/provider_cache`);
    url.searchParams.set('on_conflict', 'cache_key');
    const response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(2000),
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

async function recentNewsArchive() {
  const cfg=config();
  if(!cfg) return [];
  // Reuse public article metadata already fetched. Never read user analyses.
  const {payload}=await cachedProviderCall({cacheKey:'news:archive:v1',provider:'News archive',ttlSeconds:600,loader:async()=>{
    const url=new URL(`${cfg.url}/rest/v1/provider_cache`);
    url.searchParams.set('provider','in.(NewsAPI,"Football news")');
    url.searchParams.set('payload->items','not.eq.[]');
    url.searchParams.set('updated_at',`gte.${new Date(Date.now()-14*864e5).toISOString()}`);
    url.searchParams.set('select','payload,updated_at');url.searchParams.set('order','updated_at.desc');url.searchParams.set('limit','100');
    const response=await fetch(url,{headers:headers(cfg.key),signal:AbortSignal.timeout(1800)});
    if(!response.ok) return [];
    const rows=await response.json();
    return Array.isArray(rows)?rows.flatMap(row=>(row.payload?.items || []).map(item=>({...item,cachedAt:row.updated_at}))).slice(0,600):[];
  }});
  return payload || [];
}

module.exports = { getProviderCache, getStaleProviderCache, setProviderCache, cachedProviderCall, recentNewsArchive };
