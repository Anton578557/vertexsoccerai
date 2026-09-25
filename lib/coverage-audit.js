'use strict';

const {withBudget}=require('./analysis-budget');
const {cachedProviderCall}=require('./provider-cache');
const {fetchSeason,seasonCode,historicalRows,rowDate,historyContext}=require('./football-data-uk');
const {buildVertexModelV2}=require('./vertex-model-v2');
const {resolveTeamName}=require('./team-aliases');
const {buildAnalysisCore}=require('../api/analyze');
const {requestFootballResource}=require('./bsd-history');
const {enrichMatchContext,normalizeLineups}=require('./match-context');

// A finite diagnostics matrix, not an unauthenticated forecast endpoint.
// No caller-supplied teams, dates, URLs or model outputs; no prediction writes.
const LEAGUES={E0:'England · Premier League',E1:'England · Championship',SP1:'Spain · La Liga',
  D1:'Germany · Bundesliga',I1:'Italy · Serie A',F1:'France · Ligue 1',N1:'Netherlands · Eredivisie',
  P1:'Portugal · Primeira Liga',B1:'Belgium · Pro League',SC0:'Scotland · Premiership',G1:'Greece · Super League',
  T1:'Turkey · Süper Lig',BRA:'Brazil · Série A',ARG:'Argentina · Primera División',JPN:'Japan · J1'};
const DIRECTORY={E0:['England',['Premier League']],E1:['England',['Championship']],SP1:['Spain',['La Liga','LaLiga']],
  D1:['Germany',['Bundesliga']],I1:['Italy',['Serie A']],F1:['France',['Ligue 1']],N1:['Netherlands',['Eredivisie']],
  P1:['Portugal',['Primeira Liga','Liga Portugal']],B1:['Belgium',['Pro League','Jupiler Pro League']],
  SC0:['Scotland',['Premiership']],G1:['Greece',['Super League','Super League 1']],T1:['Turkey',['Super Lig','Süper Lig']],
  BRA:['Brazil',['Serie A','Série A','Brasileirao Serie A']],ARG:['Argentina',['Liga Profesional','Primera Division']],
  JPN:['Japan',['J1 League','J.League','J1'] ]};

async function upcomingCases(code) {
  const [country,names]=DIRECTORY[code];
  const norm=value=>String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const leagues=await requestFootballResource('leagues',{country,limit:'200',offset:'0'},86400);
  const hits=(leagues.results || []).filter(l=>norm(l.country)===norm(country) && names.some(n=>norm(n)===norm(l.name)) && l.is_women!==true);
  if(leagues.next || hits.length!==1) return [];
  const data=await requestFootballResource('events',{league_id:String(hits[0].id),status:'upcoming',
    date_from:new Date().toISOString().slice(0,10),date_to:new Date(Date.now()+21*864e5).toISOString().slice(0,10),limit:'200',offset:'0'},300);
  if(data.next) return [];
  return (data.results || []).filter(r=>['upcoming','notstarted','scheduled'].includes(r.status) && r.replaced_by==null && r.league_id===hits[0].id &&
    Date.parse(r.event_date)>Date.now() && r.home_team_id && r.away_team_id && r.home_team && r.away_team)
    .sort((a,b)=>Date.parse(a.event_date)-Date.parse(b.event_date)).slice(0,4)
    .map(r=>({HomeTeam:r.home_team,AwayTeam:r.away_team,homeId:r.home_team_id,awayId:r.away_team_id,kickoff:r.event_date,eventId:r.id,mode:'upcoming_fixture'}));
}

function selectCases(rows) {
  const recent=historicalRows(rows).sort((a,b)=>rowDate(b)-rowDate(a));
  const used=new Set(), selected=[];
  for(const r of recent) {
    const key=[r.HomeTeam,r.AwayTeam].sort().join('|');
    if(!used.has(key)) {selected.push(r);used.add(key);}
    if(selected.length===4) break;
  }
  return selected;
}

function historicalCheck(rows,target) {
  const cutoff=new Date(rowDate(target));
  const ctx=historyContext(rows,target.HomeTeam,target.AwayTeam,cutoff);
  const result=buildVertexModelV2({teams:{home:{name:target.HomeTeam},away:{name:target.AwayTeam}},
    fixture:{date:cutoff.toISOString()},form:{home:ctx.homeForm,away:ctx.awayForm},advanced:ctx.advanced,
    leagueContext:ctx.leagueContext,h2h:ctx.h2h});
  const dates=[...(ctx.history?.home || []),...(ctx.history?.away || [])].map(r=>Date.parse(r.date));
  const p=result.model?.oneXtwo;
  return {ready:Boolean(result.model),sample:[ctx.homeForm.played,ctx.awayForm.played],
    noFutureData:dates.every(d=>d<cutoff.getTime()),
    normalized:p ? Math.abs(p.home+p.draw+p.away-100)<=1 : null};
}

async function coverageAudit(code) {
  if(!Object.hasOwn(LEAGUES,code)) return null;
  const {payload}=await cachedProviderCall({cacheKey:`coverage-audit:v3:${code}`,provider:'Vertex Coverage Audit',ttlSeconds:86400,staleSeconds:0,
    loader:async()=>{
      const season=seasonCode(), previous=`${String(Number(season.slice(0,2))-1).padStart(2,'0')}${season.slice(0,2)}`;
      const [archives,upcoming]=await withBudget(8000,()=>Promise.all([
        Promise.all([fetchSeason(code,season),fetchSeason(code,previous)]),upcomingCases(code).catch(()=>[])
      ]));
      const rows=archives.flatMap(a=>a.rows || a || []);
      const targets=selectCases(rows);
      const contract=upcoming[0]?await withBudget(4000,()=>enrichMatchContext({teams:{home:{name:upcoming[0].HomeTeam,bsdId:upcoming[0].homeId},away:{name:upcoming[0].AwayTeam,bsdId:upcoming[0].awayId}},fixture:{date:upcoming[0].kickoff}})):null;
      const checks=await Promise.all(targets.map(async (target,index)=>{
        const input=[target.HomeTeam,target.AwayTeam],start=Date.now();
        try {
          const {analysis:a}=await buildAnalysisCore(...input.map(resolveTeamName),{home:input[0],away:input[1]});
          let historicalLineups=null;
          const event=index===0?(a.history?.home || []).find(r=>/^bsd:\d+$/.test(r.id || '')):null;
          if(event) {
            const id=Number(event.id.slice(4));
            historicalLineups=await withBudget(1500,()=>requestFootballResource(`events/${id}/lineups`,{},86400))
              .then(raw=>({eventId:id,providerStatus:raw.lineup_status,parsedStatus:normalizeLineups(raw,id).status})).catch(()=>null);
          }
          const p=a.model?.oneXtwo;
          return {input,referenceFixtureDate:target.kickoff || new Date(rowDate(target)).toISOString(),mode:target.mode || 'recorded_fixture_pairing',durationMs:Date.now()-start,
            teams:['home','away'].map(side=>({name:a.teams[side].name,resolved:a.teams[side].resolved===true,
              badge:Boolean(a.teams[side].badge),history:a.form[side].played})),
            modelReady:Boolean(a.model),normalized:p ? Math.abs(p.home+p.draw+p.away-100)<=1 : null,
            source:a.sourceStatus?.primaryFootball,coverage:a.marketCoverage?.granular,
            context:{status:a.matchContext?.status,lineups:a.matchContext?.lineups?.status,referee:Boolean(a.matchContext?.referee),
              measuredXg:a.performance?.measuredXg?.available || false},
            collection:a.collection,news:{...a.newsStatus,count:a.news?.length || 0},historicalLineups,backtest:target.mode?null:historicalCheck(rows,target)};
        } catch(error) {return {input,durationMs:Date.now()-start,error:'analysis_failed'};}
      }));
      return {league:LEAGUES[code],code,timestamp:new Date().toISOString(),
        purpose:'Current pipeline checked on four recorded match pairings; historical replay uses only data preceding each match. Diagnostic runs never enter the live forecast record.',
        expected:4,fixtureContextContract:contract?.matchContext || null,checks};
    }});
  return payload;
}
module.exports={coverageAudit,LEAGUES,selectCases,historicalCheck};
