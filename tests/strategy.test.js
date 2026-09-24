'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../strategy-core');
const now = Date.parse('2026-09-24T12:00:00Z');
const p = core.profile({risk:'Balanced',experience:'Intermediate',markets:['Goals','1X2'],leagues:['England|Premier League']});
function analysis() {
  return {fixture:{date:'2026-09-25T18:00:00Z',league:'Premier League'}, teams:{home:{name:'Chelsea',country:'England'},away:{name:'Arsenal',country:'England'}},
    generatedAt:'2026-09-24T11:30:00Z',model:{oneXtwo:{home:47,draw:27,away:26},over25:61,under25:39,btts:63,noBtts:37,doubleChance:{oneX:74,xTwo:53,oneTwo:73}},
    dataQuality:78,form:{home:{played:8},away:{played:8}},contextSources:{form:'BSD'},engine:{modelVersion:'Vertex Model 2.3'}};
}
test('strategy uses the chosen market, not the largest probability across unequal markets',()=>{
  const a=core.assess(analysis(),p,{},now);
  assert.equal(a.status,'FIT');assert.equal(a.pick.market,'GOALS_OU_2_5');assert.equal(a.pick.probability,61);
  assert.deepEqual(a.sources,['BSD']);assert.ok(a.warnings.includes('squads'));
  assert.equal(core.assess(analysis(),{...p,markets:['BTTS']},{},now).pick.market,'BTTS');
});
test('profile applies stricter history and quality filtering to actual forecasts',()=>{
  const a=analysis(); a.dataQuality=64;
  assert.equal(core.assess(a,p,{},now).status,'PASS');
  a.dataQuality=85; a.form.away.played=3;
  assert.ok(core.assess(a,p,{},now).reasons.includes('history'));
  a.form.away.played=8;a.model=null;
  assert.equal(core.assess(a,p,{},now).pick,null);
});
test('no scheduled match, kickoff, wrong league and conflicting schedule are rejected',()=>{
  for(const date of [null,'invalid','2026-09-24T10:00:00Z','2026-10-20T18:00:00Z']){
    const a=analysis();a.fixture.date=date;assert.equal(core.assess(a,p,{},now).status,'PASS');
  }
  assert.equal(core.assess(analysis(),{...p,leagues:['Brazil|Serie A']},{},now).status,'PASS');
  assert.ok(core.assess(analysis(),p,{},now,{date:'2026-09-26T18:00:00Z'}).reasons.includes('fixture_changed'));
});
test('unknown event statistics never produce corner or card probabilities',()=>{
  const r=core.assess(analysis(),{...p,markets:['Corners','Cards']},{},now);
  assert.equal(r.status,'PASS');assert.equal(r.pick,null);assert.ok(r.warnings.includes('event_markets'));
  const a=analysis();a.model.over25=null; assert.equal(core.assess(a,{...p,markets:['Goals']},{},now).pick,null);
});
test('future, stale and unconfirmed near-kickoff reports remain watch-only',()=>{
  const a=analysis(); a.fixture.date='2026-09-24T14:00:00Z';
  assert.ok(core.assess(a,p,{},now).reasons.includes('lineups_soon'));
  a.fixture.date='2026-09-29T18:00:00Z';assert.equal(core.assess(a,p,{},now).status,'WATCH');
  a.fixture.date='2026-09-25T18:00:00Z';a.engine.analysisCacheStale=true;assert.ok(core.assess(a,p,{},now).reasons.includes('stale'));
});
test('shortlist filters cancelled, live, undated, past and duplicate fixtures by league and week',()=>{
  const base={home:'Chelsea',away:'Arsenal',league:'Premier League',country:'England',date:'2026-09-25T18:00:00Z'};
  const list=[base,{...base},...['CANCELLED','POSTPONED','LIVE'].map(status=>({...base,status})),{...base,date:null},{...base,date:'2026-09-20'},{...base,date:'2026-10-02'},{...base,country:'Kenya'}];
  assert.deepEqual(core.fixtures(list,p,now),[base]);
});
function journal(correct,i=0){return {selected_at:'2026-09-21T08:00:00Z',evaluation:{fixture_date:new Date(now-(i+1)*3600000).toISOString(),is_correct:correct,model_version:'Vertex Model 2.3',market:'1X2'}};}
test('pending and late selections are never counted as failed predictions',()=>{
  const r=core.review([journal(true),journal(null),{...journal(null),evaluation:{...journal(null).evaluation,evaluation_status:"excluded_late"}},{...journal(false),selected_at:'2026-09-25T12:00:00Z'}, {...journal(false),evaluation:{...journal(false).evaluation,model_version:null}}],now);
  assert.equal(r.settled,1);assert.equal(r.correct,1);assert.equal(r.pending,1);assert.equal(r.cautious,false);assert.equal(r.accuracy,null);
});
test('three misses alone do not claim learning; six results with a losing run tighten rules and never raise the stake cap',()=>{
  const short=core.review([journal(false),journal(false,1),journal(false,2)],now);
  assert.equal(short.cautious,false);
  const feedback=core.review([false,false,false,true,true,true].map(journal),now);
  assert.equal(feedback.cautious,true);assert.equal(feedback.qualityExtra,5);
  const money={...p,bankroll:1000,settings:{weeklyLimit:6,stakeCapPct:0.5,currency:'USD'}};
  assert.equal(core.rules(money,feedback).quality,73);assert.equal(core.rules(money,feedback).weeklyLimit,3);
  assert.equal(core.rules(money,feedback).cap,5);assert.equal(core.rules(money,short).cap,5);
});
test('weekly counts reset on Monday UTC independently of settled dates',()=>{
  assert.equal(core.weekStart(now),Date.parse('2026-09-21T00:00:00Z'));
  const rows=[journal(null),{...journal(true),selected_at:'2026-09-20T23:59:59Z'}];
  assert.equal(core.review(rows,now).weeklySelected,1);
  assert.equal(core.assess(analysis(),p,{weeklySelected:4},now).status,'WATCH');
});
test('profile cannot inject unlimited volume, currency markup or invalid numeric amounts',()=>{
  const limited=core.profile({risk:'unknown',bankroll:Infinity,markets:['1X2','<script>'],leagues:['A','B','C'],settings:{weeklyLimit:100,stakeCapPct:500,currency:'<img>'}});
  assert.equal(limited.bankroll,0);assert.equal(limited.settings.weeklyLimit,6);assert.equal(limited.settings.stakeCapPct,2);assert.equal(limited.settings.currency,'EUR');assert.equal(limited.leagues.length,2);assert.deepEqual(limited.markets,['1X2']);
  assert.equal(core.rules({...p,bankroll:0}).cap,null);
});

test('strategy API enforces auth, private cache and server-owned forecast storage',async()=>{
  const originalFetch=global.fetch;
  const oldEnv={...process.env};
  process.env.SUPABASE_URL='https://strategy.test';process.env.SUPABASE_ANON_KEY='public-test-key';process.env.SUPABASE_SECRET_KEY='test-only';
  const authPath=require.resolve('../lib/api-auth'), ratePath=require.resolve('../lib/rate-limit'), apiPath=require.resolve('../api/strategy');
  const authOriginal=require(authPath),rateOriginal=require(ratePath);
  const events=[]; let authorized=false;
  const liveDate=new Date(Date.now()+86400000).toISOString();
  const a=analysis();a.fixture.date=liveDate;a.generatedAt=new Date().toISOString();
  const forecast={...a,version:'Vertex Model 2.3'};
  const row={id:'fixture-evaluation',fixture_key:'key',fixture_date:liveDate,created_at:new Date().toISOString(),model_version:'Vertex Model 2.3',forecast,market:'GOALS_OU_2_5',predicted_value:'OVER',predicted_probability:61,is_correct:null};
  try{
    require.cache[authPath].exports={requireUser:async(req,res)=>{if(!authorized){res.status(401).json({error:'AUTH_REQUIRED'});return null;}return{id:'owner-A'};}};
    require.cache[ratePath].exports={enforceRateLimit:async()=>true};delete require.cache[apiPath];
    const handler=require(apiPath);
    global.fetch=async(input,init={})=>{const url=new URL(input);events.push({url,init});const table=url.pathname.split('/').pop();
      if(table==='strategy_profiles')return new Response(JSON.stringify([{user_id:'owner-A',risk_profile:p.risk,experience:p.experience,markets:p.markets,leagues:p.leagues}]),{status:200});
      if(table==='strategy_journal')return init.method==='POST'?new Response(null,{status:204}):new Response('[]',{status:200});
      if(table==='model_evaluations')return new Response(JSON.stringify([row]),{status:200});
      throw Error('Unexpected URL');};
    const call=async(body)=>{const out={headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.code=s;return this;},json(v){this.body=v;return this;}};await handler({method:body?'POST':'GET',body,headers:{authorization:'Bearer test-user-token'}},out);return out;};
    assert.equal((await call()).code,401);assert.equal(events.length,0);authorized=true;
    const state=await call();assert.equal(state.code,200);assert.equal(state.headers['Cache-Control'],'private, no-store');
    assert.ok(events.filter(x=>x.url.pathname.endsWith('strategy_journal')).every(x=>x.url.searchParams.get('user_id')==='eq.owner-A'));
    const selected=await call({action:'track',fixtureKey:'key',market:'GOALS_OU_2_5',user_id:'owner-B',predicted_probability:99,is_correct:true});
    assert.equal(selected.code,200);
    const write=events.find(x=>x.init.method==='POST');const payload=JSON.parse(write.init.body);
    assert.deepEqual(payload,{user_id:'owner-A',fixture_key:'key',evaluation_id:'fixture-evaluation'});
    assert.equal(write.init.headers.Authorization,undefined);assert.equal(write.init.headers.apikey,'test-only');
    row.fixture_date=new Date(Date.now()-1000).toISOString();assert.equal((await call({action:'track',fixtureKey:'key',market:'GOALS_OU_2_5'})).code,409);
  } finally{global.fetch=originalFetch;process.env=oldEnv;require.cache[authPath].exports=authOriginal;require.cache[ratePath].exports=rateOriginal;delete require.cache[apiPath];}
});
