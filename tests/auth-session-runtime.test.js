'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const tick = () => new Promise(setImmediate);
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const session = (token = 'old', extra = {}) => ({ access_token: token, user: { id: 'owner' }, ...extra });
const result = value => ({ data: { session: value } });
function runtime({ initial = session(), getSession, refreshSession, respond = () => 200, timers = {} } = {}) {
  let notify, creates = 0, refreshes = 0;
  const calls = [];
  const client = { auth: {
    getSession: getSession || (async () => result(initial)),
    refreshSession: async () => { refreshes++; return refreshSession ? refreshSession() : result(session('new')); },
    onAuthStateChange: cb => { notify = cb; }
  }};
  const window = { location: { origin: 'https://vertex.test' }, supabase: { createClient: () => { creates++; return client; } },
    fetch: async (input, init) => {
      const req = input instanceof Request ? input : new Request(new URL(input, 'https://vertex.test'), init);
      req.signal.throwIfAborted();
      const call = { url: req.url, headers: req.headers, body: await req.text(), method: req.method };
      calls.push(call);
      return new Response('{}', { status: await respond(call, calls.length) });
    }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../auth-api-runtime-v1'), 'utf8'), { window, URL, Headers, Request, Response, DOMException, setTimeout, clearTimeout, ...timers });
  return { window, client, calls, notify: (...args) => notify(...args), get creates() { return creates; }, get refreshes() { return refreshes; } };
}

test('one shared client follows refreshed sessions and never leaks tokens to other origins', async () => {
  const r = runtime();
  assert.equal(r.window.__vertexSupabaseClient, r.client);
  assert.equal(r.window.__vertexApiAuthClient, r.client);
  await r.window.fetch('/api/strategy');
  assert.equal(r.calls[0].headers.get('Authorization'), 'Bearer old');
  r.notify('TOKEN_REFRESHED', session('new'));
  await r.window.fetch('/api/analyze');
  assert.equal(r.calls[1].headers.get('Authorization'), 'Bearer new');
  await r.window.fetch('https://other.test/api/strategy');
  assert.equal(r.calls[2].headers.get('Authorization'), null);
  r.notify('SIGNED_OUT', null);
  await r.window.fetch('/api/strategy');
  assert.equal(r.calls[3].headers.get('Authorization'), null);
  assert.equal(r.creates, 1);
});

test('slow initial session restoration never falls back to an anonymous analysis request', async () => {
  const pending = deferred();
  const r = runtime({ getSession: () => pending.promise, timers: { setTimeout: (fn, ms) => setTimeout(fn, ms <= 1200 ? 0 : ms) } });
  const request = r.window.fetch('/api/analyze');
  await tick(); await tick();
  assert.equal(r.calls.length, 0);
  pending.resolve(result(session()));
  await request;
  assert.equal(r.calls[0].headers.get('Authorization'), 'Bearer old');
});

test('concurrent 401 responses share one refresh and preserve Request POST bodies and headers', async () => {
  const pending = deferred();
  const r = runtime({ refreshSession: () => pending.promise, respond: call => call.headers.get('Authorization') === 'Bearer old' ? 401 : 200 });
  const request = new Request('https://vertex.test/api/strategy', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Client': 'strategy' }, body: '{"action":"save"}' });
  const one = r.window.fetch(request);
  const two = r.window.fetch('/api/analyze');
  while (r.calls.length < 2 || !r.refreshes) await tick();
  pending.resolve(result(session('new')));
  assert.deepEqual((await Promise.all([one, two])).map(x => x.status), [200, 200]);
  assert.equal(r.refreshes, 1);
  const posts = r.calls.filter(x => x.method === 'POST');
  assert.equal(posts.length, 2);
  assert.equal(posts[0].body, posts[1].body);
  assert.equal(posts[1].headers.get('X-Client'), 'strategy');
});

test('expiry refreshes before the first request, while 403 and explicit caller tokens are not retried', async () => {
  const expiring = runtime({ initial: session('old', { expires_at: Date.now() / 1000 - 1 }) });
  await expiring.window.fetch('/api/strategy');
  assert.equal(expiring.calls[0].headers.get('Authorization'), 'Bearer new');
  assert.equal(expiring.calls.length, 1);
  const forbidden = runtime({ respond: () => 403 });
  assert.equal((await forbidden.window.fetch('/api/analyze')).status, 403);
  assert.equal(forbidden.refreshes, 0);
  const explicit = runtime({ respond: () => 401 });
  await explicit.window.fetch('/api/analyze', { headers: { Authorization: 'Bearer caller' } });
  assert.equal(explicit.calls[0].headers.get('Authorization'), 'Bearer caller');
  assert.equal(explicit.refreshes, 0);
});

test('a failed refresh is reported honestly and a second 401 is never retried again', async () => {
  for (const [status, expectedCode] of [[503, 'AUTH_UNAVAILABLE'], [400, 'AUTH_REQUIRED']]) {
    const r = runtime({ respond: () => 401, refreshSession: async () => ({ error: { status } }) });
    const response = await r.window.fetch('/api/analyze');
    assert.equal((await response.json()).code, expectedCode);
    assert.equal(r.calls.length, 1);
  }
  const r = runtime({ respond: () => 401 });
  assert.equal((await r.window.fetch('/api/analyze')).status, 401);
  assert.equal(r.calls.length, 2);
  assert.equal(r.refreshes, 1);
});

test('sign-out and switching users while refresh is pending cannot replay the old operation', async () => {
  for (const change of [null, session('other', { user: { id: 'other-owner' } })]) {
    const pending = deferred();
    const r = runtime({ respond: () => 401, refreshSession: () => pending.promise });
    const request = r.window.fetch('/api/strategy', { method: 'POST', body: '{"action":"save"}' });
    while (!r.refreshes) await tick();
    r.notify(change ? 'SIGNED_IN' : 'SIGNED_OUT', change);
    pending.resolve(result(session('new')));
    assert.equal((await request).status, 401);
    assert.equal(r.calls.length, 1);
  }
});

test('cancellation while restoring a session sends no request', async () => {
  const pending = deferred();
  const r = runtime({ getSession: () => pending.promise });
  const controller = new AbortController();
  const request = r.window.fetch('/api/analyze', { signal: controller.signal });
  controller.abort();
  await assert.rejects(request, { name: 'AbortError' });
  pending.resolve(result(session()));
  await tick();
  assert.equal(r.calls.length, 0);
});
