'use strict';

function config() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SECRET_KEY || '').trim();
  return url && key ? { url, key } : null;
}

function headers(key, extra = {}) {
  return {
    apikey: key,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...extra
  };
}

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
}

function fixtureKey(analysis) {
  const date = new Date(analysis?.fixture?.date || '');
  if (Number.isNaN(date.getTime())) return null;
  const home = normalize(analysis?.teams?.home?.name);
  const away = normalize(analysis?.teams?.away?.name);
  if (!home || !away) return null;
  return `${date.toISOString()}|${home}|${away}`;
}

function clampPct(value) {
  if (value == null || typeof value === 'boolean' || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
}

function selections(analysis) {
  const model = analysis?.model;
  if (!model) return [];
  const out = [];

  const oneXtwo = [
    ['HOME', clampPct(model?.oneXtwo?.home)],
    ['DRAW', clampPct(model?.oneXtwo?.draw)],
    ['AWAY', clampPct(model?.oneXtwo?.away)]
  ].filter(([, p]) => p != null).sort((a, b) => b[1] - a[1]);
  if (oneXtwo[0]) out.push({ market: '1X2', value: oneXtwo[0][0], probability: oneXtwo[0][1] });

  const over25 = clampPct(model?.over25);
  const under25 = clampPct(model?.under25);
  if (over25 != null && under25 != null) {
    out.push(over25 >= under25
      ? { market: 'GOALS_OU_2_5', value: 'OVER', probability: over25 }
      : { market: 'GOALS_OU_2_5', value: 'UNDER', probability: under25 });
  }

  const btts = clampPct(model?.btts);
  const noBtts = clampPct(model?.noBtts);
  if (btts != null && noBtts != null) {
    out.push(btts >= noBtts
      ? { market: 'BTTS', value: 'YES', probability: btts }
      : { market: 'BTTS', value: 'NO', probability: noBtts });
  }

  const dc = [
    ['1X', clampPct(model?.doubleChance?.oneX)],
    ['X2', clampPct(model?.doubleChance?.xTwo)],
    ['12', clampPct(model?.doubleChance?.oneTwo)]
  ].filter(([, p]) => p != null).sort((a, b) => b[1] - a[1]);
  if (dc[0]) out.push({ market: 'DOUBLE_CHANCE', value: dc[0][0], probability: dc[0][1] });

  return out;
}

async function recordModelEvaluations(analysis) {
  const cfg = config();
  if (!cfg || !analysis?.model || !analysis?.fixture?.date) return { recorded: 0, reason: 'not_applicable' };

  const fixtureDate = new Date(analysis.fixture.date);
  if (Number.isNaN(fixtureDate.getTime())) return { recorded: 0, reason: 'invalid_fixture_date' };
  if (fixtureDate.getTime() <= Date.now()) return { recorded: 0, reason: 'fixture_started' };

  const key = fixtureKey(analysis);
  const picks = selections(analysis);
  if (!key || !picks.length) return { recorded: 0, reason: 'no_markets' };

  const quality = clampPct(analysis.dataQuality);
  const rows = picks.map((pick) => ({
    fixture_key: key,
    fixture_date: fixtureDate.toISOString(),
    market: pick.market,
    predicted_value: pick.value,
    predicted_probability: pick.probability,
    data_quality: quality,
    actual_value: null,
    is_correct: null,
    evaluated_at: null
  }));

  try {
    const url = new URL(`${cfg.url}/rest/v1/model_evaluations`);
    url.searchParams.set('on_conflict', 'fixture_key,market');
    const response = await fetch(url, {
      method: 'POST',
      headers: headers(cfg.key, { Prefer: 'resolution=ignore-duplicates,return=representation' }),
      body: JSON.stringify(rows)
    });
    if (!response.ok) return { recorded: 0, reason: `supabase_${response.status}` };
    const inserted = await response.json();
    return { recorded: Array.isArray(inserted) ? inserted.length : 0 };
  } catch (error) {
    return { recorded: 0, reason: error?.message || 'write_failed' };
  }
}

module.exports = { recordModelEvaluations, fixtureKey };
