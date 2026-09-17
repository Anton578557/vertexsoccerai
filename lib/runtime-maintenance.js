'use strict';

function config() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SECRET_KEY || '').trim();
  return url && key ? { url, key } : null;
}

async function cleanupRuntimeData() {
  const cfg = config();
  if (!cfg) return { ran: false, providerCacheDeleted: 0, rateLimitDeleted: 0 };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${cfg.url}/rest/v1/rpc/vertex_cleanup_runtime_data`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        apikey: cfg.key,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: '{}'
    });
    if (!response.ok) return { ran: false, providerCacheDeleted: 0, rateLimitDeleted: 0 };
    const rows = await response.json().catch(() => []);
    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
      ran: true,
      providerCacheDeleted: Number(row?.provider_cache_deleted || 0),
      rateLimitDeleted: Number(row?.rate_limit_deleted || 0)
    };
  } catch (_) {
    return { ran: false, providerCacheDeleted: 0, rateLimitDeleted: 0 };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { cleanupRuntimeData };
