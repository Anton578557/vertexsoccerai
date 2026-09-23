'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEvent, scoreValue, leagueCode, findUpcoming, enrichEspnAnalysis } = require('../lib/espn-football');
const { normalizeFixture } = require('../lib/sportmonks-history');
const { contextFromHistory, verifiedRows } = require('../lib/verified-history');
const { entityClub, chooseExactClub } = require('../lib/club-directory');
const { resolveTeamName } = require('../lib/team-aliases');
const { sameTeam } = require('../lib/match-integrity');
const { mentions } = require('../lib/news-intelligence');

test('dotted club suffixes work without merging city rivals; River news is not Colombian Millonarios news', () => {
  assert.equal(sameTeam('Luton Town F.C.', 'Luton Town'),true);
  assert.equal(sameTeam('C.D. Tenerife', 'Tenerife'),true);
  assert.equal(sameTeam('Manchester City F.C.', 'Manchester United FC'),false);
  assert.equal(mentions('River Millonarios prepare for Huracán', 'Millonarios'),false);
  assert.equal(mentions('Cuadrado joins Millonarios for his homecoming', 'Millonarios'),true);
  assert.equal(mentions('Millonarios FC welcome River in Bogotá', 'Millonarios'),true);
});

function event(status = 'STATUS_FULL_TIME', completed = true) {
  return { id: '123', date: new Date(Date.now() - 864e5).toISOString(), competitions: [{ status: { type: { name: status, completed, state: completed ? 'post' : 'in' } }, competitors: [
    { homeAway: 'home', team: { id: '1', displayName: 'Nautico' }, score: '2' },
    { homeAway: 'away', team: { id: '2', displayName: 'Sport Recife' }, score: '1' }
  ] }] };
}

test('ESPN admits explicit full time but excludes live, extra time, penalties and absent scores', () => {
  assert.equal(normalizeEvent(event()).regulationVerified, true);
  for (const state of ['STATUS_IN_PROGRESS', 'STATUS_END_OF_EXTRATIME', 'STATUS_FINAL_PEN', 'STATUS_ABANDONED']) {
    const row = normalizeEvent(event(state));
    assert.equal(row.regulationVerified, false);
    assert.equal(verifiedRows([row]).length, 0);
  }
  for (const raw of [null, '', false, -1, 'TBD', {value:null}]) assert.equal(scoreValue(raw), null);
  assert.equal(scoreValue({value:0}), 0);
});

test('Sportmonks uses cumulative regulation score and never mistakes second-half-only for full time', () => {
  const fixture = { id: 9, state: { short_name: 'AET' }, starting_at_timestamp: Date.now()/1000 - 86400,
    participants: [{id:1,name:'Nautico',meta:{location:'home'}},{id:2,name:'Sport Recife',meta:{location:'away'}}],
    scores: [ {participant_id:1,description:'CURRENT',score:{goals:4}}, {participant_id:2,description:'CURRENT',score:{goals:3}},
      {participant_id:1,description:'2ND_HALF',score:{goals:2}}, {participant_id:2,description:'2ND_HALF',score:{goals:2}},
      {participant_id:1,description:'2ND_HALF_ONLY',score:{goals:1}} ] };
  const row = normalizeFixture(fixture);
  assert.equal(row.homeScore, 2); assert.equal(row.awayScore, 2); assert.equal(row.regulationVerified, true);
  fixture.scores = fixture.scores.filter(s => s.description !== '2ND_HALF');
  assert.equal(normalizeFixture(fixture).regulationVerified, false);
  fixture.state.short_name = 'LIVE';
  assert.equal(normalizeFixture(fixture).regulationVerified, false);
});

test('verified history rejects future, stale, invalid and conflicting results; team-only history is no league baseline', () => {
  const rows = Array.from({length:8}, (_, i) => ({...normalizeEvent(event()), id:`m${i}`, date:new Date(Date.now()-(i+1)*864e5).toISOString()}));
  const context = contextFromHistory(rows, 'Nautico', 'Sport Recife', {source:'ESPN'});
  assert.equal(context.ok,true); assert.equal(context.homeForm.played,8); assert.equal(context.leagueContext,null);
  assert.equal(context.history.source,'ESPN');
  assert.equal(verifiedRows([...rows, {...rows[0],homeScore:6}]).length,7);
  assert.equal(verifiedRows([{...rows[0],date:new Date(Date.now()+864e5).toISOString()}]).length,0);
  assert.equal(contextFromHistory(rows.map(r=>({...r,date:new Date(Date.now()-120*864e5).toISOString()})), 'Nautico','Sport Recife').ok,false);
});

test('directory accepts football clubs, refuses people and ambiguous city queries', () => {
  const claim = value => [{mainsnak:{datavalue:{value}}}];
  const club = entityClub({id:'Q123',labels:{en:{value:'Example City FC'},ru:{value:'Экзампл Сити'}},aliases:{es:[{value:'Ciudad Ejemplo'}]},descriptions:{en:{value:'association football club'}},claims:{P13590:claim('456')}});
  assert.equal(club.espnId,'456');
  assert.equal(chooseExactClub([club],'Экзампл Сити'),club);
  assert.equal(chooseExactClub([club],'Ciudad Ejemplo'),club);
  assert.equal(chooseExactClub([club],'Example'),null);
  assert.equal(chooseExactClub([club,{...club,wikidataId:'Q999'}],'Экзампл Сити'),null);
  assert.equal(entityClub({id:'Q55',labels:{en:{value:'A Player'}},descriptions:{en:{value:'football player'}},claims:{P31:claim({id:'Q5'})}}),null);
  assert.equal(entityClub({id:'Q56',labels:{en:{value:'2016–17 CD Tenerife season'}},descriptions:{en:{value:'Spanish football club season'}},claims:{P641:claim({id:'Q2736'})}}),null);
  assert.equal(entityClub({id:'Q57',labels:{en:{value:'A football stadium'}},descriptions:{en:{value:'association football stadium'}},claims:{P641:claim({id:'Q2736'})}}),null);
});

test('reported names and league mapping stay distinct across countries and divisions', () => {
  for (const [input,name] of [['Наутико','Nautico'],['Спорт Ресифи','Sport Recife'],['Медельин','Independiente Medellin'],['Мильонариос','Millonarios'],['Independiente Medellín','Independiente Medellin']]) assert.equal(resolveTeamName(input),name);
  assert.equal(leagueCode('Brazilian Serie B','Brazil'),'bra.2');
  assert.equal(leagueCode('Serie B','Italy'),'ita.2');
  assert.equal(leagueCode('Colombia Categoría Primera A','Colombia'),'col.1');
  assert.equal(leagueCode('Primera Division','Peru'),'per.1');
});

test('upcoming fixture requires exact provider IDs and excludes a live or past match', () => {
  const home={espnId:'1'}, away={espnId:'2'};
  const rows=[{homeId:'2',awayId:'1',date:new Date(Date.now()+864e5).toISOString(),scheduled:true}];
  assert.equal(findUpcoming(rows,home,away),rows[0]);
  assert.equal(findUpcoming([{...rows[0],awayId:'3'}],home,away),null);
  assert.equal(findUpcoming([{...rows[0],scheduled:false}],home,away),null);
});

test('ESPN fallback delivers both teams history and badges through real adapter flow', async () => {
  const original = global.fetch;
  const enabled = process.env.ESPN_FOOTBALL_ENABLED;
  process.env.ESPN_FOOTBALL_ENABLED = 'true';
  global.fetch = async url => ({ ok:true, json:async()=>String(url).includes('/teams') ? {sports:[{leagues:[{teams:[
    {team:{id:'1',displayName:'Náutico',logos:[{href:'https://example.com/1.png'}]}},
    {team:{id:'2',displayName:'Sport Recife',logos:[{href:'https://example.com/2.png'}]}}
  ]}]}]} : {leagues:[{name:'Brazilian Serie B'}], events:Array.from({length:8},(_,i)=>({...event(),id:String(100+i),date:new Date(Date.now()-(i+1)*864e5).toISOString()}))} });
  try {
    const output=await enrichEspnAnalysis({teams:{home:{name:'Nautico',country:'Brazil'},away:{name:'Sport Recife',country:'Brazil'}},fixture:{league:'Brazilian Serie B'},form:{home:{played:0},away:{played:0}},sourceStatus:{}});
    assert.equal(output.form.home.played,8); assert.equal(output.form.away.played,8);
    assert.equal(output.teams.home.badge,'https://example.com/1.png');
    assert.equal(output.sourceStatus.primaryFootball,'ESPN');
    assert.equal(output.history.source,'ESPN');
  } finally {global.fetch=original; if(enabled === undefined) delete process.env.ESPN_FOOTBALL_ENABLED; else process.env.ESPN_FOOTBALL_ENABLED=enabled;}
});
