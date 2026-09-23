'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeMatches, competitionCode, seasonPaths, enrichOpenFootball } = require('../lib/openfootball-history');

test('OpenFootball coverage is explicit and does not confuse Brazil A with B or other countries', () => {
  assert.equal(competitionCode('Brazilian Serie A','Brazil'),'br.1');
  assert.equal(competitionCode('Brazilian Serie B','Brazil'),null);
  assert.equal(competitionCode('Serie A','Italy'),'it.1');
  assert.equal(competitionCode('Primera A','Colombia'),null);
  assert.deepEqual(seasonPaths('en.1',new Date('2026-09-23')),['2026-27/en.1.json','2025-26/en.1.json']);
  assert.deepEqual(seasonPaths('en.1',new Date('2026-02-23')),['2025-26/en.1.json','2024-25/en.1.json']);
});

test('OpenFootball accepts only earlier completed days and no extra-time totals, missing or string scores', () => {
  const base={date:'2026-09-20',team1:'Arsenal FC',team2:'Chelsea FC',score:{ft:[2,1]}};
  const matches=[base,{...base,date:'2026-09-21',score:[0,0]}, {...base,date:'2026-09-23'}, {...base,date:'2026-09-24'},
    {...base,score:{ft:[2,1],et:[3,1]}},{...base,score:{ft:['2',1]}},{...base,score:null}];
  const rows=normalizeMatches({name:'Premier League',matches},'en.1',[{name:'Arsenal'},{name:'Chelsea'}],new Date('2026-09-23'));
  assert.equal(rows.length,2);assert.equal(rows[0].home,'Arsenal');assert.equal(rows[1].awayScore,0);
});

test('OpenFootball fallback actually applies recent results, never converts absent data to zero form', async () => {
  const original=global.fetch;
  let requests=0;
  global.fetch=async () => {requests++;return {ok:true,json:async()=>({name:'English Premier League',matches:Array.from({length:6},(_,i)=>({date:new Date(Date.now()-(i+2)*864e5).toISOString().slice(0,10),team1:'Arsenal FC',team2:'Chelsea FC',score:{ft:[2,1]}}))})};};
  const analysis=()=>({teams:{home:{name:'Arsenal',country:'England'},away:{name:'Chelsea',country:'England'}},fixture:{league:'English Premier League'},form:{home:{played:0},away:{played:0}},sourceStatus:{}});
  try {
    const result=await enrichOpenFootball(analysis());
    assert.equal(requests,2);assert.equal(result.form.home.played,6);assert.equal(result.form.away.played,6);
    assert.equal(result.history.source,'OpenFootball');assert.equal(result.leagueContext,null);
    const uncovered=analysis();uncovered.fixture.league='Brazilian Serie B';
    await enrichOpenFootball(uncovered);assert.equal(uncovered.sourceStatus.openFootball,'league_not_covered');
    assert.equal(uncovered.form.home.played,0);assert.equal(requests,2);
  } finally {global.fetch=original;}
});
