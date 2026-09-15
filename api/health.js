'use strict';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  return res.status(200).json({
    ok: true,
    services: {
      teamMetadata: true,
      apiFootball: Boolean(process.env.API_FOOTBALL_KEY),
      footballData: Boolean(process.env.FOOTBALL_DATA_KEY),
      openWeather: Boolean(process.env.OPENWEATHER_KEY),
      newsApi: Boolean(process.env.NEWSAPI_KEY),
      livePremium: Boolean(process.env.THESPORTSDB_V2_KEY)
    },
    timestamp: new Date().toISOString()
  });
};
