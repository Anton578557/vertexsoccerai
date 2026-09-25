'use strict';

const { boundedFetch: fetch } = require('./analysis-budget');

const { createHash } = require('node:crypto');
const { cachedProviderCall } = require('./provider-cache');
const { resolveTeamName } = require('./team-aliases');

const clean = value => String(value || '').replace(/[<>]/g, '').trim().slice(0, 100);
const nameKey = value => clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\((?:football club|футбольный клуб|клуб de fútbol|футбольныи клуб)\)/g, '')
  .replace(/^(?:фк|fc)\s+/u, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const cacheKey = value => createHash('sha256').update(nameKey(value)).digest('hex').slice(0, 24);
const numericId = value => /^\d{1,12}$/.test(String(value || '')) ? String(value) : null;

async function request(params) {
  const url = new URL('https://www.wikidata.org/w/api.php');
  for (const [key, value] of Object.entries({ format: 'json', ...params })) url.searchParams.set(key, value);
  const response = await fetch(url, { signal: AbortSignal.timeout(4500), headers: {
    Accept: 'application/json', 'User-Agent': 'VertexSoccerAI/2.0 (https://vertexsoccerai.com; vertexsoccerai@outlook.com)'
  } });
  if (!response.ok) throw new Error(`Wikidata ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error('Wikidata unavailable');
  return data;
}

function entityClub(entity) {
  const values = property => (entity.claims?.[property] || []).filter(x => x.rank !== 'deprecated').map(x => x.mainsnak?.datavalue?.value);
  const descriptions = Object.values(entity.descriptions || {}).map(x => x.value).join(' ');
  const labelsText = Object.values(entity.labels || {}).map(x => x.value).join(' ');
  const footballClub = values('P31').some(v => v?.id === 'Q476028') || /(?:association football|soccer|football) (?:club|team)|футбольн.{0,12}(?:клуб|команд)|(?:club|equipo).{0,35}(?:fútbol|futebol)/i.test(descriptions);
  const person = values('P31').some(v => v?.id === 'Q5');
  if (!footballClub || person || /american football|rugby|futsal|\bseason\b|сезон|temporada/i.test(`${descriptions} ${labelsText}`)) return null;
  const labels = Object.values(entity.labels || {}).map(x => x.value);
  const aliases = Object.values(entity.aliases || {}).flat().map(x => x.value);
  const name = entity.labels?.en?.value || entity.labels?.es?.value || labels[0];
  if (!name || !/^Q\d+$/.test(entity.id || '')) return null;
  return { name: clean(name), aliases: [...new Set([...labels, ...aliases].map(clean))],
    countryEntity:values('P17').find(v=>/^Q\d+$/.test(v?.id || ''))?.id || null,
    country:/\bEnglish (?:association football|football) club/i.test(descriptions)?'England':/\bScottish (?:association football|football) club/i.test(descriptions)?'Scotland':null,
    wikidataId: entity.id, espnId: numericId(values('P13590')[0]), source: 'Wikidata' };
}

async function searchClubDirectory(query) {
  const input = clean(query);
  if (input.length < 3) return [];
  try {
    const result = await cachedProviderCall({ cacheKey: `club-directory:v3:${cacheKey(input)}`, provider: 'Wikidata', ttlSeconds: 86400, staleSeconds: 7 * 86400,
      loader: async () => {
        const language = /[а-яё]/i.test(input) ? 'ru' : /[áéíóúñü]/i.test(input) ? 'es' : 'en';
        const found = await request({ action: 'wbsearchentities', search: input, language, uselang: 'en', limit: '5', type: 'item' });
        const ids = (found.search || []).map(x => x.id).filter(id => /^Q\d+$/.test(id));
        if (!ids.length) return [];
        const data = await request({ action: 'wbgetentities', ids: ids.join('|'), props: 'labels|aliases|descriptions|claims', languages: 'en|ru|es|pt' });
        const clubs=Object.values(data.entities || {}).map(entityClub).filter(Boolean);
        const countryIds=[...new Set(clubs.map(c=>c.countryEntity).filter(Boolean))];
        if(countryIds.length) {
          const countries=await request({action:'wbgetentities',ids:countryIds.join('|'),props:'labels',languages:'en'}).catch(()=>null);
          for(const club of clubs) club.country ||= countries?.entities?.[club.countryEntity]?.labels?.en?.value || null;
        }
        return clubs;
      } });
    return result.payload || [];
  } catch (_) { return []; }
}

function chooseExactClub(clubs, query) {
  const key = nameKey(query);
  const canonicalKey = nameKey(resolveTeamName(query));
  const hits = clubs.filter(club => [club.name, ...(club.aliases || [])].some(name => nameKey(name) === key || nameKey(resolveTeamName(name)) === canonicalKey));
  // Never turn a city, a surname or a broad query into a guessed club.
  return hits.length === 1 ? hits[0] : null;
}

module.exports = { searchClubDirectory, chooseExactClub, entityClub, nameKey };
