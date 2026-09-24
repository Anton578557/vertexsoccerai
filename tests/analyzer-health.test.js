'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
test('fixed health probes inspect the API core envelope and expose status without full forecasts',async()=>{
 const calls=[];
 const context={module:{exports:{}},require(name){
  if(name==='./provider-cache')return{cachedProviderCall:async({loader,ttlSeconds})=>{assert.equal(ttlSeconds,86400);return{payload:await loader()};}};
  if(name==='./team-aliases')return{resolveTeamName:v=>v};
  if(name==='../api/analyze')return{buildAnalysisCore:async(home,away)=>{
   calls.push([home,away]);return{analysis:{teams:{home:{name:home,resolved:true,badge:'crest.png'},away:{name:away,resolved:true,badge:'crest.png'}},form:{home:{played:8},away:{played:8}},sourceStatus:{primaryFootball:'BSD'},model:{secretTestMarker:'not_public'}},providerMeta:{}};
  }};
  throw Error(name);
 }};
 vm.runInNewContext(fs.readFileSync(require.resolve('../lib/analyzer-health'),'utf8'),context);
 const result=await context.module.exports.checkAnalyzerCases();
 assert.equal(calls.length,4);assert.ok(result.checks.every(check=>check.modelReady));
 assert.ok(result.checks.every(check=>check.teams.every(team=>team.history===8)));
 assert.equal(JSON.stringify(result).includes('not_public'),false);
});
