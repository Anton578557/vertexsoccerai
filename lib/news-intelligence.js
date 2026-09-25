'use strict';

const { boundedFetch: fetch } = require('./analysis-budget');

const { cachedProviderCall,recentNewsArchive } = require('./provider-cache');
const { providerAliases, resolveTeamName } = require('./team-aliases');

function clean(value, max = 420) {
  return String(value || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalize(value) {
  return clean(value, 1000).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function cacheKeyPart(value) {
  return normalize(value).replace(/\s+/g, '-').slice(0, 80) || 'unknown';
}

function firstSentence(value, max = 190) {
  const text = clean(value, 500).replace(/\[(?:Removed|Deleted)\]/gi, '').trim();
  if (!text) return '';
  const sentence = text.match(/^(.{30,220}?[.!?])(?:\s|$)/)?.[1] || text;
  return sentence.length > max ? `${sentence.slice(0, max - 1).trim()}…` : sentence;
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function isoDate(date) { return new Date(date).toISOString().slice(0, 10); }

async function fetchJson(url, options = {}, timeoutMs = 3500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) { const error = new Error('News upstream unavailable'); error.status = response.status; throw error; }
    return response.json();
  } finally { clearTimeout(timer); }
}

function newsNames(team) {
  const name = resolveTeamName(team);
  const curated = {'Manchester City':['Man City'],'Manchester United':['Man United','Man Utd'],
    'Brighton':['Brighton and Hove Albion','Brighton & Hove Albion'],
    'Plymouth Argyle':['Plymouth'],'Wolverhampton Wanderers':['Wolves']};
  // Never widen a club to an ambiguous city, e.g. Manchester, Milan or Madrid.
  return [...new Set([name, ...(curated[name] || []), ...providerAliases(name).filter(alias=>normalize(alias).split(' ').length>=2)])]
    .slice(0,4).map(value=>clean(value,60).replace(/["()]/g,''));
}

function mentions(text, team) {
  const haystack = normalize(text);
  const needle = normalize(resolveTeamName(team));
  if (!haystack || !needle) return false;
  if (!newsNames(team).some(name=>(` ${haystack} `).includes(` ${normalize(name)} `))) return false;
  // Racing Club is also used for clubs outside Argentina in news headlines.
  if (needle === 'racing club') return /\b(avellaneda|argentina|argentine|argentinian|boca juniors)\b/.test(haystack);
  // Millonarios is also River Plate's nickname; do not import River team news.
  if (needle === 'millonarios' && /\b(river|huracan)\b/.test(haystack) && !/\b(bogota|colombia|colombian|millonarios fc)\b/.test(haystack)) return false;
  if (needle === 'santa clara' && !/\b(cd santa clara|santa clara (?:fc|football|soccer)|azores|acores|primeira liga|liga portugal|benfica|arouca|sporting cp|porto)\b/.test(haystack)) return false;
  if (needle === 'instituto' && (!/\b(cordoba|alta cordoba|liga profesional|argentina|argentine|instituto (?:ac|atletico))\b/.test(haystack) || /\b(instituto galo|ciencias|nutrition|nutricion|instituto leao)\b/.test(haystack))) return false;
  return true;
}

function footballContext(body, teamNames) {
  const text = normalize(body);
  if (/\b(nfl|nba|nhl|mlb|touchdown|quarterback|long snapper|super bowl|rugby|netball|basketball|baseball|american football|foster care|county council|medical sciences)\b/.test(text)) return false;
  const youth = /\b(women|womens|wsl|femenin\w*|frauen|reserve|reserves|youth|u ?(?:17|18|19|20|21|23)|under ?(?:17|18|19|20|21|23))\b/;
  if (youth.test(text) && !youth.test(normalize(teamNames.join(' ')))) return false;
  return /\b(football|soccer|striker|midfielder|defender|goalkeeper|winger|goals?|scor\w*|kickoff|kick off|lineups?|line ups?|starting xi|team news|premier league|bundesliga|laliga|la liga|serie a|primeira liga|liga portugal|mls|j league|copa|champions league|europa league|relegation|derby|pitch|penalt\w*|match\w*|fixture\w*)\b/.test(text);
}

function classify(article, homeName, awayName) {
  const indexedOnly = article.provider === 'GDELT' && !article.publishedAt;
  const published = new Date(article.publishedAt || (indexedOnly ? article.indexedAt : '') || '').getTime();
  if (!Number.isFinite(published) || published > Date.now() || Date.now() - published > 14 * 864e5) return null;
  const title = clean(article.title, 220);
  const description = clean(article.description, 420);
  const body = `${title} ${description}`;
  if (!footballContext(body, [homeName, awayName])) return null;
  const lower = body.toLowerCase();
  const teams = [mentions(body, homeName) ? 'home' : null, mentions(body, awayName) ? 'away' : null].filter(Boolean);
  if (!teams.length) return null;
  if (!mentions(title,homeName) && !mentions(title,awayName)) return null;
  if (/\b(owner|billionaire|starlizard|betting firm|share price|stock market)\b/.test(lower)) return null;

  const transfer = /transfer|signing|signs|bid|fee|deal|linked with|target|rumou?r|scouting|keeping tabs|interested in/.test(lower);
  const negativeStrong = /ruled out|will miss|set to miss|out for|sidelined|suspended|suspension|match ban|banned|unavailable|surgery|fracture|injured|injury|absence/.test(lower);
  const negativeSoft = /doubt|doubtful|fitness concern|late test|late fitness test|race against time|illness|questionable|50-50/.test(lower);
  const positiveStrong = /returns? from injury|back in training|declared fit|cleared to play|available again|recovered|fit again/.test(lower);
  const lineup = /line-?up|starting xi|team news|preview|rotation|rested|availability/.test(lower);
  if (transfer && !lineup) return null;
  // Injury articles often mention a club only as the injured player's opponent.
  // Without roster attribution, admit only an explicit club-led headline.
  const lead = ` ${normalize(title).split(' ').slice(0,6).join(' ')} `;
  if ((negativeStrong || negativeSoft || positiveStrong) && !teams.some(side => mentions(lead,side === 'home' ? homeName : awayName))) return null;

  let impact = 0;
  let signal = 'context';
  if (!transfer && negativeStrong) { impact = -0.035; signal = 'negative'; }
  else if (!transfer && negativeSoft) { impact = -0.018; signal = 'negative'; }
  else if (!transfer && positiveStrong) { impact = 0.025; signal = 'positive'; }
  else if (lineup) signal = 'lineup';
  else if (transfer) signal = 'transfer';

  const ageHours = Math.max(0, (Date.now() - published) / 36e5);
  if (/\bpreview\b/.test(lower) && ageHours > 72) return null;
  const recency = ageHours <= 24 ? 4 : ageHours <= 72 ? 3 : ageHours <= 168 ? 2 : 1;
  const actionable = Math.abs(impact) > 0 ? 5 : lineup ? 3 : transfer ? -3 : 1;
  const importance = actionable + recency + (mentions(title, homeName) || mentions(title, awayName) ? 2 : 0);
  const summary = firstSentence(description) || firstSentence(title);
  if (!summary) return null;

  // Keyword matching cannot attribute an injury to a team's player. Keep the
  // article as context; roster-backed availability is handled separately.
  let url = null;
  try { const parsed = new URL(article.url); if (['https:','http:'].includes(parsed.protocol) && !parsed.username && !parsed.password) url=parsed.href; } catch (_) {}
  return { title, summary, url, source: article.source?.name || 'News', publishedAt: article.publishedAt || null,
    indexedAt:indexedOnly ? article.indexedAt : null, availabilityEligible:!indexedOnly,
    teams, signal:indexedOnly?'context':signal, impact: 0, importance, relevanceVerified: true };
}

function gdeltArticle(row) {
  const seen = String(row.seendate || '').replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z');
  return {title:row.title,description:'',url:row.url,source:{name:row.domain || 'GDELT'},
    provider:'GDELT',publishedAt:null,indexedAt:seen};
}

const retryAfter = new Map();
async function newsSource(provider, load) {
  if ((retryAfter.get(provider)?.until || 0) > Date.now()) return {provider,status:retryAfter.get(provider).status,articles:[]};
  try {
    const articles=await load();
    return {provider,status:'ok',articles};
  } catch(error) {
    const reason=error.status?`http_${error.status}`:/abort|timeout/i.test(error.name || error.message)?'timeout':error instanceof SyntaxError?'invalid_response':'upstream_error';
    const status=error.status===429?'quota_exhausted':[401,403,426].includes(error.status)?'access_limited':'temporarily_unavailable';
    if(status!=='temporarily_unavailable') retryAfter.set(provider,{until:Date.now()+15*60e3,status});
    return {provider,status,reason,articles:[]};
  }
}

async function sharedNewsSource(provider,loader) {
  // At most one feed request per hour across all club pairings; failures cool
  // down briefly rather than triggering a request for every analysis.
  const bucket=Math.floor(Date.now()/36e5);
  const result=await cachedProviderCall({cacheKey:`news:feed:v1:${provider}:${bucket}`,provider:'Football news feed',
    ttlSeconds:300,staleSeconds:0,loader:()=>newsSource(provider,loader)});
  if(!result.cacheHit && ['ok','quota_exhausted','access_limited'].includes(result.payload?.status)) {
    const {setProviderCache}=require('./provider-cache');
    await setProviderCache(`news:feed:v1:${provider}:${bucket}`,'Football news feed',result.payload,3600);
  }
  return result.payload || {provider,status:'temporarily_unavailable',articles:[]};
}

async function getNewsIntelligence(homeName, awayName) {
  const pair = [cacheKeyPart(homeName), cacheKeyPart(awayName)].join(':');
  const empty={items:[],impact:{home:0,away:0,usedSignals:0},status:'temporarily_unavailable',providers:[]};
  try {
    const {payload}=await cachedProviderCall({cacheKey:`news:intelligence:v9:${pair}`,provider:'Football news',
      ttlSeconds:900,staleSeconds:0,loader:async()=>{
        const archivedPromise=recentNewsArchive().catch(()=>[]);
        const primary=process.env.NEWSAPI_KEY ? await sharedNewsSource('NewsAPI',async()=>{
          const params=new URLSearchParams({q:'soccer OR "Premier League" OR "Champions League" OR "La Liga" OR Bundesliga OR "Serie A" OR "football match"',searchIn:'title,description',language:'en',sortBy:'publishedAt',
            pageSize:'100',from:isoDate(Date.now()-14*864e5)});
          const data=await fetchJson(`https://newsapi.org/v2/everything?${params}`,{headers:{'X-Api-Key':process.env.NEWSAPI_KEY}});
          if(data.status!=='ok' || !Array.isArray(data.articles)) throw new Error('Invalid news response');
          return data.articles;
        }):{provider:'NewsAPI',status:'not_configured',articles:[]};
        const select=articles=>articles.map(article=>classify(article,homeName,awayName)).filter(item=>item && item.importance>=3);
        let candidates=select(primary.articles);
        const providers=[{provider:primary.provider,status:primary.status,reason:primary.reason,received:primary.articles.length,accepted:candidates.length}];
        if(!candidates.length) {
          const archived=await archivedPromise;
          candidates=archived.map(item=>{
            const result=classify({title:item.title,description:item.summary,publishedAt:item.publishedAt,url:item.url,source:{name:item.source}},homeName,awayName);
            return result?{...result,availabilityEligible:false,fromArchive:true,cachedAt:item.cachedAt}:null;
          }).filter(Boolean);
          if(candidates.length) providers.push({provider:'News archive',status:'ok',accepted:candidates.length,received:archived.length});
        }
        // Free, bounded fallback. An indexing date is NOT a publication date;
        // these articles remain context and cannot create injury adjustments.
        if(!candidates.length) {
          const fallback=await sharedNewsSource('GDELT',async()=>{
            const params=new URLSearchParams({query:'(soccer OR "premier league" OR "champions league" OR bundesliga) sourcelang:english',
              mode:'artlist',format:'json',timespan:'7d',maxrecords:'100',sort:'datedesc'});
            const data=await fetchJson(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`,{},4500);
            if(!Array.isArray(data.articles)) throw new Error('Invalid news response');
            return data.articles.map(gdeltArticle);
          });
          candidates=select(fallback.articles);
          providers.push({provider:fallback.provider,status:fallback.status,reason:fallback.reason,received:fallback.articles.length,accepted:candidates.length});
        }
        candidates.sort((a,b)=>b.importance-a.importance || Date.parse(b.publishedAt || b.indexedAt)-Date.parse(a.publishedAt || a.indexedAt));
        const seen=new Set(), items=[];
        for(const item of candidates) {
          const key=normalize(item.title).slice(0,90);
          if(!key || seen.has(key)) continue;
          seen.add(key);items.push(item);if(items.length>=6) break;
        }
        return {...empty,items,providers,checkedAt:new Date().toISOString(),
          status:items.length?'ready':providers.some(p=>p.status==='ok')?'no_relevant_news':'temporarily_unavailable',
          partial:providers.some(p=>p.status!=='ok')};
      }});
    return payload || empty;
  } catch (_) {return {...empty,checkedAt:new Date().toISOString()};}
}

module.exports = { getNewsIntelligence, classify, mentions, footballContext, newsNames, gdeltArticle };
