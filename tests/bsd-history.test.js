'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { selectTeam, normalizeEvents, retrySeconds, enrichBsdHistory } = require('../lib/bsd-history');

const teams = [{id: 101, name:'Arsenal', canonicalName:'Arsenal'}, {id:102, name:'Chelsea', canonicalName:'Chelsea'}];
const event = (overrides = {}) => ({id:123, home_team:'Arsenal', away_team:'Chelsea', home_team_id:101, away_team_id:102,
  status:'finished', event_date:'2026-09-19T13:30:00Z', home_score:1, away_score:1, ...overrides});
const analysis = () => ({teams:{home:{name:'Arsenal',country:'England'},away:{name:'Chelsea',country:'England'}},fixture:{},form:{home:{played:0},away:{played:0}},sourceStatus:{}});

test('BSD team identity rejects shared names, women, wrong countries and ambiguous exact identities', () => {
  assert.equal(selectTeam([{id:1,name:'Junior',country_code:'CO'}],{name:'Atletico Junior'},undefined).id,1);
  assert.equal(selectTeam([{id:1,name:'Junior'},{id:2,name:'Junior'}],{name:'Junior'},undefined),null);
  const club = {name:'Manchester City',country:'England'};
  const rows = [{id:1,name:'Manchester United',country_code:'GB'}, {id:2,name:'Manchester City',country_code:'GB'},
    {id:3,name:'Manchester City',country_code:'GB',is_women:true}, {id:4,name:'Manchester City',country_code:'US'}];
  assert.equal(selectTeam(rows, club, 'GB').id, 2);
  assert.equal(selectTeam([...rows,{id:5,name:'Manchester City',country_code:'GB'}], club, 'GB'), null);
  assert.equal(selectTeam([{id:2,name:'Manchester City',country:'USA'}], club, 'GB'), null);
  assert.equal(selectTeam([{id:928,name:'Náutico',country:'Brazil'},{id:6740,name:'Náutico-RR',country:'Brazil'}], {name:'Nautico',country:'Brazil'}, 'BR').id,928);
});

test('BSD requires finished matches, UTC, numeric scores and both exact provider identity and name', () => {
  const rows = [event({extra_time_score:'2-1',penalty_shootout:'5-4'}), event({status:'live'}), event({home_score:null}),
    event({home_score:'1'}), event({event_date:'2026-09-24T13:30:00Z'}), event({event_date:'2026-09-19T13:30:00'}),
    event({home_team_id:999}), event({home_team:'Arsenal Women'}), event({status:'cancelled'}), event({replaced_by:456})];
  const result = normalizeEvents(rows, teams[0], teams, new Date('2026-09-23'));
  assert.equal(result.length, 1); assert.equal(result[0].homeScore, 1); assert.equal(result[0].awayScore, 1);
});

test('BSD free quota respects Retry-After and otherwise pauses until the next UTC day', () => {
  const now = Date.parse('2026-09-23T23:00:00Z');
  assert.equal(retrySeconds('120',now),120);
  assert.equal(retrySeconds('Wed, 23 Sep 2026 23:10:00 GMT',now),600);
  assert.equal(retrySeconds(null,now),3600);
});

test('BSD is inert without a key or explicit enablement; verified history uses the free football API only', async () => {
  const original = global.fetch;
  const key = process.env.BSD_API_KEY, enabled = process.env.BSD_FOOTBALL_ENABLED;
  const urls = [];
  global.fetch = async (url, options) => {
    urls.push(String(url)); const parsed = new URL(url);
    assert.equal(options.headers.Authorization, 'Token unit-test-placeholder');
    assert.equal(parsed.origin, 'https://sports.bzzoiro.com');
    assert.equal(parsed.searchParams.has('token'),false);
    if (parsed.pathname === '/api/v2/teams/') return {ok:true,json:async()=>({next:null,results:teams.filter(team=>team.name===parsed.searchParams.get('name')).map(team=>({...team,country_code:'GB',is_women:false}))})};
    assert.equal(parsed.pathname, '/api/v2/events/');
    assert.equal(parsed.searchParams.get('status'),'finished');
    return {ok:true,json:async()=>({next:null,results:Array.from({length:6},(_,i)=>event({id: i+1,event_date:new Date(Date.now()-(i+1)*864e5).toISOString()}))})};
  };
  try {
    delete process.env.BSD_API_KEY; delete process.env.BSD_FOOTBALL_ENABLED;
    assert.equal((await enrichBsdHistory(analysis())).sourceStatus.bsd,'not_configured');
    process.env.BSD_API_KEY = 'unit-test-placeholder';
    assert.equal((await enrichBsdHistory(analysis())).sourceStatus.bsd,'awaiting_verification');
    assert.equal(urls.length,0);
    process.env.BSD_FOOTBALL_ENABLED='true';
    const result = await enrichBsdHistory(analysis());
    assert.equal(result.history.source,'BSD'); assert.equal(result.form.home.played,6); assert.equal(result.form.away.played,6);
    assert.equal(result.leagueContext,null); assert.equal(urls.length,4);
    await enrichBsdHistory(analysis()); assert.equal(urls.length,4);
    const withoutCountry = analysis();
    delete withoutCountry.teams.home.country; delete withoutCountry.teams.away.country;
    const recovered = await enrichBsdHistory(withoutCountry);
    assert.equal(recovered.form.home.played,6);
    assert.equal(recovered.teams.home.country,'England');
    assert.equal(recovered.teams.home.resolved,true);
    assert.equal(recovered.teams.home.badge,'https://sports.bzzoiro.com/img/team/101/');
    assert.equal(urls.length,6);

  } finally {
    global.fetch=original;
    if (key===undefined) delete process.env.BSD_API_KEY; else process.env.BSD_API_KEY=key;
    if (enabled===undefined) delete process.env.BSD_FOOTBALL_ENABLED; else process.env.BSD_FOOTBALL_ENABLED=enabled;
  }
});

test('BSD quota failures stop subsequent network attempts instead of polling a depleted free account', async () => {
  const original=global.fetch, key=process.env.BSD_API_KEY, enabled=process.env.BSD_FOOTBALL_ENABLED;
  let calls=0;
  global.fetch=async()=>{calls++;return {ok:false,status:429,headers:{get:()=> '600'}};};
  try {
    process.env.BSD_API_KEY='unit-test-placeholder'; process.env.BSD_FOOTBALL_ENABLED='true';
    const sample=analysis(); sample.teams.home.name='Nautico';sample.teams.home.country='Brazil';sample.teams.away.name='Sport Recife';sample.teams.away.country='Brazil';
    assert.equal((await enrichBsdHistory(sample)).sourceStatus.bsd,'quota_exhausted');
    const initial=calls;
    await enrichBsdHistory(sample); assert.equal(calls,initial); assert.equal(sample.form.home.played,0);
  } finally {
    global.fetch=original;
    if(key===undefined)delete process.env.BSD_API_KEY;else process.env.BSD_API_KEY=key;
    if(enabled===undefined)delete process.env.BSD_FOOTBALL_ENABLED;else process.env.BSD_FOOTBALL_ENABLED=enabled;
  }
});
