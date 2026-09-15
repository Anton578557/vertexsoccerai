'use strict';

const { getPublicProviderStatus } = require('../lib/provider-mesh');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  const rapidApi = Boolean(process.env.RAPIDAPI_KEY && process.env.RAPIDAPI_HOST);
  const footballData = Boolean(process.env.FOOTBALL_DATA_KEY);
  const apiFootballDirect = Boolean(process.env.API_FOOTBALL_KEY);
  const sportmonks = Boolean(process.env.SPORTMONKS_API_TOKEN);
  const mesh = getPublicProviderStatus();

  return res.status(200).json({
    ok: true,
    services: {
      teamMetadata: true,
      footballPipeline: rapidApi || footballData || apiFootballDirect || sportmonks,
      rapidApi,
      footballData,
      apiFootballDirect,
      apiFootballDirectRequired: false,
      sportmonks,
      footballDataCoUk: true,
      openLigaDb: true,
      openFootball: true,
      statsBombOpenResearch: true,
      openWeather: Boolean(process.env.OPENWEATHER_KEY),
      openMeteoFallback: true,
      newsApi: Boolean(process.env.NEWSAPI_KEY),
      gdeltFallback: true,
      livePremium: Boolean(process.env.THESPORTSDB_V2_KEY),
      supabase: {
        url: Boolean(process.env.SUPABASE_URL),
        publishable: Boolean(process.env.SUPABASE_ANON_KEY),
        serverSecret: Boolean(process.env.SUPABASE_SECRET_KEY)
      },
      resend: {
        apiKey: Boolean(process.env.RESEND_API_KEY),
        fromEmail: Boolean(process.env.RESEND_FROM_EMAIL),
        replyToEmail: Boolean(process.env.RESEND_REPLY_TO_EMAIL)
      }
    },
    mesh,
    timestamp: new Date().toISOString()
  });
};
