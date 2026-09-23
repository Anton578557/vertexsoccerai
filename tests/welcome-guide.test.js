'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(read = async () => ({data:null,error:null})) {
  const timers = [], writes = [], storage = new Map(), events = {};
  let shown = 0;
  const dialog = {
    open:false, innerHTML:'', scrollTop:0,
    setAttribute(){}, addEventListener(name,callback){ events[name]=callback; },
    querySelector(){return {focus(){}};},
    showModal(){this.open=true;shown++;}, close(){this.open=false;}
  };
  const window = {VertexI18n:{getLanguage:()=> 'ru'},VertexResponsibleContent:()=>({title:'Используйте вероятности ответственно',lead:'Ответственное использование',sections:[['Нет гарантии','Даже вероятность 70% может не реализоваться.']],warning:'Vertex никогда не требует делать ставку.'})};
  const db = {from(){return {select(){return {eq(){return {maybeSingle:read};}};},async upsert(data){writes.push(data);return {error:null};}};}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../welcome-guide.js'),'utf8'),{
    window, Date, console, setTimeout:fn=>timers.push(fn),
    document:{addEventListener(){},createElement:()=>dialog,body:{appendChild(){}}},
    localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)}
  });
  return {guide:window.VertexGuide,db,dialog,timers,writes,shown:()=>shown,click:action=>events.click({target:{closest:()=>({dataset:{guide:action}})}})};
}

test('new authenticated user gets both guide steps and completion is saved to that account',async()=>{
  const s=setup();
  s.guide.onSession(s.db,{id:'new-member'});
  await s.timers.shift()();
  assert.equal(s.dialog.open,true);
  assert.match(s.dialog.innerHTML,/Ваш первый матч/);
  await s.click('next');
  assert.match(s.dialog.innerHTML,/Используйте вероятности ответственно/);
  await s.click('done');
  assert.equal(s.dialog.open,false);
  assert.equal(s.writes[0].user_id,'new-member');
  assert.ok(Number.isFinite(Date.parse(s.writes[0].onboarding_completed_at)));
  s.guide.onSession(s.db,{id:'new-member'});
  assert.equal(s.timers.length,0);
  s.guide.onSession(s.db,null);
  s.guide.onSession(s.db,{id:'new-member'});
  await s.timers.shift()();
  assert.equal(s.shown(),1);
});

test('completed guide stays closed across devices and remains manually available',async()=>{
  const s=setup(async()=>({data:{onboarding_completed_at:'2026-09-23T12:00:00Z'},error:null}));
  s.guide.onSession(s.db,{id:'returning-member'});
  await s.timers.shift()();
  assert.equal(s.shown(),0);
  s.guide.open();
  assert.equal(s.shown(),1);
});

test('sign-out during completion lookup cannot open a stale account guide',async()=>{
  let resolve;
  const s=setup(()=>new Promise(done=>{resolve=done;}));
  s.guide.onSession(s.db,{id:'leaving-member'});
  const pending=s.timers.shift()();
  s.guide.onSession(s.db,null);
  resolve({data:null,error:null});
  await pending;
  assert.equal(s.shown(),0);
});
