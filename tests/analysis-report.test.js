'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { finalizeVertexModelV2 } = require('../lib/vertex-model-v2');

function render(language, analysis) {
  const output = { innerHTML: '', dataset: {} };
  const window = { location: {origin:'https://test.invalid'}, VertexI18n:{getLanguage:()=>language} };
  const context = {
    window, URL, Intl, Date, console, CustomEvent: class {},
    localStorage: {getItem:()=>null},
    document: {readyState:'loading',querySelector:()=>({}),addEventListener(){},dispatchEvent(){},getElementById:(id)=>id==='analysisResult'?output:null}
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../analysis-ui-v4.js'),'utf8'),context);
  window.VertexAnalysisUI.acceptAnalysis(analysis,{persist:false});
  return output.innerHTML;
}
function sample() {
  return finalizeVertexModelV2({
    teams:{home:{name:'Home <script>alert(1)</script>'},away:{name:'Away'}},fixture:{},
    form:{home:{played:8,avgFor:1.8,avgAgainst:1.1,ppg:1.7},away:{played:8,avgFor:1.1,avgAgainst:1.5,ppg:1.2}}
  });
}

test('report renders all five views, safe text and valid estimates in RU/EN/ES', () => {
  for (const language of ['ru','en','es']) {
    const html = render(language,sample());
    assert.equal((html.match(/data-market-tab=/g)||[]).length,5);
    assert.equal((html.match(/data-market-panel=/g)||[]).length,5);
    assert.equal((html.match(/class="v8-score-card"/g)||[]).length,5);
    assert.equal((html.match(/aria-pressed="true"/g)||[]).length,1);
    assert.ok(!/NaN|undefined|<script>/.test(html));
    assert.match(html,/&lt;script&gt;/);
    assert.match(html,/5\.5/);
    assert.match(html,/Vertex Model 2\.2/);
  }
});

test('no-data report never presents missing goal rates as zero or fabricated probabilities', () => {
  const analysis = sample(); analysis.model=null; analysis.form={home:{played:0,avgFor:null,avgAgainst:null,ppg:null},away:{played:0}};
  const html=render('ru',analysis);
  assert.match(html,/Прогноз не выдан/);
  assert.ok(!/data-market-tab|0\.00|NaN|undefined/.test(html));
  assert.match(html,/Проверьте названия/);
});

test('verified history and crest fallback are visible without unsafe HTML', () => {
 const a=sample();
 a.teams.away.badge='https://example.org/crest.png';
 a.history={home:[{date:'2026-09-20',home:'Racing Club',away:'Boca Juniors',homeScore:1,awayScore:0}],away:[]};
 const html=render('ru',a);
 assert.match(html,/Матчи, использованные в расчёте/);
 assert.match(html,/Football-Data.co.uk/);
 assert.match(html,/v9-badge-fallback/);
 assert.match(html,/data-team-badge/);
 assert.ok(!html.includes('<script>'));
});
