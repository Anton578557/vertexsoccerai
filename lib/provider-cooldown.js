'use strict';

const { getProviderCache, setProviderCache } = require('./provider-cache');

async function providerCooldown(provider) {
  const state = await getProviderCache(`provider-cooldown:v1:${provider}`);
  return state && new Date(state.retryAt).getTime() > Date.now() ? state : null;
}

async function recordProviderFailure(provider, status, message = '') {
  const suspended = /suspend/i.test(message);
  const quota = Number(status) === 429 || /quota|daily limit|request limit/i.test(message);
  const denied = [401, 403].includes(Number(status));
  if (!suspended && !quota && !denied) return null;
  const seconds = suspended ? 21600 : quota ? 3600 : 900;
  const state = { status: Number(status) || null, reason: suspended ? 'account_suspended' : quota ? 'quota_exhausted' : 'access_denied', retryAt: new Date(Date.now() + seconds * 1000).toISOString() };
  await setProviderCache(`provider-cooldown:v1:${provider}`, provider, state, seconds);
  return state;
}

module.exports = { providerCooldown, recordProviderFailure };
