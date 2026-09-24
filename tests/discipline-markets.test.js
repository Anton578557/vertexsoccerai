'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {teamProfile,redCardHistory} = require('../lib/football-data-uk');
const {buildVertexModelV2,scoreDistribution,probabilitiesFromDistribution} = require('../lib/vertex-model-v2');
const rows = [
 {HomeTeam:'Arsenal',AwayTeam:'Chelsea',HY:'2',AY:'3',HR:'0',AR:'1'},
 {HomeTeam:'Chelsea',AwayTeam:'Arsenal',HY:'1',AY:'4',HR:'0',AR:'0'},
 {HomeTeam:'Arsenal',AwayTeam:'Fulham',HY:'3',AY:'2',HR:'0',AR:'0'},
 {HomeTeam:'Arsenal',AwayTeam:'Fulham',HY:'99',AY:'',HR:'',AR:'0'},
 {HomeTeam:'Arsenal',AwayTeam:'Fulham',HY:'-1',AY:'2',HR:'-1',AR:'0'}
];
test('event averages use the same paired valid sample; missing counts are not zeros',()=>{
 const p=teamProfile(rows,'Arsenal');
 assert.deepEqual(p.yellowCards,{for:3,against:2,n:3});
 assert.deepEqual(p.redCards,{for:0,against:1/3,n:3});
 assert.equal(p.shots.for,null); assert.equal(p.shots.n,0);
});
test('red-card history distinguishes zero observed dismissals from missing history',()=>{
 assert.deepEqual(redCardHistory(rows,'Arsenal'),{sample:3,matchesWithRed:0,observedFrequency:0,average:0});
 assert.equal(redCardHistory(rows.slice(0,2),'Arsenal'),null);
});
test('handicaps and winning margins agree with the score distribution and complementary outcomes',()=>{
 const m=buildVertexModelV2({teams:{home:{name:'A'},away:{name:'B'}},form:{home:{played:12,avgFor:2.8,avgAgainst:.5,ppg:2.5},away:{played:12,avgFor:.6,avgAgainst:2.2,ppg:.8}}}).model;
 assert.ok(Math.abs(Object.values(m.winningMargins).reduce((a,b)=>a+b,0)-100)<=.4);
 assert.ok(Math.abs(m.winningMargins.homeOne+m.winningMargins.homeTwo+m.winningMargins.homeThreePlus-m.oneXtwo.home)<=.7);
 for(const row of m.handicapLines)assert.ok(Math.abs(row.home+row.away-100)<1e-8);
 for(let i=1;i<m.handicapLines.length;i++)assert.ok(m.handicapLines[i].home>=m.handicapLines[i-1].home);
 assert.ok(Math.abs(m.scoreScenarios.reduce((sum,row)=>sum+row.probability,0)+m.otherScoreProbability-100)<=.3);
});
test('the modal score follows the distribution, not a constant 1–1',()=>{
 const modes=new Set();
 for(const [h,a] of [[.4,.4],[.97,1.75],[3.1,.7],[.7,3.1],[2.6,2.6]]){
  const grid=scoreDistribution(h,a),p=probabilitiesFromDistribution(grid);
  const best=[...grid].sort((x,y)=>y.p-x.p)[0];
  assert.equal(p.best.home,best.home);assert.equal(p.best.away,best.away);assert.equal(p.best.p,best.p);modes.add(`${best.home}-${best.away}`);
  assert.ok(Math.abs(grid.reduce((sum,c)=>sum+c.p,0)-1)<1e-9);
 }
 assert.ok(modes.size>=4);
});
