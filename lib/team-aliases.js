'use strict';

function clean(value, max = 100) {
  return String(value || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalize(value) {
  return clean(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const CYR = {
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'
};

function transliterateCyrillic(value) {
  return clean(value).split('').map((char) => {
    const lower = char.toLowerCase();
    if (!(lower in CYR)) return char;
    const out = CYR[lower];
    return char === lower ? out : (out ? out[0].toUpperCase() + out.slice(1) : '');
  }).join('');
}

const clubs = [
  ['Real Madrid', ['реал мадрид', 'реал', 'real madrid cf']],
  ['Barcelona', ['барселона', 'барса', 'фк барселона', 'fc barcelona']],
  ['Atletico Madrid', ['атлетико мадрид', 'атлетико', 'atlético madrid']],
  ['Athletic Bilbao', ['атлетик бильбао', 'атлетик', 'athletic', 'athletic club']],
  ['Sevilla', ['севилья']],
  ['Villarreal', ['вильярреал', 'вильярреаль']],
  ['Real Betis', ['реал бетис', 'бетис']],
  ['Real Sociedad', ['реал сосьедад', 'сосьедад']],
  ['Valencia', ['валенсия']],
  ['Getafe', ['хетафе', 'гетафе']],
  ['Rayo Vallecano', ['райо вальекано', 'райо', 'rayo valekano']],
  ['Espanyol', ['эспаньол', 'эспанол', 'эспаньел', 'rcd espanyol', 'espanol']],
  ['Girona', ['жирона', 'хирона']],
  ['Osasuna', ['осасуна']],
  ['Celta Vigo', ['сельта', 'сельта виго']],
  ['Mallorca', ['мальорка']],
  ['Alaves', ['алавес', 'депортиво алавес']],
  ['Elche', ['эльче', 'элче']],
  ['Levante', ['леванте']],

  ['Manchester City', ['манчестер сити', 'ман сити', 'мс']],
  ['Manchester United', ['манчестер юнайтед', 'ман юнайтед', 'мю']],
  ['Liverpool', ['ливерпуль']],
  ['Arsenal', ['арсенал']],
  ['Chelsea', ['челси']],
  ['Tottenham Hotspur', ['тоттенхэм', 'тоттенхем', 'шпоры', 'tottenham']],
  ['Newcastle United', ['ньюкасл', 'ньюкасл юнайтед']],
  ['Aston Villa', ['астон вилла']],
  ['West Ham United', ['вест хэм', 'вест хем', 'west ham']],
  ['Everton', ['эвертон']],
  ['Brighton', ['брайтон']],
  ['Crystal Palace', ['кристал пэлас', 'кристал пэлас', 'crystal palace']],
  ['Wolverhampton Wanderers', ['вулверхэмптон', 'вулверхемптон', 'wolves']],
  ['Nottingham Forest', ['ноттингем форест', 'ноттингем']],
  ['Fulham', ['фулхэм', 'фулхем']],
  ['Brentford', ['брентфорд']],
  ['Leeds United', ['лидс', 'лидс юнайтед']],

  ['Bayern Munich', ['бавария', 'бавария мюнхен', 'bayern münchen', 'bayern munchen', 'bavaria', 'bayern', 'fc bayern münchen', 'fc bayern munchen', 'bayern munich fc']],
  ['Union Berlin', ['унион', 'унион берлин', '1 fc union berlin', 'fc union berlin']],
  ['Borussia Dortmund', ['боруссия дортмунд', 'дортмунд', 'bvb']],
  ['RB Leipzig', ['рб лейпциг', 'лейпциг']],
  ['Bayer Leverkusen', ['байер', 'байер леверкузен', 'леверкузен']],
  ['Eintracht Frankfurt', ['айнтрахт', 'айнтрахт франкфурт']],

  ['Inter Milan', ['интер', 'интер милан', 'internazionale']],
  ['AC Milan', ['милан', 'milan', 'ac milan']],
  ['Juventus', ['ювентус', 'юве']],
  ['Napoli', ['наполи']],
  ['Roma', ['рома']],
  ['Lazio', ['лацио']],
  ['Atalanta', ['аталанта']],
  ['Fiorentina', ['фиорентина']],

  ['Paris Saint-Germain', ['псж', 'пари сен жермен', 'пари сен-жермен', 'psg']],
  ['Marseille', ['марсель', 'олимпик марсель']],
  ['Lyon', ['лион', 'олимпик лион']],
  ['Monaco', ['монако']],
  ['Lille', ['лилль', 'лиль']],

  ['Ajax', ['аякс']],
  ['PSV Eindhoven', ['псв', 'псв эйндховен']],
  ['Feyenoord', ['фейеноорд']],
  ['Benfica', ['бенфика']],
  ['Porto', ['порту']],
  ['Sporting CP', ['спортинг', 'спортинг лиссабон']],

  ['Galatasaray', ['галатасарай']],
  ['Fenerbahce', ['фенербахче', 'fenerbahçe']],
  ['Besiktas', ['бешикташ', 'beşiktaş']],

  ['Celtic', ['селтик']],
  ['Rangers', ['рейнджерс']],
  ['Shakhtar Donetsk', ['шахтер', 'шахтёр', 'шахтер донецк']],
  ['Dynamo Kyiv', ['динамо киев', 'динамо київ']],

  ['Inter Miami', ['интер майами']],
  ['LA Galaxy', ['лос анджелес гэлакси', 'ла гэлакси']],
  ['Al Nassr', ['аль наср', 'ан наср']],
  ['Al Hilal', ['аль хилаль', 'ал хилаль']]
];

const aliasToCanonical = new Map();
const aliasEntries = [];

for (const [canonical, aliases] of clubs) {
  const all = [canonical, ...(aliases || [])];
  for (const alias of all) {
    const key = normalize(alias);
    if (!key) continue;
    if (!aliasToCanonical.has(key)) aliasToCanonical.set(key, canonical);
    aliasEntries.push({ key, canonical, label: alias });
  }
}

function resolveTeamName(value) {
  const input = clean(value);
  if (!input) return '';
  const exact = aliasToCanonical.get(normalize(input));
  if (exact) return exact;

  const transliterated = transliterateCyrillic(input);
  const translitExact = aliasToCanonical.get(normalize(transliterated));
  if (translitExact) return translitExact;
  return transliterated;
}

function localizedSuggestions(value, limit = 8) {
  const q = normalize(value);
  if (!q || q.length < 2) return [];
  const tokens = q.split(' ').filter(Boolean);
  const scored = [];
  const seen = new Set();

  for (const entry of aliasEntries) {
    if (seen.has(entry.canonical)) continue;
    let score = 0;
    if (entry.key === q) score = 100;
    else if (entry.key.startsWith(q)) score = 80;
    else if (tokens.every((token) => entry.key.includes(token))) score = 55;
    if (!score) continue;
    if (/[^\x00-\x7F]/.test(value) && /[^\x00-\x7F]/.test(entry.label)) score += 12;
    scored.push({ name: entry.canonical, score });
    seen.add(entry.canonical);
  }

  return scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, limit).map((item) => item.name);
}

function searchQuery(value) {
  const input = clean(value);
  if (!input) return '';
  const exact = aliasToCanonical.get(normalize(input));
  if (exact) return exact;
  const suggestions = localizedSuggestions(input, 3);
  if (/[^\x00-\x7F]/.test(input) && suggestions.length === 1) return suggestions[0];
  return transliterateCyrillic(input);
}

module.exports = { resolveTeamName, localizedSuggestions, searchQuery, transliterateCyrillic };
