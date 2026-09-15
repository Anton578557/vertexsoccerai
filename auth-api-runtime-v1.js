'use strict';

(() => {
  if (window.__vertexAuthApiRuntimeV1) return;
  window.__vertexAuthApiRuntimeV1 = true;

  const SUPABASE_URL = 'https://bznjdzgtiddggcdhxadj.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_kWwttoQARBmC6H_NqsEL_A_A5I7wDON';
  const PROTECTED = new Set(['/api/analyze', '/api/live', '/api/upcoming']);
  let client = null;

  function getClient() {
    if (client) return client;
    if (!window.supabase?.createClient) return null;
    try {
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      return client;
    } catch (_) {
      return null;
    }
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    try {
      const rawUrl = typeof input === 'string' ? input : input?.url || '';
      const url = new URL(rawUrl, window.location.origin);
      if (url.origin === window.location.origin && PROTECTED.has(url.pathname)) {
        const supabaseClient = getClient();
        const { data } = supabaseClient ? await supabaseClient.auth.getSession() : { data: null };
        const token = data?.session?.access_token;
        if (token) {
          const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
          if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
          init = { ...init, headers };
        }
      }
    } catch (_) {}
    return nativeFetch(input, init);
  };
})();
