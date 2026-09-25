'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
test('reversing a pair cannot reuse home/away event estimates from the opposite direction', async()=>{
 const cache=new Map(), calls=[];
 const context={module:{exports:{}},require(name){
  if(name==='./bsd-event-stats')return{buildBsdEventModel:async()=>({ok:false}),mergeEventModels:(old)=>old};
  if(name==='./provider-cache')return{cachedProviderCall:async({cacheKey,loader})=>{
   if(!cache.has(cacheKey))cache.set(cacheKey,await loader());return{payload:cache.get(cacheKey)};
  }};
  if(name==='./football-data-uk')return{buildGranularHistoricalModel:async(home,away)=>{
   calls.push([home,away]);return{ok:true,quality:50,source:'Football-Data.co.uk',code:'E0',coverage:{},sample:{},corners:{expectedHome:home==='Arsenal'?7:3}};
  }};
  if(name==='./event-stats-ingestion')return{ingestEventStatsForAnalysis:async()=>({})};
  throw Error(name);
 },console,Date,Map,Set};
 vm.runInNewContext(fs.readFileSync(require.resolve('../lib/granular-enrichment'),'utf8'),context);
 const build=(home,away)=>({teams:{home:{name:home,country:'England'},away:{name:away,country:'England'}},fixture:{league:'English Premier League',date:'2026-09-25'}});
 const first=await context.module.exports.enhanceGranularAnalysis(build('Arsenal','Chelsea'));
 const second=await context.module.exports.enhanceGranularAnalysis(build('Chelsea','Arsenal'));
 assert.equal(first.granularModel.corners.expectedHome,7);assert.equal(second.granularModel.corners.expectedHome,3);
 assert.equal(calls.length,2);
});
