'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { classify, mentions } = require('../lib/news-intelligence');
const { buildAvailabilityFromNews } = require('../lib/squad-availability');

const article = title => ({ title, description: title, publishedAt: new Date(Date.now() - 3600e3).toISOString() });

test('non-football namesakes, unrelated institutions and other squads cannot enter the report', () => {
  for (const title of ['Santa Clara NFL quarterback ruled out', 'Santa Clara county foster care scores a grant',
    'Instituto Galo of Argentina supports football nutrition research', 'Arsenal Women prepare for a WSL match',
    'Arsenal U21 score three goals in their fixture']) {
    assert.equal(classify(article(title), 'Santa Clara', title.includes('Arsenal') ? 'Arsenal' : 'Instituto'), null, title);
  }
  assert.equal(classify(article('CD Santa Clara striker returns before the Liga Portugal match'), 'Santa Clara', 'Arouca').relevanceVerified, true);
  assert.ok(classify(article('Instituto Cordoba prepare for their next football match'), 'Instituto', 'Estudiantes Rio Cuarto'));
});

test('opponent injury headlines are excluded without roster attribution', () => {
  const item = classify(article('Barcelona striker ruled out against Boca Juniors'), 'Racing Club', 'Boca Juniors');
  assert.equal(item,null);
  assert.equal(classify(article('Barcelona confirm Joan Garcia injury against Racing Club'), 'Racing Club', 'Boca Juniors'), null);
  assert.ok(classify(article('Racing Club of Avellaneda announce team news'), 'Racing Club', 'Boca Juniors'));
});

test('owner profiles, scouting rumors and incidental opponent injury stories are excluded', () => {
  for(const title of ['Brighton owner reveals football prediction business',
    'Manchester City scouting midfielder who scored for Benfica',
    'Federico Valverde sidelined for weeks after tackle in Rayo Vallecano match']) {
    assert.equal(classify(article(title),title.includes('Rayo')?'Rayo Vallecano':'Brighton','Benfica'),null,title);
  }
  assert.equal(classify({...article('Preview: Rayo Vallecano vs Espanyol, team news'),publishedAt:new Date(Date.now()-8*864e5).toISOString()},'Rayo Vallecano','Espanyol'),null);
});

test('news requires full club identity and a valid recent publication date', () => {
  assert.equal(mentions('Manchester United travel to City rivals', 'Manchester City'), false);
  assert.equal(mentions('Racing Club reserve team', 'Racing Club'), false);
  for (const publishedAt of ['', 'invalid', new Date(Date.now()+864e5).toISOString(), new Date(Date.now()-15*864e5).toISOString()]) {
    assert.equal(classify({...article('Boca Juniors team news'), publishedAt}, 'Racing Club', 'Boca Juniors'), null);
  }
});

test('a named scorer and a separate opponent injury cannot create an availability penalty', () => {
  const input = {
    homeName: 'Home FC', awayName: 'Away FC', fixtureDate: new Date(Date.now()+864e5).toISOString(),
    scorers: [{ name: 'Alex Star', team: 'Home FC', goals: 12 }],
    news: [{...article('Home FC prepare for Away FC'), summary: 'Alex Star scored yesterday. Opponent Bob Player is ruled out for three weeks.', teams: ['home']}]
  };
  assert.equal(buildAvailabilityFromNews(input).usedSignals, 0);
  input.news[0].summary = 'Alex Star faces Away FC whose striker Bob Player is ruled out for three weeks.';
  assert.equal(buildAvailabilityFromNews(input).usedSignals, 0);
  input.news = [{...article('Home FC star striker ruled out for three weeks'), teams: ['home']}];
  assert.equal(buildAvailabilityFromNews(input).usedSignals, 0);
});

test('duplicate reports of a roster-matched absence affect a team only once', () => {
  const input = {
    homeName: 'Home FC', awayName: 'Away FC', fixtureDate: new Date(Date.now()+864e5).toISOString(),
    scorers: [{ name: 'Alex Star', team: 'Home FC', goals: 12 }],
    news: [{...article('Home FC striker Alex Star ruled out for three weeks'), teams: ['home']}]
  };
  const once = buildAvailabilityFromNews(input);
  input.news.push({...input.news[0], source:'Another outlet'});
  assert.equal(buildAvailabilityFromNews(input).home.incrementalAttackPct, once.home.incrementalAttackPct);
  assert.equal(buildAvailabilityFromNews(input).usedSignals, 1);
});
