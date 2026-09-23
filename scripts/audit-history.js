'use strict';
// Usage: node scripts/audit-history.js /path/to/downloaded/ARG.csv
// Walk-forward check of the numerical model only, without unavailable historical news/weather.
const fs=require('node:fs');
const {parseCsv,historicalRows,historyContext,rowDate,num}=require('../lib/football-data-uk');
const {buildVertexModelV2}=require('../lib/vertex-model-v2');
const rows=historicalRows(parseCsv(fs.readFileSync(process.argv[2],'utf8')));
const targets=rows.slice(-200);const values=[];
for(const target of targets){
 const cutoff=new Date(rowDate(target));
 const ctx=historyContext(rows,target.HomeTeam,target.AwayTeam,cutoff);
 if(!ctx.ok) continue;
 const {model}=buildVertexModelV2({teams:{home:{name:target.HomeTeam},away:{name:target.AwayTeam}},fixture:{date:cutoff.toISOString()},form:{home:ctx.homeForm,away:ctx.awayForm},advanced:ctx.advanced,leagueContext:ctx.leagueContext,h2h:ctx.h2h});
 if(!model)continue;
 const p=['home','draw','away'].map(k=>model.oneXtwo[k]/100);const total=p.reduce((a,b)=>a+b,0);p.forEach((_,i)=>p[i]/=total);
 const baseline=[ctx.leagueContext.homeWinRate,ctx.leagueContext.drawRate,ctx.leagueContext.awayWinRate];
 const actual=num(target,'FTHG')>num(target,'FTAG')?0:num(target,'FTHG')===num(target,'FTAG')?1:2;
 const brier=probs=>probs.reduce((s,v,i)=>s+(v-Number(i===actual))**2,0);
 const pick=probs=>probs.indexOf(Math.max(...probs));
 values.push({date:target.Date,brier:brier(p),baselineBrier:brier(baseline),correct:pick(p)===actual,baselineCorrect:pick(baseline)===actual});
}
const avg=key=>values.reduce((s,v)=>s+Number(v[key]),0)/values.length;
console.log(JSON.stringify({evaluated:values.length,first:values[0]?.date,last:values.at(-1)?.date,brier:avg('brier'),baselineBrier:avg('baselineBrier'),topOutcomeHitRate:avg('correct'),baselineHitRate:avg('baselineCorrect'),caveat:'One-league retrospective walk-forward check, numeric model only. Not a live forecast record or proof of general accuracy.'},null,2));
