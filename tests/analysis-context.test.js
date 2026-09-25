'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {withBudget,remaining,stage,boundedFetch}=require('../lib/analysis-budget');
const {normalizeLineups,exactFixture}=require('../lib/match-context');
const {measuredPerformance,statsRow}=require('../lib/bsd-event-stats');
const {actualForMarket}=require('../lib/model-evaluator');
const {selections}=require('../lib/model-evaluation-store');
const {selectCases,LEAGUES}=require('../lib/coverage-audit');
const {footballCountry}=require('../lib/football-country');
const {leagueCode,historyContext}=require('../lib/football-data-uk');
const {selectTeam}=require('../lib/bsd-history');
const {sameTeam}=require('../lib/match-integrity');
const {countOver}=require('../lib/count-distribution');

test('a hung optional stage returns its previous report and cannot mutate it later',async()=>{
  const before={value:1};let finish;
  const after=await withBudget(1000,()=>stage(before,'slow',15,async draft=>{
    await new Promise(resolve=>{finish=resolve;});draft.value=999;return draft;
  }));
  assert.equal(after.value,1);assert.equal(after.collection[0].status,'time_budget');
  finish();await new Promise(resolve=>setTimeout(resolve,5));assert.equal(after.value,1);
});

test('concurrent analysis deadlines are isolated and bound the actual network request',async()=>{
  const original=global.fetch;
  global.fetch=async(_,options)=>new Promise((resolve,reject)=>{
    if(options.signal.aborted)reject(options.signal.reason);
    else options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});
  });
  const keepAlive=setTimeout(()=>{},100);
  try{
    const [short,long]=await Promise.all([
      withBudget(10,async()=>{await assert.rejects(boundedFetch('https://test.invalid'));return remaining();}),
      withBudget(2000,async()=>{await new Promise(r=>setTimeout(r,20));return remaining();})
    ]);
    assert.equal(short,0);assert.ok(long>1000);assert.equal(remaining(),Infinity);
  }finally{global.fetch=original;clearTimeout(keepAlive);}
});

const side={formation:'4-3-3',starting_xi:Array.from({length:11},(_,i)=>({player_id:i+1,name:`Player ${i+1}`}))};
test('only a complete confirmed XI for the exact match is official',()=>{
  const sheet={event_id:12,lineup_status:'confirmed',beta:false,lineups:{home:side,away:side}};
  assert.equal(normalizeLineups(sheet,12).confirmed,true);
  assert.equal(normalizeLineups({...sheet,lineup_status:'predicted',beta:true},12).confirmed,false);
  assert.equal(normalizeLineups(sheet,99).confirmed,false);
  assert.equal(normalizeLineups({...sheet,lineups:{home:{...side,starting_xi:side.starting_xi.slice(0,10)},away:side}},12).status,'incomplete');
});
test('upcoming context checks team IDs, orientation, date, cancellation and namesakes',()=>{
  const teams=[{id:1,name:'Manchester City'},{id:2,name:'Arsenal'}];
  const row={id:5,home_team_id:1,away_team_id:2,home_team:'Manchester City',away_team:'Arsenal',status:'upcoming',event_date:new Date(Date.now()+864e5).toISOString()};
  assert.equal(exactFixture([row],teams,null).id,5);
  for(const bad of [{...row,home_team:'Manchester United'},{...row,home_team_id:3},{...row,status:'cancelled'},{...row,replaced_by:9}])assert.equal(exactFixture([bad],teams,null),null);
});
test('measured xG preserves real zero and excludes estimated or missing values',()=>{
  const event={id:'bsd:2',home:'Arsenal',away:'Chelsea',date:new Date(Date.now()-864e5).toISOString(),homeScore:1,awayScore:1,regulationVerified:true,eventStatsRegulation:true};
  const row=statsRow(event,{event_id:2,stats:{home:{xg:{actual:0,estimated:false}},away:{xg:{actual:1.4,estimated:true}}}});
  assert.equal(row.HXG,0);assert.equal(row.AXG,null);
  assert.equal(measuredPerformance([row],'Arsenal','Chelsea').home.sample,0);
  const perf=measuredPerformance([{...row,AXG:1.4}],'Arsenal','Chelsea');
  assert.equal(perf.home.xgFor,0);assert.equal(perf.away.xgFor,1.4);assert.equal(perf.appliedToModel,false);
});
test('card and corner evaluation never treats missing counts or a live game as zero',()=>{
  const final={status:'FINISHED',eventCounts:{corners:10,yellowCards:0}};
  assert.equal(actualForMarket('CORNERS_OU_9_5',final).actual,'OVER');
  assert.equal(actualForMarket('YELLOWS_OU_4_5',final).actual,'UNDER');
  assert.equal(actualForMarket('CORNERS_OU_9_5',{...final,eventCounts:{corners:null}}),null);
  assert.equal(actualForMarket('CORNERS_OU_9_5',{...final,status:'IN_PLAY'}),null);
  const picks=selections({model:{},granularModel:{corners:{over95:57},cards:{over45:43}}});
  assert.deepEqual(picks.map(p=>[p.market,p.value,p.probability]),[['CORNERS_OU_9_5','OVER',57],['YELLOWS_OU_4_5','UNDER',57]]);
});
test('coverage matrix contains fifteen leagues and picks four different finished pairings by date',()=>{
  assert.equal(Object.keys(LEAGUES).length,15);
  const rows=Array.from({length:6},(_,i)=>({Date:`${10+i}/09/2026`,HomeTeam:'Arsenal',AwayTeam:`Club ${i}`,FTHG:'2',FTAG:'1'}));
  const selected=selectCases(rows);
  assert.equal(selected.length,4);assert.equal(selected[0].AwayTeam,'Club 5');
});

test('country, league and official short-name regressions found in the live audit',()=>{
  assert.equal(footballCountry('The Netherlands'),'Netherlands');
  assert.equal(leagueCode('Dutch Eredivisie',footballCountry('The Netherlands')),'N1');
  assert.equal(leagueCode('Scottish Premier League','Scotland'),'SC0');
  assert.equal(leagueCode('Greek Superleague Greece','Greece'),'G1');
  assert.equal(leagueCode('Greek Superleague Greece','England'),null);
  assert.equal(selectTeam([{id:1247,name:'Bolton Wanderers',short_name:'Bolton',country:'England'}],{name:'Bolton'}).id,1247);
  for(const pair of [['Levadeiakos','Levadiakos'],['Atalanta BC','Atalanta'],['Como 1907','Como'],['OFI','OFI Crete']])assert.equal(sameTeam(...pair),true);
  assert.equal(sameTeam('Olympiacos','Olympiakos Nicosia'),false);
});
test('historical replay uses the target date for form expiry, not the date of this test run',()=>{
  const rows=[1,8,15,22].map(day=>({Date:`${day}/01/2025`,HomeTeam:'Arsenal',AwayTeam:'Chelsea',FTHG:'2',FTAG:'1'}));
  const c=historyContext(rows,'Arsenal','Chelsea',new Date('2025-02-01'));
  assert.equal(c.ok,true);assert.equal(c.homeForm.played,4);
});
test('count distributions preserve zero, remain bounded and decrease across thresholds',()=>{
  for(const k of [null,4,8,16]) {
    assert.equal(countOver(0,0.5,k),0);
    const values=[0.5,4.5,9.5,30.5].map(line=>countOver(9,line,k));
    assert.ok(values.every(p=>p>=0 && p<=1));assert.ok(values.every((p,i)=>i===0 || p<=values[i-1]));
  }
  assert.ok(Math.abs(countOver(2,0.5)-(1-Math.exp(-2)))<1e-12);
});
