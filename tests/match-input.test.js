'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {parse,parts} = require('../match-input');
const {resolveTeamName} = require('../lib/team-aliases');
const {sameTeam} = require('../lib/match-integrity');

test('one-sided ASCII spaces and translated match separators work without splitting club hyphens', () => {
  for (const separator of [' -','- ',' - ','—',' – ',' vs ',' VS. ',' против ',' contra ',' versus ']) {
    assert.deepEqual(parse(`Cambridge United${separator}Wimbledon`),{home:'Cambridge United',away:'Wimbledon'});
  }
  assert.deepEqual(parse('Кембридж Юнайтед -Уимблдон'),{home:'Кембридж Юнайтед',away:'Уимблдон'});
  assert.deepEqual(parse('Paris-Saint-Germain - Saint-Etienne'),{home:'Paris-Saint-Germain',away:'Saint-Etienne'});
  for (const value of ['', 'Cambridge United -', 'Saint-Etienne', 'Arsenal vs Chelsea vs Fulham']) assert.equal(parse(value),null);
  assert.equal(parts('Cambridge United -Уим').at(-1),'Уим');
});

test('reported RU/ES/EN aliases identify exact clubs and preserve similarly named identities', () => {
  for (const [input,name] of [['Кембридж Юнайтед','Cambridge United'],['Уимблдон','AFC Wimbledon'],['Wimbledon','AFC Wimbledon'],['Junior','Atletico Junior'],['Хуньор','Atletico Junior'],['Junior de Barranquilla','Atletico Junior'],['Tomayapo','Real Tomayapo'],['Реал Томаяпо','Real Tomayapo']]) assert.equal(resolveTeamName(input),name);
  assert.equal(sameTeam('Wimbledon FC','AFC Wimbledon'),false);
  assert.equal(sameTeam('Boca Juniors','Junior'),false);
  assert.equal(sameTeam('Cambridge United U21','Cambridge United'),false);
});
