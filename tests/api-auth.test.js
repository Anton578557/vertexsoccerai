'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { requireUser } = require('../lib/api-auth');

test('API authentication distinguishes an invalid session from an unavailable identity service', async () => {
  const savedFetch = global.fetch, savedEnv = { ...process.env };
  process.env.SUPABASE_URL = 'https://auth.example.test';
  process.env.SUPABASE_ANON_KEY = 'test-key';
  const invoke = async (token = 'example-token') => {
    const res = { headers: {}, setHeader(k,v) { this.headers[k] = v; }, status(s) { this.statusCode = s; return this; }, json(body) { this.body = body; } };
    const user = await requireUser({ headers: token ? { authorization: `Bearer ${token}` } : {} }, res);
    return { user, res };
  };
  try {
    global.fetch = async () => Response.json({ id: 'verified-owner' });
    assert.equal((await invoke()).user.id, 'verified-owner');
    for (const status of [401, 403, 429, 500, 503]) {
      global.fetch = async () => new Response('{}', { status });
      const { user, res } = await invoke();
      assert.equal(user, null);
      assert.equal(res.statusCode, status === 401 || status === 403 ? 401 : 503);
      assert.equal(res.body.code, res.statusCode === 401 ? 'AUTH_REQUIRED' : 'AUTH_UNAVAILABLE');
      assert.equal(res.headers['Cache-Control'], 'private, no-store');
    }
    global.fetch = async () => { throw new Error('Network timed out'); };
    assert.equal((await invoke()).res.statusCode, 503);
    assert.equal((await invoke(null)).res.statusCode, 401);
    delete process.env.SUPABASE_ANON_KEY;
    assert.equal((await invoke()).res.statusCode, 503);
  } finally {
    global.fetch = savedFetch;
    for (const k of ['SUPABASE_URL','SUPABASE_ANON_KEY']) {
      if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k];
    }
  }
});
