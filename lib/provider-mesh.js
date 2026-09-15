'use strict';

/**
 * Central registry for the Vertex data mesh.
 *
 * Keep provider selection and capability metadata in one place so the analysis
 * engine can prefer the best source for each type of information instead of
 * treating one API as the source of truth for everything.
 *
 * IMPORTANT: "configured" only means the credential/endpoint is available.
 * It does not guarantee a particular league or statistic is covered for a
 * specific fixture. Callers must still validate the returned payload.
 */

const PROVIDERS = Object.freeze({
  rapidApiFootball: {
    label: 'RapidAPI · Free API Live Football Data',
    tier: 'current',
    auth: 'RAPIDAPI_KEY + RAPIDAPI_HOST',
    roles: ['live', 'fixtures', 'match_stats', 'xg', 'shots', 'corners', 'cards', 'lineups', 'referee'],
    priority: 100
  },
  footballData: {
    label: 'Football-Data.org',
    tier: 'current',
    auth: 'FOOTBALL_DATA_KEY',
    roles: ['fixtures', 'results', 'standings', 'recent_form'],
    priority: 90
  },
  apiFootball: {
    label: 'API-Football',
    tier: 'current',
    auth: 'API_FOOTBALL_KEY',
    roles: ['fixtures', 'results', 'statistics', 'events', 'injuries', 'lineups', 'h2h'],
    priority: 85
  },
  theSportsDb: {
    label: 'TheSportsDB',
    tier: 'metadata',
    auth: 'optional',
    roles: ['team_metadata', 'logos', 'stadiums', 'fallback_results'],
    priority: 70
  },
  sportmonks: {
    label: 'Sportmonks',
    tier: 'optional',
    auth: 'SPORTMONKS_API_TOKEN',
    roles: ['fixtures', 'statistics', 'events', 'lineups', 'players'],
    priority: 65
  },
  footballDataCoUk: {
    label: 'Football-Data.co.uk',
    tier: 'historical_open',
    auth: 'none',
    roles: ['historical_results', 'shots', 'shots_on_target', 'corners', 'fouls', 'offsides', 'cards', 'referees'],
    priority: 80,
    licenseNote: 'Free downloadable CSV data; preserve source attribution and source-specific terms.'
  },
  openLigaDb: {
    label: 'OpenLigaDB',
    tier: 'open',
    auth: 'none',
    roles: ['fixtures', 'results', 'league_fallback'],
    priority: 50,
    licenseNote: 'ODbL community data; useful as a fallback, especially for German competitions.'
  },
  openFootball: {
    label: 'OpenFootball',
    tier: 'open',
    auth: 'none',
    roles: ['historical_results', 'team_aliases', 'competition_mapping'],
    priority: 45,
    licenseNote: 'CC0/public-domain datasets.'
  },
  statsBombOpen: {
    label: 'StatsBomb Open Data',
    tier: 'research',
    auth: 'none',
    roles: ['event_training', 'shots', 'passes', 'fouls', 'lineups'],
    priority: 30,
    licenseNote: 'Research/open-data terms require attribution. Do not silently use as a production redistribution feed without reviewing the user agreement.'
  },
  openWeather: {
    label: 'OpenWeather',
    tier: 'context',
    auth: 'OPENWEATHER_KEY',
    roles: ['weather', 'geocoding'],
    priority: 80
  },
  openMeteo: {
    label: 'Open-Meteo',
    tier: 'context_fallback',
    auth: 'none',
    roles: ['weather_forecast', 'historical_weather', 'geocoding'],
    priority: 55,
    licenseNote: 'Free public endpoint is for non-commercial use; commercial use requires the appropriate plan.'
  },
  newsApi: {
    label: 'NewsAPI',
    tier: 'context',
    auth: 'NEWSAPI_KEY',
    roles: ['news'],
    priority: 70
  },
  gdelt: {
    label: 'GDELT',
    tier: 'context_fallback',
    auth: 'none',
    roles: ['news_search', 'news_context'],
    priority: 40
  }
});

function isConfigured(key) {
  switch (key) {
    case 'rapidApiFootball':
      return Boolean(process.env.RAPIDAPI_KEY && process.env.RAPIDAPI_HOST);
    case 'footballData':
      return Boolean(process.env.FOOTBALL_DATA_KEY);
    case 'apiFootball':
      return Boolean(process.env.API_FOOTBALL_KEY);
    case 'theSportsDb':
      // TheSportsDB v1 supports the documented development key fallback used by
      // the existing app. Premium v2 becomes available when configured.
      return true;
    case 'sportmonks':
      return Boolean(process.env.SPORTMONKS_API_TOKEN);
    case 'openWeather':
      return Boolean(process.env.OPENWEATHER_KEY);
    case 'newsApi':
      return Boolean(process.env.NEWSAPI_KEY);
    case 'footballDataCoUk':
    case 'openLigaDb':
    case 'openFootball':
    case 'statsBombOpen':
    case 'openMeteo':
    case 'gdelt':
      return true;
    default:
      return false;
  }
}

function providersForRole(role, { configuredOnly = true } = {}) {
  return Object.entries(PROVIDERS)
    .filter(([, provider]) => provider.roles.includes(role))
    .filter(([key]) => !configuredOnly || isConfigured(key))
    .sort((a, b) => (b[1].priority || 0) - (a[1].priority || 0))
    .map(([key, provider]) => ({ key, ...provider, configured: isConfigured(key) }));
}

function getPublicProviderStatus() {
  return Object.fromEntries(Object.entries(PROVIDERS).map(([key, provider]) => [key, {
    label: provider.label,
    tier: provider.tier,
    configured: isConfigured(key),
    roles: provider.roles,
    licenseNote: provider.licenseNote || null
  }]));
}

module.exports = {
  PROVIDERS,
  isConfigured,
  providersForRole,
  getPublicProviderStatus
};
