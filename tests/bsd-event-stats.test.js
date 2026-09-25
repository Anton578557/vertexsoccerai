'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {statsRow,eligibleEvents,mergeEventModels} = require('../lib/bsd-event-stats');
const {buildGranularFromRows} = require('../lib/football-data-uk');
const {normalizeEvents} = require('../lib/bsd-history');
const daysAgo = days => new Date(Date.now()-days*864e5).toISOString();
const event = (id,days=4) => ({id:`bsd:${id}`,date:daysAgo(days),home:'Arsenal',away:'Chelsea',homeScore:1,awayScore:0,regulationVerified:true,eventStatsRegulation:true});
const payload = (id,overrides={}) => ({event_id:id,stats:{home:{corner_kicks:6,yellow_cards:2,red_cards:0},away:{corner_kicks:4,yellow_cards:3,red_cards:1},...overrides}});

test('BSD event statistics require matching IDs and regulation-only verified history',()=>{
  const row=statsRow(event(10),payload(10));
  assert.equal(row.HC,6);assert.equal(row.AC,4);assert.equal(row.HY,2);assert.equal(row.AR,1);assert.equal(row.HR,0);
  assert.equal(statsRow(event(10),payload(11)),null);
  assert.equal(statsRow({...event(10),eventStatsRegulation:false},payload(10)),null);
  const bad=statsRow(event(10),payload(10,{home:{corner_kicks:null,yellow_cards:'2',red_cards:-1},away:{corner_kicks:NaN,yellow_cards:1.2,red_cards:999}}));
  for(const key of ['HC','AC','HY','AY','HR','AR'])assert.equal(bad[key],null);
});

test('history collection excludes live, future, duplicate-day and extra-time event statistics',()=>{
  const rows=[event(1,1),event(2,120),event(3,-1),{...event(4),eventStatsRegulation:false},{...event(5),date:new Date().toISOString()}];
  assert.deepEqual(eligibleEvents(rows,new Date().toISOString()).map(x=>x.id),['bsd:1']);
  const base={id:2,status:'finished',home_team_id:1,home_team:'Arsenal',away_team_id:2,away_team:'Chelsea',home_score:1,away_score:1,event_date:daysAgo(4)};
  const team={id:1,name:'Arsenal'};
  assert.equal(normalizeEvents([base],team)[0].eventStatsRegulation,true);
  assert.equal(normalizeEvents([{...base,extra_time_score:'2-1'}],team)[0].eventStatsRegulation,false);
  assert.equal(normalizeEvents([{...base,penalty_shootout:'5-4'}],team)[0].eventStatsRegulation,false);
});

test('one count model generates corners and yellow totals from BSD rows; red cards remain observed history',()=>{
  const rows=Array.from({length:8},(_,i)=>statsRow(event(i+1,i+2),payload(i+1)));
  const model=buildGranularFromRows(rows,'Arsenal','Chelsea',{source:'BSD'});
  assert.equal(model.source,'BSD');assert.equal(model.corners.expectedTotal,10);assert.equal(model.cards.expectedTotal,5);
  assert.deepEqual(model.eventSamples.corners,{home:8,away:8});
  assert.equal(model.redCards.home.matchesWithRed,0);assert.equal(model.redCards.home.sample,8);
  assert.equal(model.redCards.away.matchesWithRed,8);assert.equal(model.redCards.methodology,'observed_history_only');
  assert.ok(model.corners.over75>model.corners.over85 && model.corners.over85>model.corners.over95);
  assert.ok(model.cards.over35>model.cards.over45 && model.cards.over45>model.cards.over55);
  const noCards=rows.map(row=>({...row,HY:null,AY:null,HR:null,AR:null}));
  const partial=buildGranularFromRows(noCards,'Arsenal','Chelsea',{source:'BSD'});
  assert.equal(partial.cards,null);assert.equal(partial.redCards,null);assert.equal(partial.corners.expectedTotal,10);
  assert.deepEqual(partial.eventSamples.cards,{home:0,away:0});
});

test('event fallback preserves a complete existing market and attributes each new market to its source',()=>{
  const old={ok:true,source:'Football-Data.co.uk',coverage:{corners:true},corners:{expectedTotal:10},eventSamples:{corners:{home:12,away:12}},yellowHistory:{}};
  const next={ok:true,source:'BSD',coverage:{cards:true},cards:{expectedTotal:5},eventSamples:{cards:{home:8,away:8}},yellowHistory:{home:{n:8},away:{n:8}}};
  const merged=mergeEventModels(old,next);
  assert.equal(merged.corners.expectedTotal,10);assert.equal(merged.corners.source,'Football-Data.co.uk');
  assert.equal(merged.cards.expectedTotal,5);assert.equal(merged.cards.source,'BSD');
  assert.deepEqual(merged.eventSamples.corners,{home:12,away:12});assert.deepEqual(merged.eventSamples.cards,{home:8,away:8});
  assert.equal(old.cards,undefined);assert.equal(old.corners.source,undefined);
  assert.equal(mergeEventModels(old,{ok:false}),old);
});

function loadCollector({failure=false,enabled=true}={}) {
  let calls=0;const cached=new Map();
  const teams={Arsenal:{id:1,name:'Arsenal',canonicalName:'Arsenal'},Chelsea:{id:2,name:'Chelsea',canonicalName:'Chelsea'}};
  const context={module:{exports:{}},Date,Set,Map,console,require(name){
    if(name==='./bsd-history')return{
      configuration:()=>({enabled,configured:true}),resolveTeam:async team=>teams[team.name],
      teamHistory:async()=>Array.from({length:8},(_,i)=>event(i+1,i+2)),
      requestMatchStats:async id=>{calls++;if(failure)throw Error('quota_exhausted');return payload(id);}
    };
    if(name==='./football-data-uk')return{buildGranularFromRows};
    if(name==='./match-integrity')return require('../lib/match-integrity');
    if(name==='./provider-cache')return{cachedProviderCall:async({cacheKey,loader})=>{if(!cached.has(cacheKey))cached.set(cacheKey,await loader());return{payload:cached.get(cacheKey)};}};
    throw Error(name);
  }};
  vm.runInNewContext(fs.readFileSync(require.resolve('../lib/bsd-event-stats'),'utf8'),context);
  return {run:()=>context.module.exports.buildBsdEventModel({teams:{home:{name:'Arsenal'},away:{name:'Chelsea'}},fixture:{}}),calls:()=>calls};
}

test('stats collection deduplicates meetings, caches the pair and respects quota cooldown',async()=>{
  const c=loadCollector();const first=await c.run();
  assert.equal(first.corners.expectedTotal,10);assert.equal(c.calls(),8);
  await c.run();assert.equal(c.calls(),8);
  const limited=loadCollector({failure:true});const missing=await limited.run();
  assert.equal(missing.ok,false);assert.equal(missing.reason,'quota_exhausted');assert.ok(limited.calls()<=4);
  const disabled=loadCollector({enabled:false});assert.equal((await disabled.run()).reason,'not_configured');assert.equal(disabled.calls(),0);
});

test('BSD stats transport validates event identity and caches only the statistics payload',async()=>{
  const urls=[],saved=new Map();
  const context={module:{exports:{}},process:{env:{BSD_API_KEY:'unit-test-placeholder'}},URLSearchParams,AbortSignal,Date,
    fetch:async(url,options)=>{urls.push(url);assert.equal(options.headers.Authorization,'Token unit-test-placeholder');
      const id=Number(new URL(url).pathname.split('/')[4]);
      return{ok:true,json:async()=>({...payload(id===13?99:id),shotmap:[{private:'unused'}]})};},
    require(name){
      if(name==='./analysis-budget')return{boundedFetch:context.fetch};
      if(name==='./provider-cache')return{getProviderCache:async()=>null,setProviderCache:async()=>{},
        cachedProviderCall:async({cacheKey,loader})=>{if(!saved.has(cacheKey))saved.set(cacheKey,await loader());return{payload:saved.get(cacheKey)};}};
      return require('../lib/'+name.slice(2));
    }};
  vm.runInNewContext(fs.readFileSync(require.resolve('../lib/bsd-history'),'utf8'),context);
  const request=context.module.exports.requestMatchStats;
  const result=await request(12);assert.equal(result.stats.home.red_cards,0);assert.equal(result.shotmap,undefined);
  assert.match(urls[0],/\/api\/v2\/events\/12\/stats\//);
  await request(12);assert.equal(urls.length,1);
  await assert.rejects(request(13),/invalid_dataset/);
  await assert.rejects(request(-1),/invalid_event_id/);
});
