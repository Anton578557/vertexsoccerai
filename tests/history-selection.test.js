'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {contextFromHistory, applyHistory, needsMoreHistory, refreshScheduleContext} = require('../lib/verified-history');
const {sameTeam} = require('../lib/match-integrity');

const history = (n, age=2, source='Provider A') => contextFromHistory(Array.from({length:n},(_,i)=>({
  id:`${source}:${i}`,date:new Date(Date.now()-(age+i*4)*864e5).toISOString(),home:'Leeds',away:'Crystal Palace',
  homeScore:2,awayScore:1,regulationVerified:true
})), 'Leeds United', 'Crystal Palace', {source});

test('a three-match response does not stop fallback search; richer fresh history replaces the whole bundle', () => {
  const analysis = {form:{home:{played:0},away:{played:0}}};
  assert.equal(applyHistory(analysis, history(3)),true);
  assert.equal(needsMoreHistory(analysis),true);
  assert.equal(applyHistory(analysis,history(12,2,'Provider B')),true);
  assert.equal(analysis.form.home.played,8); assert.equal(analysis.advanced.home.sample,12);
  assert.equal(analysis.contextSources.advanced,'Provider B'); assert.equal(analysis.history.source,'Provider B');
  assert.equal(needsMoreHistory(analysis),false);
});

test('larger stale history and insufficient history cannot overwrite fresh selected data', () => {
  const analysis = {form:{}};
  applyHistory(analysis,history(7,2));
  assert.equal(applyHistory(analysis,history(12,40,'Old')),false);
  assert.equal(applyHistory(analysis,history(2,1,'Thin')),false);
  assert.equal(analysis.form.home.played,7);
  assert.equal(analysis.historySelection.candidates[1].reason,'older_than_selected_history');
});

test('new aliases resolve provider abbreviations while reserves remain separate', () => {
  for (const [a,b] of [['Leeds','Leeds United'],['Coventry','Coventry City'],['Ein Frankfurt','Eintracht Frankfurt'],['Vasco','Vasco da Gama'],
    ['Verdy','Tokyo Verdy'],['Chiba','JEF United Chiba'],['Веен','SV Wehen Wiesbaden'],['Хоффенхайм 2','TSG 1899 Hoffenheim II']]) assert.equal(sameTeam(a,b),true,`${a} / ${b}`);
  assert.equal(sameTeam('Hoffenheim II','Hoffenheim'),false);
});

test('rest refers to imminent kickoff; comparisons and distant fixtures have no invented rest bonus', () => {
  const analysis={form:{},fixture:{}};
  applyHistory(analysis,history(8,2));
  refreshScheduleContext(analysis);
  assert.equal(analysis.advanced.home.restDays,null);
  analysis.fixture.date=new Date(Date.now()+864e5).toISOString();
  refreshScheduleContext(analysis);
  assert.ok(Math.abs(analysis.advanced.home.restDays-3)<.001);
  assert.equal(analysis.advanced.home.scheduleVerified,true);
  analysis.fixture.date=new Date(Date.now()+10*864e5).toISOString();
  refreshScheduleContext(analysis);
  assert.equal(analysis.advanced.home.restDays,null);
  assert.equal(analysis.advanced.home.scheduleVerified,false);
});
