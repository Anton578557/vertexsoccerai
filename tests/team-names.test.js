'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const aliases = require('../lib/team-aliases');

test('Russian names from the reported matches resolve to provider names', () => {
  const cases = [
    ['Ноттингем Форест', 'Nottingham Forest'],
    ['Ковентри Сити', 'Coventry City'],
    ['Хавелсе', 'Havelse'],
    ['Фортуна Кёльн', 'Fortuna Koln'],
    ['Фортуна Кельн', 'Fortuna Koln'],
    ['  ФК Ковентри Сити  ', 'Coventry City'],
    ['Ноттингэм Форест', 'Nottingham Forest']
  ];
  for (const [input, expected] of cases) {
    assert.equal(aliases.resolveTeamName(input), expected);
    assert.equal(aliases.searchQuery(input), expected);
  }
});

test('old transliterated entries and Latin names resolve to the same club', () => {
  for (const [input, expected] of [
    ['Koventri Siti', 'Coventry City'], ['Khavelse', 'Havelse'],
    ['Fortuna Kyoln', 'Fortuna Koln'], ['Fortuna Köln', 'Fortuna Koln'],
    ['Fortuna Koeln', 'Fortuna Koln'], ['Coventry City', 'Coventry City']
  ]) assert.equal(aliases.resolveTeamName(input), expected);
});

test('Russian partial queries suggest the right club without merging different Fortunas', () => {
  assert.deepEqual(aliases.localizedSuggestions('ковен'), ['Coventry City']);
  assert.deepEqual(aliases.localizedSuggestions('хавел'), ['Havelse']);
  assert.deepEqual(aliases.localizedSuggestions('фортуна к'), ['Fortuna Koln']);
  assert.equal(aliases.localizedSuggestions('фортуна').length, 3);
  assert.notEqual(aliases.resolveTeamName('Фортуна'), 'Fortuna Koln');
  assert.notEqual(aliases.resolveTeamName('Ковентри Сити U21'), 'Coventry City');
  assert.notEqual(aliases.resolveTeamName('Кельн'), aliases.resolveTeamName('Фортуна Кельн'));
});

function loadHandler(file, dependencies) {
  const context = {
    module: { exports: {} }, console, process: {env:{}},
    require(name) {
      assert.ok(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  return context.module.exports;
}

function response() {
  return { statusCode: 200, body: null, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('generic club search excludes a B team unless the user explicitly asks for reserves', async () => {
  const handler = loadHandler('api/team-search.js', {
    '../lib/football': {clean: v => String(v || '').trim(),searchTheSportsDbTeams: async () => [{name:'Tenerife B'}]},
    '../lib/team-aliases': {localizedSuggestions: () => [],searchQuery:q=>q,ambiguousTeamChoices:()=>[]},
    '../lib/club-directory': {searchClubDirectory: async () => [{name:'C.D. Tenerife'}]},
    '../lib/rate-limit': {enforceRateLimit:async()=>true}
  });
  const res=response();await handler({method:'GET',query:{q:'Club Deportivo Tenerife'}},res);
  assert.deepEqual(Array.from(res.body.teams,t=>t.name),['C.D. Tenerife']);
  const reserves=response();await handler({method:'GET',query:{q:'Tenerife B'}},reserves);
  assert.ok(reserves.body.teams.some(t=>t.name === 'Tenerife B'));
});

test('Russian suggestions work without contacting an unavailable provider', async () => {
  const handler = loadHandler('api/team-search.js', {
    '../lib/football': { clean: (v) => String(v || '').trim(), searchTheSportsDbTeams: () => { throw new Error('Provider must not be called for known aliases'); } },
    '../lib/team-aliases': aliases,
    '../lib/club-directory': { searchClubDirectory: async () => [] },
    '../lib/rate-limit': { enforceRateLimit: async () => true }
  });
  const res = response();
  await handler({ method: 'GET', query: { q: 'Ковентри' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.teams[0].name, 'Coventry City');
});

test('analysis endpoint passes the same canonical teams and cache key for Russian and English', async () => {
  const calls = [];
  const cacheKeys = [];
  const identity = async (value) => value;
  const handler = loadHandler('api/analyze.js', {
    '../lib/team-aliases': aliases,
    '../lib/club-directory': { searchClubDirectory: async () => [] },
    '../lib/base-analysis-v2': { buildBaseAnalysis: async (home, away) => {
      calls.push([home, away]);
      return { teams: { home: { name: home }, away: { name: away } }, fixture: { date: '2026-09-25' }, form: { home: { played: 8 }, away: { played: 8 } }, model: {}, advanced: { home: {}, away: {} }, leagueContext: {} };
    } },
    '../lib/analysis-enhancer': { enhanceAnalysis: identity },
    '../lib/openfootball-history': { enrichOpenFootball: async a => a },
    '../lib/openligadb-history': { enrichOpenLigaDb: identity, resolveOpenLigaClubs: identity },
    '../lib/verified-history': { needsMoreHistory: () => false, refreshScheduleContext: value => value },
    '../lib/bsd-history': { enrichBsdHistory: identity },
    '../lib/espn-football': { enrichEspnAnalysis: identity },
    '../lib/sportmonks-history': { enrichSportmonksHistory: identity },
    '../lib/granular-enrichment': { enhanceGranularAnalysis: identity },
    '../lib/api-football-fallback': { enrichApiFootballFallback: () => { throw new Error('Unexpected fallback'); } },
    '../lib/football-data-enrichment': {},
    '../lib/squad-availability': { enrichAvailabilityIntelligence: identity },
    '../lib/vertex-model-v2': { finalizeVertexModelV2: (v) => v },
    '../lib/model-evaluation-store': { recordModelEvaluations: async () => ({ recorded: 0 }) },
    '../lib/api-auth': { requireUser: async () => ({ id: 'test-user' }) },
    '../lib/rate-limit': { enforceRateLimit: async () => true },
    '../lib/provider-cache': { cachedProviderCall: async ({ cacheKey, loader }) => { cacheKeys.push(cacheKey); return { payload: await loader() }; } }
  });
  for (const pair of [
    ['Ноттингем Форест', 'Ковентри Сити'], ['Nottingham Forest', 'Coventry City'],
    ['Хавелсе', 'Фортуна Кёльн'], ['Havelse', 'Fortuna Koln']
  ]) {
    const res = response();
    await handler({ method: 'POST', body: { home: pair[0], away: pair[1] } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.analysis.input.home, pair[0]);
  }
  assert.deepEqual(calls[0], ['Nottingham Forest', 'Coventry City']);
  assert.deepEqual(calls[2], ['Havelse', 'Fortuna Koln']);
  assert.deepEqual(calls[0], calls[1]);
  assert.deepEqual(calls[2], calls[3]);
  assert.equal(cacheKeys[0], cacheKeys[1]);
  assert.equal(cacheKeys[2], cacheKeys[3]);
  const before = calls.length;
  for (const pair of [['Operário', 'Ceará'], ['Ceará', 'Операрио']]) {
    const res = response();
    await handler({ method: 'GET', query: { home: pair[0], away: pair[1] } }, res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, 'TEAM_AMBIGUOUS');
    assert.equal(res.body.teams[0].side, pair[0] === 'Ceará' ? 'away' : 'home');
    assert.equal(res.body.teams[0].candidates.length, 4);
  }
  assert.equal(calls.length, before, 'ambiguous inputs must never reach the model');
});


test('Spanish spellings, accents and Russian variants resolve to canonical clubs', () => {
  for (const [input, expected] of [
    ['Bayern Múnich', 'Bayern Munich'], ['Bayern MunicH', 'Bayern Munich'],
    ['Inter de Milán', 'Inter Milan'], ['Nápoles', 'Napoli'], ['Oporto', 'Porto'],
    ['Atlético de Madrid', 'Atletico Madrid'], ['Спартак Москва', 'Spartak Moscow'],
    ['Ковэнтри Сити', 'Coventry City'], ['Fortuna Colonia', 'Fortuna Koln']
  ]) assert.equal(aliases.resolveTeamName(input), expected);
  assert.ok(aliases.localizedSuggestions('bayern mú').includes('Bayern Munich'));
  assert.ok(aliases.localizedSuggestions('inter de').includes('Inter Milan'));
  assert.notEqual(aliases.resolveTeamName('Manchester'), 'Manchester City');
});


test('Flashscore Brazilian names keep provider identities, hyphens and accents consistent', () => {
  const { parse } = require('../match-input');
  const { sameTeam } = require('../lib/match-integrity');
  for (const [input, expected] of [
    ['Operário-PR', 'Operario Ferroviario'], ['Операрио ПР', 'Operario Ferroviario'],
    ['Operário Ferroviário', 'Operario Ferroviario'], ['Сеара', 'Ceara'],
    ['Новоризонтино', 'Novorizontino'], ['Grêmio Novorizontino', 'Novorizontino'],
    ['Сан-Бернардо', 'Sao Bernardo'], ['São Bernardo FC', 'Sao Bernardo']
  ]) {
    assert.equal(aliases.resolveTeamName(input), expected);
    assert.ok(aliases.localizedSuggestions(input).includes(expected));
  }
  assert.deepEqual(parse('Operario-PR — Ceará'), {home:'Operario-PR',away:'Ceará'});
  assert.deepEqual(parse('Новоризонтино vs Сан-Бернардо'), {home:'Новоризонтино',away:'Сан-Бернардо'});
  assert.equal(sameTeam('EC São Bernardo', 'Sao Bernardo'), false);
  assert.equal(sameTeam('São Bernardo U20', 'Sao Bernardo'), false);
  for (const bare of ['Operário','Операрио','ФК Операрио']) {
    assert.equal(aliases.ambiguousTeamChoices(bare).length, 4);
    for (const club of aliases.ambiguousTeamChoices(bare)) assert.equal(sameTeam(bare, club.name), false);
  }
  assert.equal(sameTeam('Operário-PR','Operario Ferroviario'), true);
  assert.equal(sameTeam('CD Operário','CD Operario'), true);
  assert.equal(sameTeam('Operário-MS','Operario Ferroviario'), false);
});

test('ambiguous public suggestions include countries without depending on a live provider', async () => {
  const handler = loadHandler('api/team-search.js', {
    '../lib/football': { clean: value => value, searchTheSportsDbTeams: () => { throw Error('unexpected lookup'); } },
    '../lib/team-aliases': aliases,
    '../lib/club-directory': { searchClubDirectory: () => { throw Error('unexpected lookup'); } },
    '../lib/rate-limit': { enforceRateLimit: async () => true }
  });
  const res = response();
  await handler({method:'GET',query:{q:'Operário'}},res);
  assert.equal(res.body.teams.length,4);
  assert.equal(res.body.teams[0].name,'Operario Ferroviario');
  assert.equal(res.body.teams[0].country,'Brazil');
  assert.equal(res.body.teams[3].country,'Portugal');
});
