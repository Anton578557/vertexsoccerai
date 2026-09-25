'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveTeamName } = require('../lib/team-aliases');
const { sameTeam } = require('../lib/match-integrity');
const { chooseTeamCandidate, formStats } = require('../lib/base-analysis-v2');
const { num, parseCsv, rowDate, historicalRows, historyContext, leagueCode, teamProfile } = require('../lib/football-data-uk');
const { weatherContext, weatherLooksWrong } = require('../lib/analysis-enhancer');
const { finalizeVertexModelV2 } = require('../lib/vertex-model-v2');
const day = n => new Date(Date.now()-n*864e5).toISOString().slice(0,10);
const csvDate = n => day(n).split('-').reverse().join('/');
const row = (n,home='Racing Club',away='Boca Juniors',hg='2',ag='1') => ({Date:csvDate(n),HomeTeam:home,AwayTeam:away,FTHG:hg,FTAG:ag});

test('reported Russian clubs resolve without matching Racing Santander or youth teams',()=>{
 assert.equal(resolveTeamName('Расинг'),'Racing Club');
 assert.equal(resolveTeamName('Блаублитц'),'Blaublitz Akita');
 assert.equal(resolveTeamName('Албирекс Ниигата'),'Albirex Niigata');
 assert.equal(sameTeam('Racing Club','Racing Santander'),false);
 const candidates=[{strTeam:'Racing Santander'},{strTeam:'Racing Club U21'},{strTeam:'Racing Club'}];
 assert.equal(chooseTeamCandidate(candidates,'Расинг').strTeam,'Racing Club');
 assert.equal(chooseTeamCandidate([{strTeam:'Manchester United'}],'Manchester City'),null);
});

test('CSV competition mapping is country aware and keeps division 2 separate',()=>{
 assert.equal(leagueCode('Argentinian Primera Division','Argentina'),'ARG');
 assert.equal(leagueCode('Peruvian Primera Division','Peru'),null);
 assert.equal(leagueCode('Primera Division','Bolivia'),null);
 assert.equal(leagueCode('Serie A','Brazil'),'BRA');
 assert.equal(leagueCode('2. Bundesliga','Germany'),'D2');
 assert.equal(leagueCode('Japanese J2 League','Japan'),null);
 assert.equal(leagueCode('English League 1','England'),'E2');
 assert.equal(leagueCode('English League 2','England'),'E3');
 assert.equal(leagueCode('League 1','Japan'),null);
});

test('international CSV headers parse and absent event stats stay missing',()=>{
 const rows=parseCsv('Country,Date,Home,Away,HG,AG,HC\nArgentina,01/09/2026,Racing Club,Boca Juniors,0,1,\n');
 assert.equal(rows[0].HomeTeam,'Racing Club');
 assert.equal(num(rows[0],'FTHG'),0);
 assert.equal(num(rows[0],'HC'),null);
 assert.equal(num(rows[0],'AC'),null);
 assert.equal(num({HC:'-1'},'HC'),null);
 assert.equal(teamProfile([row(2),row(3),row(4)],'Racing Club').corners.n,0);
});

test('history excludes future, same-day, missing scores, invalid dates, old and duplicate rows',()=>{
 const rows=[row(2),row(2),row(0),row(-1),row(4,'Racing Club','Boca Juniors',''),row(400),{...row(5),Date:'31/02/2026'}];
 assert.equal(historicalRows(rows).length,1);
 assert.ok(Number.isNaN(rowDate({Date:'31/02/2026'})));
});

test('verified open results recover a forecast without premium providers',()=>{
 const rows=Array.from({length:12},(_,i)=>row(i*5+2));
 const ctx=historyContext(rows,'Racing Club','Boca Juniors');
 assert.equal(ctx.ok,true);
 assert.equal(ctx.homeForm.played,8);
 const a=finalizeVertexModelV2({teams:{home:{name:'Racing Club'},away:{name:'Boca Juniors'}},form:{home:ctx.homeForm,away:ctx.awayForm},advanced:ctx.advanced,leagueContext:ctx.leagueContext,h2h:ctx.h2h});
 assert.ok(a.model?.oneXtwo);
 assert.equal(a.granularModel,undefined);
 assert.equal(historyContext(rows,'Racing Santander','Boca Juniors').ok,false);
 assert.equal(historyContext(rows.map(r=>({...r,Date:csvDate(150)})),'Racing Club','Boca Juniors').ok,false);
});

test('live/extra-time results and wrong-country weather never alter a pre-match model',()=>{
 const event={date:day(1),home:'Racing Club',away:'Boca Juniors',homeScore:2,awayScore:1};
 assert.equal(formStats([{...event,status:'1H'}],'Racing Club').played,0);
 assert.equal(formStats([{...event,status:'FT'}],'Racing Club').played,1);
 assert.equal(weatherLooksWrong({location:'Peru, US'},'Peru'),true);
 assert.equal(weatherContext({tempC:null,windMs:null,humidity:null},new Date()).adjustment,0);
});

test('suspended provider is paused across subsequent calls instead of consuming more quota',async()=>{
 const {apiFootballGet}=require('../lib/api-football-client');
 const old=global.fetch, key=process.env.API_FOOTBALL_KEY; let calls=0;
 process.env.API_FOOTBALL_KEY='test-key';
 global.fetch=async()=>{calls++;return {ok:true,status:200,headers:new Headers(),json:async()=>({errors:{access:'Your account is suspended'}})};};
 try { assert.equal((await apiFootballGet('/teams')).ok,false);assert.equal((await apiFootballGet('/teams')).reason,'account_suspended');assert.equal(calls,1); }
 finally {global.fetch=old;if(key===undefined)delete process.env.API_FOOTBALL_KEY;else process.env.API_FOOTBALL_KEY=key;}
});

test('CSV abbreviations retain full club identities for metadata and context lookups',()=>{
  for(const [input,canonical] of [['Paris SG','Paris Saint-Germain'],['Estudiantes L.P.','Estudiantes La Plata'],['Atl. Tucuman','Atletico Tucuman'],['Ind. Rivadavia','Independiente Rivadavia'],['St. Gilloise','Union Saint-Gilloise'],['St Truiden','Sint-Truiden'],['Nijmegen','NEC Nijmegen'],['Guimaraes','Vitoria Guimaraes'],['Sp Braga','Braga'],['Goztep','Goztepe'],['Amed','Amedspor'],['Amed SK','Amedspor'],['Kalamata F.C.','Kalamata']]) {
    assert.equal(resolveTeamName(input),canonical);assert.equal(sameTeam(input,canonical),true);
  }
  assert.equal(sameTeam('Estudiantes L.P.','Estudiantes Rio Cuarto'),false);
  assert.equal(sameTeam('Vitoria Guimaraes','Vitoria'),false);
});
