'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {classify,mentions,gdeltArticle,getNewsIntelligence}=require('../lib/news-intelligence');
const {buildAvailabilityFromNews}=require('../lib/squad-availability');

test('safe news aliases find full clubs without merging Manchester rivals',()=>{
  assert.ok(mentions('Man City football team news','Manchester City'));
  assert.equal(mentions('Manchester United football team news','Manchester City'),false);
  const item=classify({title:'Plymouth announce football team news',url:'javascript:alert(1)',publishedAt:new Date().toISOString()},'Plymouth Argyle','Burton Albion');
  assert.ok(item);assert.equal(item.url,null);
});

test('indexed articles keep a link but never invent a publication date or injury penalty',()=>{
  const seen=new Date(Date.now()-3600e3).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z/,'Z');
  const article=gdeltArticle({title:'Arsenal striker Alex Star ruled out for football match',url:'https://example.org/football',seendate:seen,domain:'example.org'});
  const item=classify(article,'Arsenal','Chelsea');
  assert.equal(item.publishedAt,null);assert.ok(item.indexedAt);assert.equal(item.availabilityEligible,false);assert.equal(item.url,article.url);
  const availability=buildAvailabilityFromNews({homeName:'Arsenal',awayName:'Chelsea',fixtureDate:new Date(Date.now()+864e5).toISOString(),scorers:[{name:'Alex Star',team:'Arsenal',goals:12}],news:[item]});
  assert.equal(availability.usedSignals,0);
});

test('empty primary news triggers a bounded free fallback and preserves provider diagnostics',async t=>{
  const previous=process.env.NEWSAPI_KEY;process.env.NEWSAPI_KEY='test-key';
  t.after(()=>{if(previous===undefined)delete process.env.NEWSAPI_KEY;else process.env.NEWSAPI_KEY=previous;});
  const urls=[];
  t.mock.method(globalThis,'fetch',async (url,options)=>{
    urls.push(String(url));assert.ok(options.signal);
    if(String(url).includes('newsapi.org'))return new Response(JSON.stringify({status:'ok',articles:[]}),{status:200});
    return new Response(JSON.stringify({articles:[{title:'Coventry City football match preview',url:'https://example.org/coventry',domain:'example.org',seendate:new Date().toISOString()}]}),{status:200});
  });
  const r=await getNewsIntelligence('Coventry City','Bristol City');
  assert.equal(r.status,'ready');assert.equal(r.items.length,1);assert.equal(r.providers[1].provider,'GDELT');assert.equal(urls.length,2);
  await getNewsIntelligence('Arsenal','Fulham');
  assert.equal(urls.length,2,'Another match reuses the same news feeds');
});

test('unavailable providers are not reported as a successful empty search',async t=>{
  const future=Date.now()+2*36e5;t.mock.method(Date,'now',()=>future);
  const previous=process.env.NEWSAPI_KEY;process.env.NEWSAPI_KEY='test-key';
  t.after(()=>{if(previous===undefined)delete process.env.NEWSAPI_KEY;else process.env.NEWSAPI_KEY=previous;});
  t.mock.method(globalThis,'fetch',async()=>new Response('{}',{status:503}));
  const r=await getNewsIntelligence('Real Madrid','Barcelona');
  assert.equal(r.status,'temporarily_unavailable');assert.equal(r.items.length,0);assert.equal(r.impact.usedSignals,0);
});
