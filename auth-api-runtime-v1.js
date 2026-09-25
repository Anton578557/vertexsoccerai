'use strict';

(() => {
  if (window.__vertexAuthApiRuntimeV1) return;
  window.__vertexAuthApiRuntimeV1 = true;
  const SUPABASE_URL = 'https://bznjdzgtiddggcdhxadj.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_kWwttoQARBmC6H_NqsEL_A_A5I7wDON';
  const PROTECTED = new Set(['/api/analyze', '/api/upcoming', '/api/live', '/api/strategy']);
  const nativeFetch = window.fetch.bind(window);
  let client, session = null, readyPromise, refreshPromise;
  let revision = 0, accountEpoch = 0;

  function initClient() {
    if (client || !window.supabase?.createClient) return client;
    client = window.__vertexSupabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    window.__vertexApiAuthClient = window.__vertexSupabaseClient = client;
    client.auth.onAuthStateChange((event, next) => {
      // Never call the SDK here: an auth callback must not hold up its own refresh.
      if (event === 'SIGNED_OUT' || session?.user?.id !== next?.user?.id) accountEpoch++;
      revision++;
      session = next || null;
    });
    return client;
  }

  function ready() {
    if (!initClient()) return Promise.resolve({ error: { status: 503 } });
    if (!readyPromise) {
      const atRevision = revision;
      readyPromise = client.auth.getSession().then(result => {
        if (!result.error && atRevision === revision) session = result.data?.session || null;
        return result;
      }).catch(error => ({ error }));
      readyPromise.then(result => { if (result.error) readyPromise = null; });
    }
    return readyPromise;
  }

  function refresh() {
    if (!refreshPromise) {
      const epoch = accountEpoch;
      refreshPromise = client.auth.refreshSession().then(result => {
        if (epoch === accountEpoch && !result.error) session = result.data?.session || null;
        return result;
      }).catch(error => ({ error })).finally(() => { refreshPromise = null; });
    }
    return refreshPromise;
  }

  // Wait for the SDK instead of silently sending an anonymous request after 1.2s.
  function waitForAuth(promise, signal) {
    return new Promise((resolve, reject) => {
      const abort = () => { cleanup(); reject(signal.reason || new DOMException('Aborted', 'AbortError')); };
      const timer = setTimeout(() => { cleanup(); resolve({ error: { status: 503 } }); }, 12000);
      const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
      if (signal?.aborted) return abort();
      signal?.addEventListener('abort', abort, { once: true });
      promise.then(value => { cleanup(); resolve(value); }, error => { cleanup(); resolve({ error }); });
    });
  }

  function authError(error) {
    const invalid = [400, 401, 403].includes(Number(error?.status)) || error?.name === 'AuthSessionMissingError';
    return Response.json({ code: invalid ? 'AUTH_REQUIRED' : 'AUTH_UNAVAILABLE', error: invalid ? 'Sign in to continue.' : 'Authentication is temporarily unavailable. Please try again.' }, { status: invalid ? 401 : 503, headers: { 'Cache-Control': 'no-store' } });
  }

  window.fetch = async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
    if (url.origin !== window.location.origin || !PROTECTED.has(url.pathname)) return nativeFetch(input, init);
    const request = new Request(input instanceof Request ? input : url, init);
    if (request.headers.has('Authorization')) return nativeFetch(request);
    const initial = await waitForAuth(ready(), request.signal);
    if (initial.error) return authError(initial.error);
    const epoch = accountEpoch;
    if (session?.expires_at && session.expires_at * 1000 <= Date.now() + 30000) {
      const renewed = await waitForAuth(refresh(), request.signal);
      if (renewed.error) return authError(renewed.error);
    }
    if (epoch !== accountEpoch) return authError({ status: 401 });
    const token = session?.access_token;
    if (!token) return nativeFetch(request);
    const send = bearer => {
      const headers = new Headers(request.headers);
      headers.set('Authorization', `Bearer ${bearer}`);
      // Clone before every send to preserve POST bodies for one 401 retry.
      return nativeFetch(new Request(request.clone(), { headers }));
    };
    const response = await send(token);
    if (response.status !== 401 || epoch !== accountEpoch || !session) return response;
    if (session.access_token === token) {
      const renewed = await waitForAuth(refresh(), request.signal);
      if (renewed.error) return authError(renewed.error);
    }
    if (epoch !== accountEpoch || !session?.access_token) return response;
    return send(session.access_token);
  };

  initClient();
})();
