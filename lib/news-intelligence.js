'use strict';

const { cachedProviderCall } = require('./provider-cache');

function clean(value, max = 420) {
  return String(value || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalize(value) {
  return clean(value, 1000).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function cacheKeyPart(value) {
  return normalize(value).replace(/\s+/g, '-').slice(0, 80) || 'unknown';
}

function firstSentence(value, max = 190) {
  const text = clean(value, 500).replace(/\[(?:Removed|Deleted)\]/gi, '').trim();
  if (!text) return '';
  const sentence = text.match(/^(.{30,220}?[.!?])(?:\s|$)/)?.[1] || text;
  return sentence.length > max ? `${sentence.slice(0, max - 1).trim()}…` : sentence;
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function isoDate(date) { return new Date(date).toISOString().slice(0, 10); }

async function fetchJson(url, options = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`News upstream ${response.status}`);
    return response.json();
  } finally { clearTimeout(timer); }
}

function mentions(text, team) {
  const haystack = normalize(text);
  const needle = normalize(team);
  if (!haystack || !needle) return false;
  if (!(` ${haystack} `).includes(` ${needle} `)) return false;
  // Racing Club is also used for clubs outside Argentina in news headlines.
  if (needle === 'racing club') return /\b(avellaneda|argentina|argentine|argentinian|boca juniors)\b/.test(haystack);
  // Millonarios is also River Plate's nickname; do not import River team news.
  if (needle === 'millonarios' && /\b(river|huracan)\b/.test(haystack) && !/\b(bogota|colombia|colombian|millonarios fc)\b/.test(haystack)) return false;
  return true;
}

function classify(article, homeName, awayName) {
  const published = new Date(article.publishedAt || '').getTime();
  if (!Number.isFinite(published) || published > Date.now() || Date.now() - published > 14 * 864e5) return null;
  const title = clean(article.title, 220);
  const description = clean(article.description, 420);
  const body = `${title} ${description}`;
  const lower = body.toLowerCase();
  const teams = [mentions(body, homeName) ? 'home' : null, mentions(body, awayName) ? 'away' : null].filter(Boolean);
  if (!teams.length) return null;

  const transfer = /transfer|signing|signs|bid|fee|deal|linked with|target|rumou?r/.test(lower);
  const negativeStrong = /ruled out|will miss|set to miss|out for|sidelined|suspended|suspension|match ban|banned|unavailable|surgery|fracture|injured|injury/.test(lower);
  const negativeSoft = /doubt|doubtful|fitness concern|late test|late fitness test|race against time|illness|questionable|50-50/.test(lower);
  const positiveStrong = /returns? from injury|back in training|declared fit|cleared to play|available again|recovered|fit again/.test(lower);
  const lineup = /line-?up|starting xi|team news|preview|rotation|rested|availability/.test(lower);

  let impact = 0;
  let signal = 'context';
  if (!transfer && negativeStrong) { impact = -0.035; signal = 'negative'; }
  else if (!transfer && negativeSoft) { impact = -0.018; signal = 'negative'; }
  else if (!transfer && positiveStrong) { impact = 0.025; signal = 'positive'; }
  else if (lineup) signal = 'lineup';
  else if (transfer) signal = 'transfer';

  const ageHours = article.publishedAt ? Math.max(0, (Date.now() - new Date(article.publishedAt).getTime()) / 36e5) : 336;
  const recency = ageHours <= 24 ? 4 : ageHours <= 72 ? 3 : ageHours <= 168 ? 2 : 1;
  const actionable = Math.abs(impact) > 0 ? 5 : lineup ? 3 : transfer ? -3 : 1;
  const importance = actionable + recency + (mentions(title, homeName) || mentions(title, awayName) ? 2 : 0);
  const summary = firstSentence(description) || firstSentence(title);
  if (!summary) return null;

  // Keyword matching cannot attribute an injury to a team's player. Keep the
  // article as context; roster-backed availability is handled separately.
  return { title, summary, source: article.source?.name || 'News', publishedAt: article.publishedAt || null, teams, signal, impact: 0, importance };
}

async function getNewsIntelligence(homeName, awayName) {
  if (!process.env.NEWSAPI_KEY) return { items: [], impact: { home: 0, away: 0, usedSignals: 0 } };
  try {
    const pair = [cacheKeyPart(homeName), cacheKeyPart(awayName)].join(':');
    const { payload } = await cachedProviderCall({
      cacheKey: `newsapi:intelligence:v5:${pair}`,
      provider: 'NewsAPI',
      ttlSeconds: 900,
      staleSeconds: 21600,
      loader: async () => {
        const from = new Date();
        from.setDate(from.getDate() - 14);
        const q = `\"${clean(homeName, 60)}\" OR \"${clean(awayName, 60)}\"`;
        const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&searchIn=title,description&language=en&sortBy=publishedAt&pageSize=30&from=${isoDate(from)}`;
        const data = await fetchJson(url, { headers: { 'X-Api-Key': process.env.NEWSAPI_KEY } });
        const candidates = (data.articles || []).map((a) => classify(a, homeName, awayName)).filter(Boolean)
          .filter((item) => item.importance >= 3)
          .sort((a, b) => b.importance - a.importance || new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));

        const items = [];
        const seen = new Set();
        for (const item of candidates) {
          const key = normalize(item.title).slice(0, 90);
          if (!key || seen.has(key)) continue;
          seen.add(key);
          items.push(item);
          if (items.length >= 6) break;
        }

        const impact = { home: 0, away: 0, usedSignals: 0 };
        for (const item of items) {
          if (!item.impact) continue;
          impact.usedSignals += 1;
          for (const team of item.teams) impact[team] += item.impact / item.teams.length;
        }
        impact.home = clamp(impact.home, -0.08, 0.08);
        impact.away = clamp(impact.away, -0.08, 0.08);
        return { items, impact };
      }
    });
    return payload || { items: [], impact: { home: 0, away: 0, usedSignals: 0 } };
  } catch (_) {
    return { items: [], impact: { home: 0, away: 0, usedSignals: 0 } };
  }
}

module.exports = { getNewsIntelligence, classify, mentions };
