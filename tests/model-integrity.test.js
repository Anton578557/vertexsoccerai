'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { sameTeam, regulationScore } = require('../lib/match-integrity');
const { findMatch, actualForMarket, summarizeEvaluations } = require('../lib/model-evaluator');
const { recordModelEvaluations } = require('../lib/model-evaluation-store');

test('club identity keeps namesakes and youth teams separate', () => {
  for (const [a,b] of [['Manchester City','Manchester United'],['Fortuna Koln','FC Koln'],['Real Madrid','Atletico Madrid'],['Coventry City','Coventry City U21'],['Sheffield United','Sheffield Wednesday']]) assert.equal(sameTeam(a,b),false);
  for (const [a,b] of [['FC Bayern München','Bayern Múnich'],['Nottingham Forest FC','Ноттингем Форест'],['Coventry City FC','Ковентри Сити'],['1. FC Köln','FC Koln'],['FC Internazionale Milano','Inter de Milán'],['Brighton & Hove Albion FC','Brighton']]) assert.equal(sameTeam(a,b),true, a);
});

test('only final regulation scores enter history and evaluation', () => {
  for (const status of ['IN_PLAY','PAUSED','SUSPENDED','AWARDED','POSTPONED']) assert.equal(regulationScore({status,score:{fullTime:{home:1,away:0}}}),null);
  assert.deepEqual(regulationScore({status:'FINISHED',score:{duration:'REGULAR',fullTime:{home:0,away:0}}}),{home:0,away:0});
  assert.deepEqual(regulationScore({status:'FINISHED',score:{duration:'PENALTY_SHOOTOUT',fullTime:{home:6,away:5},regularTime:{home:1,away:1}}}),{home:1,away:1});
  assert.equal(regulationScore({status:'FINISHED',score:{duration:'EXTRA_TIME',fullTime:{home:2,away:1}}}),null);
  assert.equal(regulationScore({status:'FINISHED',score:{fullTime:{home:null,away:0}}}),null);
});

test('settlement requires both exact teams, a unique final match and correct orientation', () => {
  const match = {home:'Manchester City FC',away:'Arsenal FC',homeScore:2,awayScore:0,status:'FINISHED'};
  assert.equal(findMatch([match],'Manchester United','Arsenal'),null);
  assert.equal(findMatch([match,match],'Manchester City','Arsenal'),null);
  assert.equal(findMatch([{...match,status:'IN_PLAY'}],'Manchester City','Arsenal'),null);
  const reversed = findMatch([match],'Arsenal','Manchester City');
  assert.equal(actualForMarket('1X2',reversed).actual,'AWAY');
});

test('summary counts fixtures independently and scores selected probabilities without late predictions', () => {
  const base = {fixture_key:'fixture-a',fixture_date:'2026-09-20T17:00:00Z',created_at:'2026-09-20T16:00:00Z',data_quality:75};
  const result = summarizeEvaluations([
    {...base,market:'BTTS',predicted_probability:80,is_correct:true},
    {...base,market:'1X2',predicted_probability:60,is_correct:false},
    {...base,market:'BTTS',is_correct:true,created_at:'2026-09-20T18:00:00Z'}
  ]);
  assert.equal(result.fixtures,1); assert.equal(result.evaluated,2); assert.equal(result.accuracy,null);
  assert.equal(result.byMarket.BTTS.brierScore,.04); assert.equal(result.byMarket['1X2'].brierScore,.36);
  assert.equal(result.calibrationStatus,'not_calibrated');
});

test('full 1X2 distribution scoring requires an original snapshot and remains separate from selected-event scoring', () => {
  const base={fixture_key:'v23-a',fixture_date:'2026-09-20T17:00:00Z',created_at:'2026-09-20T16:00:00Z',
    market:'1X2',model_version:'Vertex Model 2.3',predicted_probability:60,is_correct:true,actual_value:'HOME · 2-1'};
  const result=summarizeEvaluations([{...base,forecast:{model:{oneXtwo:{home:60,draw:20,away:20}}}},
    {...base,fixture_key:'legacy-b',forecast:null}]);
  assert.equal(result.oneXtwoDistribution.fixtures,1);
  assert.equal(result.oneXtwoDistribution.brierScore,.24);
  assert.equal(result.byMarket['1X2'].brierScore,.16);
});

test('forecast recording rejects kick-off and keeps first snapshots immutable', async () => {
  const savedFetch = global.fetch, savedUrl = process.env.SUPABASE_URL, savedKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL='https://test.invalid'; process.env.SUPABASE_SECRET_KEY='test-only';
  let request = null;
  global.fetch = async (url,options) => { request=options; return {ok:true,json:async()=>[]}; };
  const analysis = {teams:{home:{name:'Home'},away:{name:'Away'}},fixture:{date:new Date(Date.now()-1000).toISOString()},model:{btts:65,noBtts:35}};
  try {
    assert.equal((await recordModelEvaluations(analysis)).reason,'fixture_started');
    assert.equal(request,null);
    analysis.fixture.date=new Date(Date.now()+3600e3).toISOString();
    analysis.engine = {modelVersion:'Vertex Model 2.3'};
    const result = await recordModelEvaluations(analysis);
    assert.equal(result.recorded,0); assert.equal(result.existing,true);
    assert.equal(request.headers.Prefer,'resolution=ignore-duplicates,return=representation');
    assert.equal(JSON.parse(request.body).length,1);
    assert.equal(JSON.parse(request.body)[0].model_version,'Vertex Model 2.3');
    assert.deepEqual(JSON.parse(request.body)[0].forecast.model,analysis.model);
  } finally {
    global.fetch=savedFetch;
    for (const [key,value] of [['SUPABASE_URL',savedUrl],['SUPABASE_SECRET_KEY',savedKey]]) if(value === undefined) delete process.env[key]; else process.env[key]=value;
  }
});
