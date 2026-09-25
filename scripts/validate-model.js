'use strict';
// node scripts/validate-model.js .audit-data docs/model-validation-2026-09-25.json
// Public results only. Every feature uses strictly earlier calendar dates.
// Fit on training; choose on validation; report the held-out period once.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {historyContext,historicalRows,rowDate,num,buildGranularFromRows}=require('../lib/football-data-uk');
const {buildVertexModelV2}=require('../lib/vertex-model-v2');
const {countOver}=require('../lib/count-distribution');
const columns=['Date','HomeTeam','AwayTeam','FTHG','FTAG','HC','AC','HY','AY','HS','AS','HST','AST'];
const baseline={strengthExponent:0.5,rho:-0.06};
const candidates=[0.35,0.5,0.75,1].flatMap(strengthExponent=>[-0.1,-0.06,0].map(rho=>({strengthExponent,rho})));
const split=time=>time<Date.parse('2026-02-01')?'training':time<Date.parse('2026-05-01')?'validation':'holdout';
const brier=(p,y)=>p.reduce((s,v,i)=>s+(v-Number(i===y))**2,0);
const aggregate=values=>values.length?Number((values.reduce((s,v)=>s+v,0)/values.length).toFixed(6)):null;
const samples=[],datasets=[];
for(const file of fs.readdirSync(process.argv[2]).filter(f=>/^[A-Z0-9]+\.json$/.test(f))) {
  const raw=fs.readFileSync(path.join(process.argv[2],file),'utf8');
  const rows=JSON.parse(raw).map(a=>Object.fromEntries(columns.map((c,i)=>[c,a[i]])));
  const targets=historicalRows(rows,new Date(),760).filter(r=>rowDate(r)>=Date.parse('2025-10-01'));
  const code=file.replace('.json','');
  datasets.push({code,rows:rows.length,sha256:crypto.createHash('sha256').update(raw).digest('hex')});
  for(const target of targets) {
    const cutoff=new Date(rowDate(target)),ctx=historyContext(rows,target.HomeTeam,target.AwayTeam,cutoff);
    if(!ctx.ok || (ctx.leagueContext?.sample || 0)<30)continue;
    const a={teams:{home:{name:target.HomeTeam},away:{name:target.AwayTeam}},fixture:{date:cutoff.toISOString()},
      form:{home:ctx.homeForm,away:ctx.awayForm},advanced:ctx.advanced,leagueContext:ctx.leagueContext,h2h:ctx.h2h};
    const y=num(target,'FTHG')>num(target,'FTAG')?0:num(target,'FTHG')===num(target,'FTAG')?1:2;
    const granular=buildGranularFromRows(rows,target.HomeTeam,target.AwayTeam,{fixtureDate:cutoff});
    a.granularModel=granular;
    const predictions=candidates.map(c=>{
      const m=buildVertexModelV2(a,c).model,p=['home','draw','away'].map(k=>m.oneXtwo[k]),sum=p.reduce((s,v)=>s+v,0);
      return {brier:brier(p.map(v=>v/sum),y),correct:p.indexOf(Math.max(...p))===y,score:m.correctScore};
    });
    const count=Object.fromEntries([['corners','HC','AC',9.5],['yellow','HY','AY',4.5]].map(([key,h,away,line])=>{
      const mean=granular[key==='yellow'?'cards':key]?.expectedTotal;
      const numbers=[num(target,h),num(target,away)];
      return [key,Number.isFinite(mean)&&numbers.every(Number.isInteger)?{mean,y:Number(numbers[0]+numbers[1]>line),line}:null];
    }));
    samples.push({code,date:cutoff.toISOString().slice(0,10),split:split(+cutoff),predictions,count,
      baselineBrier:brier([ctx.leagueContext.homeWinRate,ctx.leagueContext.drawRate,ctx.leagueContext.awayWinRate],y)});
  }
  process.stderr.write(`${code}: ${samples.filter(s=>s.code===code).length} chronologically replayed matches\n`);
}
const baseIndex=candidates.findIndex(c=>c.strengthExponent===baseline.strengthExponent && c.rho===baseline.rho);
const score=(index,batch)=>aggregate(batch.map(s=>s.predictions[index].brier));
const training=samples.filter(s=>s.split==='training'),validation=samples.filter(s=>s.split==='validation');
const trained=candidates.map((parameters,index)=>({parameters,index,trainingBrier:score(index,training)}))
  .filter(c=>c.trainingBrier!=null).sort((a,b)=>a.trainingBrier-b.trainingBrier)[0];
const improved=trained && validation.length>=300 && score(trained.index,validation)<score(baseIndex,validation)-0.002;
const selected=improved?trained.index:baseIndex;
const countFits={};
for(const market of ['corners','yellow']) {
  const error=(k,batch)=>aggregate(batch.filter(s=>s.count[market]).map(s=>{const c=s.count[market];return(countOver(c.mean,c.line,k)-c.y)**2;}));
  const fitted=[null,4,8,16,32].map(dispersion=>({dispersion,trainingBrier:error(dispersion,training)})).filter(c=>c.trainingBrier!=null).sort((a,b)=>a.trainingBrier-b.trainingBrier)[0];
  const accept=fitted && validation.filter(s=>s.count[market]).length>=200 && error(fitted.dispersion,validation)<error(null,validation)-0.001;
  const dispersion=accept?fitted.dispersion:null;
  countFits[market]={dispersion,selectedOnValidation:Boolean(accept),trainingCandidate:fitted,
    periods:Object.fromEntries(['training','validation','holdout'].map(period=>{const batch=samples.filter(s=>s.split===period);return[period,{n:batch.filter(s=>s.count[market]).length,poissonBrier:error(null,batch),selectedBrier:error(dispersion,batch)}];}))};
}
const report={generatedAt:new Date().toISOString(),source:'Football-Data.co.uk results and event-statistics CSVs; no odds used',
  protocol:{training:'2025-10-01 to 2026-01-31',validation:'2026-02-01 to 2026-04-30',holdout:'2026-05-01 onwards',
    features:'Only results before each target day; previous 365 days; no historical news, weather, injuries or lineups reconstructed.',
    candidateSelection:'Best training Brier; promote only if validation improves by at least 0.002 (goals) / 0.001 (counts). Holdout not used to pick parameters.'},
  datasets,total:samples.length,selectedParameters:candidates[selected],promotedOnValidation:Boolean(improved),trainingCandidate:trained,
  goalPeriods:Object.fromEntries(['training','validation','holdout'].map(period=>{const batch=samples.filter(s=>s.split===period);return[period,{
    n:batch.length,baselineModelBrier:score(baseIndex,batch),selectedModelBrier:score(selected,batch),leagueFrequencyBrier:aggregate(batch.map(s=>s.baselineBrier)),
    selectedTopOutcomeAccuracy:aggregate(batch.map(s=>Number(s.predictions[selected].correct))),
    scoreModes:Object.fromEntries([...new Set(batch.map(s=>s.predictions[selected].score))].map(value=>[value,batch.filter(s=>s.predictions[selected].score===value).length]))}];})),
  byLeague:Object.fromEntries(datasets.map(({code})=>{const batch=samples.filter(s=>s.code===code && s.split==='holdout');return[code,{n:batch.length,baselineModelBrier:score(baseIndex,batch),selectedModelBrier:score(selected,batch),leagueFrequencyBrier:aggregate(batch.map(s=>s.baselineBrier))}];})),
  countFits,caveat:'Retrospective numerical-model validation is not a live forecast accuracy record. Results vary by league. No profit or superiority claim.'};
fs.writeFileSync(process.argv[3],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,selected:report.selectedParameters,goalPeriods:report.goalPeriods,countFits},null,2));
