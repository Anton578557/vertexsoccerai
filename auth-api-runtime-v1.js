'use strict';

(() => {
  if (window.__vertexAuthApiRuntimeV1) return;
  window.__vertexAuthApiRuntimeV1 = true;

  const SUPABASE_URL = 'https://bznjdzgtiddggcdhxadj.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_kWwttoQARBmC6H_NqsEL_A_A5I7wDON';
  const PROTECTED = new Set(['/api/analyze', '/api/upcoming', '/api/live', '/api/strategy']);

  let client = null;
  let accessToken = null;
  let readyPromise = null;

  function initClient() {
    if (client) return client;
    if (!window.supabase?.createClient) return null;
    try {
      client = window.__vertexSupabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      window.__vertexApiAuthClient = client;
      window.__vertexSupabaseClient = client;
      readyPromise = client.auth.getSession()
        .then(({ data }) => { accessToken = data?.session?.access_token || null; })
        .catch(() => { accessToken = null; });
      client.auth.onAuthStateChange((_event, session) => {
        accessToken = session?.access_token || null;
      });
      return client;
    } catch (_) {
      return null;
    }
  }

  async function token() {
    initClient();
    if (readyPromise) {
      await Promise.race([
        readyPromise,
        new Promise((resolve) => setTimeout(resolve, 1200))
      ]);
    }
    return accessToken;
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    try {
      const rawUrl = typeof input === 'string' ? input : input?.url || '';
      const url = new URL(rawUrl, window.location.origin);
      if (url.origin === window.location.origin && PROTECTED.has(url.pathname)) {
        const bearer = await token();
        if (bearer) {
          const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
          if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${bearer}`);
          init = { ...init, headers };
        }
      }
    } catch (_) {}
    return nativeFetch(input, init);
  };

  initClient();
})();
