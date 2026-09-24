'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('strategy and analysis requests use one shared client and follow refreshed/logout sessions', async () => {
  let creates = 0, notify;
  const calls = [];
  const client = { auth: {
    getSession: async () => ({data:{session:{access_token:'session-one'}}}),
    onAuthStateChange: callback => { notify = callback; }
  }};
  const window = {location:{origin:'https://vertex.test'},supabase:{createClient:()=>{creates++;return client;}},fetch:async (url,options)=>{calls.push({url,options});return {ok:true};}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../auth-api-runtime-v1'),'utf8'), {window,URL,Headers,Request,setTimeout:callback=>{queueMicrotask(callback);}});
  assert.equal(creates,1);
  assert.equal(window.__vertexSupabaseClient,client);
  assert.equal(window.__vertexApiAuthClient,client);
  await window.fetch('/api/strategy');
  assert.equal(calls[0].options.headers.get('Authorization'),'Bearer session-one');
  notify('TOKEN_REFRESHED',{access_token:'session-two'});
  await window.fetch('/api/analyze');
  assert.equal(calls[1].options.headers.get('Authorization'),'Bearer session-two');
  await window.fetch('https://other.test/api/strategy');
  assert.equal(calls[2].options.headers,undefined);
  notify('SIGNED_OUT',null);
  await window.fetch('/api/strategy');
  assert.equal(calls[3].options.headers,undefined);
  assert.equal(creates,1);
});
