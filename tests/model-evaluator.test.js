'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');

test('event settlement retains known CSV counts when a fallback lacks that statistic',()=>{
  const {mergeFinalCounts}=require('../lib/model-evaluator');
  const first=mergeFinalCounts({homeScore:1,awayScore:0},{corners:0,yellowCards:null},'CSV');
  const second=mergeFinalCounts(first,{corners:null,yellowCards:4},'BSD');
  assert.deepEqual(second.eventCounts,{corners:0,yellowCards:4});
  assert.deepEqual(second.eventSources,{corners:'CSV',yellowCards:'BSD'});
  assert.equal(first.eventCounts.yellowCards,undefined);
});
