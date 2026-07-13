// Proxies Last.fm's user.getTopAlbums — this powers the "Import from Last.fm"
// feature, the same one Topsters 3 has. It fetches a user's most-played albums
// for a given period so the chart can be filled from the top down.
//
// The browser can't call ws.audioscrobbler.com directly (no CORS headers, and a
// client-side call would leak the API key), so this serverless function injects
// the key from LASTFM_API_KEY and returns Last.fm's JSON verbatim.
//
// Setup: create a key at https://www.last.fm/api/account/create and add it as an
// Environment Variable named LASTFM_API_KEY in the Vercel project settings.

const { URL } = require('url');

// The periods Last.fm accepts (mirrors Topsters 3's dropdown).
const PERIODS = ['overall', '7day', '1month', '3month', '6month', '12month'];

module.exports = async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const user = (u.searchParams.get('user') || '').trim();
  if (!user) {
    res.status(400).json({ error: 'Missing query parameter "user"' });
    return;
  }

  let period = (u.searchParams.get('period') || 'overall').trim();
  if (!PERIODS.includes(period)) period = 'overall';

  let limit = parseInt(u.searchParams.get('limit'), 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 100;
  if (limit > 144) limit = 144; // a 12x12 grid is the most tiles a chart holds

  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'LASTFM_API_KEY is not configured' });
    return;
  }

  const url =
    'https://ws.audioscrobbler.com/2.0/?method=user.getTopAlbums' +
    `&user=${encodeURIComponent(user)}` +
    `&period=${encodeURIComponent(period)}` +
    `&limit=${limit}` +
    `&api_key=${apiKey}` +
    '&format=json';

  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Topsters5/1.0 (https://topsters5.vercel.app)' }
    });
    const data = await r.json();
    // Last.fm reports bad usernames etc. with an { error, message } body. Pass
    // that through with a 200 so the client can read and display the message.
    if (data && data.error) {
      res.status(200).json(data);
      return;
    }
    if (!r.ok) {
      res.status(502).json({ error: 'Last.fm returned an error', status: r.status });
      return;
    }
    // Cache identical imports at the edge for an hour.
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json(data);
  } catch (_) {
    res.status(504).json({ error: 'Last.fm request failed' });
  }
};
