'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {resolveFinalMatch,footballDataMatches,actualForMarket}=require('../lib/model-evaluator');
const forecast={teams:{home:{name:'Wehen Wiesbaden',country:'Germany'},away:{name:'Alemannia Aachen',country:'Germany'}},fixture:{league:'Germany Liga 3'}};
const date='2026-09-19';
const final={home:'SV Wehen Wiesbaden',away:'Alemannia Aachen',date:`${date}T13:00:00Z`,status:'FINISHED',homeScore:2,awayScore:1,source:'OpenLigaDB'};

test('evaluation falls back after empty or failed sources and excludes wrong days and unfinished games',async()=>{
  const calls=[];
  const result=await resolveFinalMatch(forecast,date,[{...final,status:'IN_PLAY'}],{
    openLiga:async()=>{calls.push('open');return [{...final,date:'2026-09-18T13:00:00Z'},{...final,date:null}];},
    csv:async()=>{calls.push('csv');throw Error('unavailable');},
    bsd:async()=>{calls.push('bsd');return [final];}
  });
  assert.deepEqual(calls,['open','csv','bsd']); assert.equal(actualForMarket('1X2',result).actual,'HOME');
  assert.equal(actualForMarket('1X2',{...final,homeScore:null}),null);
});

test('Football-Data requests a nonempty date interval and accepts only finished regulation scores on that date',async()=>{
  const oldFetch=global.fetch,key=process.env.FOOTBALL_DATA_KEY; let requested;
  process.env.FOOTBALL_DATA_KEY='test-only';
  const row={status:'FINISHED',utcDate:`${date}T13:00:00Z`,homeTeam:{name:'Wehen Wiesbaden'},awayTeam:{name:'Alemannia Aachen'},score:{duration:'REGULAR',fullTime:{home:2,away:1}}};
  global.fetch=async url=>{requested=new URL(url);return {ok:true,json:async()=>({matches:[row,{...row,status:'IN_PLAY'},{...row,utcDate:'2026-09-20T13:00:00Z'}]})};};
  try{
    const rows=await footballDataMatches(date);
    assert.equal(requested.searchParams.get('dateFrom'),date);
    assert.equal(requested.searchParams.get('dateTo'),'2026-09-20');
    assert.equal(rows.length,1);
  }finally{global.fetch=oldFetch;if(key===undefined)delete process.env.FOOTBALL_DATA_KEY;else process.env.FOOTBALL_DATA_KEY=key;}
});

test('maintenance endpoint refuses unauthenticated execution',async()=>{
  const handler=require('../api/results');
  const res={statusCode:0,status(code){this.statusCode=code;return this;},json(value){this.body=value;return this;}};
  await handler({method:'GET',query:{maintenance:'1'},headers:{}},res);
  assert.equal(res.statusCode,401);assert.deepEqual(res.body,{error:'Unauthorized'});
});
