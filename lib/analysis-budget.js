'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');
const scope = new AsyncLocalStorage();

// Per-request cancellation, never a process-wide timer or mutable fetch hook.
function withBudget(milliseconds, work) {
  const parent = scope.getStore();
  const deadline = Math.min(parent?.deadline ?? Infinity, Date.now() + milliseconds);
  return scope.run({ deadline }, work);
}

function remaining() { return Math.max(0, (scope.getStore()?.deadline ?? Infinity) - Date.now()); }

function boundedFetch(url, options = {}) {
  const left = remaining();
  if (left <= 0) return Promise.reject(new Error('analysis_time_budget'));
  const signal = Number.isFinite(left) ? AbortSignal.timeout(Math.max(1, Math.floor(left))) : null;
  return globalThis.fetch(url, { ...options, ...(signal ? { signal: options.signal ? AbortSignal.any([options.signal, signal]) : signal } : {}) });
}

async function stage(analysis, name, milliseconds, loader) {
  const start = Date.now();
  if (remaining() < 350) {
    analysis.collection ||= [];
    analysis.collection.push({ stage: name, status: 'time_budget', ms: 0 });
    return analysis;
  }
  // A late provider cannot mutate the returned report after its stage times out.
  const isolated = structuredClone(analysis);
  let timer;
  try {
    const wait = Math.max(1, Math.min(milliseconds, remaining()));
    const result = await withBudget(Math.max(1, wait - 150), () => Promise.race([
      Promise.resolve().then(() => loader(isolated)),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('analysis_time_budget')), wait); })
    ]));
    const next = result || isolated;
    next.collection ||= [];
    next.collection.push({ stage: name, status: 'completed', ms: Date.now() - start });
    return next;
  } catch (error) {
    analysis.collection ||= [];
    analysis.collection.push({ stage: name, status: /time_budget|timeout|abort/i.test(error?.message || '') ? 'time_budget' : 'unavailable', ms: Date.now() - start });
    return analysis;
  } finally { clearTimeout(timer); }
}

module.exports = { withBudget, remaining, boundedFetch, stage };
