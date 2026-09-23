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
  ['Nottingham Forest', ['ноттингем форест', 'ноттингэм форест', 'ноттингем', 'ноттингэм']],
  ['Fulham', ['фулхэм', 'фулхем']],
  ['Brentford', ['брентфорд']],
  ['Leeds United', ['лидс', 'лидс юнайтед']],
  ['Coventry City', ['ковентри сити', 'ковентри']],
  ['Bournemouth', ['борнмут', 'afc bournemouth']],
  ['Burnley', ['бернли', 'бёрнли']],
  ['Sunderland', ['сандерленд']],
  ['Southampton', ['саутгемптон']],
  ['Leicester City', ['лестер', 'лестер сити']],
  ['Ipswich Town', ['ипсвич', 'ипсвич таун']],
  ['Sheffield United', ['шеффилд юнайтед']],
  ['Sheffield Wednesday', ['шеффилд уэнсдей', 'шеффилд уэнсди']],
  ['West Bromwich Albion', ['вест бромвич', 'вест бромвич альбион', 'вест бром']],
  ['Middlesbrough', ['мидлсбро']],
  ['Norwich City', ['норвич', 'норвич сити']],
  ['Watford', ['уотфорд']],
  ['Stoke City', ['сток', 'сток сити']],
  ['Swansea City', ['суонси', 'суонси сити', 'свонси']],
  ['Cardiff City', ['кардифф', 'кардифф сити']],
  ['Hull City', ['халл', 'халл сити']],
  ['Bristol City', ['бристоль сити']],
  ['Blackburn Rovers', ['блэкберн', 'блэкберн роверс']],
  ['Preston North End', ['престон', 'престон норт энд']],
  ['Queens Park Rangers', ['куинз парк рейнджерс', 'кпр', 'qpr']],
  ['Millwall', ['миллуолл', 'миллуол']],
  ['Derby County', ['дерби каунти']],
  ['Portsmouth', ['портсмут']],
  ['Oxford United', ['оксфорд', 'оксфорд юнайтед']],
  ['Plymouth Argyle', ['плимут', 'плимут аргайл']],
  ['Birmingham City', ['бирмингем', 'бирмингем сити']],
  ['Charlton Athletic', ['чарльтон', 'чарльтон атлетик']],
  ['Wrexham', ['рексем', 'рексхэм', 'врексем']],

  ['Bayern Munich', ['бавария', 'бавария мюнхен', 'bayern münchen', 'bayern munchen']],
  ['Borussia Dortmund', ['боруссия дортмунд', 'дортмунд', 'bvb']],
  ['RB Leipzig', ['рб лейпциг', 'лейпциг']],
  ['Bayer Leverkusen', ['байер', 'байер леверкузен', 'леверкузен']],
  ['Eintracht Frankfurt', ['айнтрахт', 'айнтрахт франкфурт']],
  ['Havelse', ['хавелсе', 'хавельзе', 'хавельсе', 'тсв хавелсе', 'tsv havelse']],
  ['Fortuna Koln', ['фортуна кёльн', 'фортуна кельн', 'fortuna köln', 'fortuna koeln', 'sc fortuna köln', 'sc fortuna koln']],
  ['FC Koln', ['кёльн', 'кельн', 'фк кельн', 'fc köln', '1. fc köln', 'fc koeln']],
  ['Fortuna Dusseldorf', ['фортуна дюссельдорф', 'fortuna düsseldorf']],
  ['Borussia Monchengladbach', ['боруссия мёнхенгладбах', 'боруссия менхенгладбах', 'менхенгладбах', 'гладбах', 'borussia mönchengladbach']],
  ['Wolfsburg', ['вольфсбург']],
  ['Stuttgart', ['штутгарт', 'vfb stuttgart']],
  ['Freiburg', ['фрайбург', 'sc freiburg']],
  ['Mainz', ['майнц', 'майнц 05', 'mainz 05']],
  ['Hoffenheim', ['хоффенхайм', 'хоффенхейм', 'tsg hoffenheim']],
  ['Werder Bremen', ['вердер', 'вердер бремен']],
  ['Augsburg', ['аугсбург']],
  ['Union Berlin', ['унион', 'унион берлин']],
  ['Heidenheim', ['хайденхайм', 'хайденхейм', 'heidenheim 1846']],
  ['Hamburg', ['гамбург', 'hamburger sv']],
  ['St. Pauli', ['санкт паули', 'санкт-паули', 'st pauli']],
  ['Bochum', ['бохум', 'vfl bochum']],
  ['Schalke 04', ['шальке', 'шальке 04']],
  ['Hertha Berlin', ['герта', 'герта берлин', 'hertha bsc']],
  ['Hannover 96', ['ганновер', 'ганновер 96']],
  ['Darmstadt', ['дармштадт', 'дармштадт 98', 'darmstadt 98']],
  ['Nurnberg', ['нюрнберг', 'nürnberg', '1. fc nürnberg']],
  ['Kaiserslautern', ['кайзерслаутерн']],
  ['Magdeburg', ['магдебург']],
  ['Dynamo Dresden', ['динамо дрезден']],
  ['1860 Munich', ['мюнхен 1860', '1860 мюнхен', 'tsv 1860 münchen']],

  ['Inter Milan', ['интер', 'интер милан', 'internazionale']],
  ['AC Milan', ['милан', 'milan', 'ac milan']],
  ['Juventus', ['ювентус', 'юве']],
  ['Napoli', ['наполи']],
  ['Roma', ['рома']],
  ['Lazio', ['лацио']],
  ['Atalanta', ['аталанта']],
  ['Fiorentina', ['фиорентина']],
  ['Bologna', ['болонья']],
  ['Torino', ['торино']],
  ['Udinese', ['удинезе']],
  ['Sassuolo', ['сассуоло']],
  ['Monza', ['монца']],
  ['Genoa', ['дженоа']],
  ['Cagliari', ['кальяри']],
  ['Lecce', ['лечче']],
  ['Parma', ['парма']],
  ['Como', ['комо']],
  ['Hellas Verona', ['верона', 'хеллас верона']],
  ['Empoli', ['эмполи']],

  ['Paris Saint-Germain', ['псж', 'пари сен жермен', 'пари сен-жермен', 'psg']],
  ['Marseille', ['марсель', 'олимпик марсель']],
  ['Lyon', ['лион', 'олимпик лион']],
  ['Monaco', ['монако']],
  ['Lille', ['лилль', 'лиль']],
  ['Nice', ['ницца']],
  ['Lens', ['ланс']],
  ['Rennes', ['ренн']],
  ['Strasbourg', ['страсбур', 'страсбург']],
  ['Toulouse', ['тулуза']],
  ['Brest', ['брест']],
  ['Nantes', ['нант']],

  ['Ajax', ['аякс']],
  ['PSV Eindhoven', ['псв', 'псв эйндховен']],
  ['Feyenoord', ['фейеноорд']],
  ['Fortuna Sittard', ['фортуна ситтард']],
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
    // Recognize transliterations saved by older versions of the UI as well.
    const latinKey = normalize(transliterateCyrillic(alias));
    if (!aliasToCanonical.has(latinKey)) aliasToCanonical.set(latinKey, canonical);
  }
}

function exactTeam(value) {
  const key = normalize(value);
  return aliasToCanonical.get(key) || aliasToCanonical.get(key.replace(/^(?:фк|fc|afc)\s+/u, ''));
}

function resolveTeamName(value) {
  const input = clean(value);
  if (!input) return '';
  const exact = exactTeam(input);
  if (exact) return exact;

  const transliterated = transliterateCyrillic(input);
  const translitExact = exactTeam(transliterated);
  if (translitExact) return translitExact;
  return transliterated;
}

function localizedSuggestions(value, limit = 8) {
  const q = normalize(value).replace(/^(?:фк|fc|afc)\s+/u, '');
  if (!q || q.length < 2) return [];
  const tokens = q.split(' ').filter(Boolean);
  const scored = new Map();

  for (const entry of aliasEntries) {
    let score = 0;
    if (entry.key === q) score = 100;
    else if (entry.key.startsWith(q)) score = 80;
    else if (tokens.every((token) => entry.key.includes(token))) score = 55;
    if (!score) continue;
    if (/[^\x00-\x7F]/.test(value) && /[^\x00-\x7F]/.test(entry.label)) score += 12;
    if (score > (scored.get(entry.canonical) || 0)) scored.set(entry.canonical, score);
  }

  return [...scored].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([name]) => name);
}

function searchQuery(value) {
  const input = clean(value);
  if (!input) return '';
  const exact = exactTeam(input);
  if (exact) return exact;
  const suggestions = localizedSuggestions(input, 3);
  if (/[^\x00-\x7F]/.test(input) && suggestions.length === 1) return suggestions[0];
  return transliterateCyrillic(input);
}

module.exports = { resolveTeamName, localizedSuggestions, searchQuery, transliterateCyrillic };
