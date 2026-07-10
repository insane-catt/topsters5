// Proxies Last.fm's album.search (same search engine Topsters 3 uses).
//
// The browser can't call ws.audioscrobbler.com directly: Last.fm doesn't send
// CORS headers, and a client-side call would leak the API key. So this
// serverless function injects the key from the LASTFM_API_KEY env var and
// returns Last.fm's JSON verbatim.
//
// Setup: create a key at https://www.last.fm/api/account/create and add it as
// an Environment Variable named LASTFM_API_KEY in the Vercel project settings.

const { URL } = require('url');

module.exports = async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const q = (u.searchParams.get('q') || '').trim();
  if (!q) {
    res.status(400).json({ error: 'Missing query parameter "q"' });
    return;
  }

  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'LASTFM_API_KEY is not configured' });
    return;
  }

  const url =
    'https://ws.audioscrobbler.com/2.0/?method=album.search' +
    `&album=${encodeURIComponent(q)}` +
    `&api_key=${apiKey}` +
    '&format=json&limit=40';

  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Topsters5/1.0 (https://topsters5.vercel.app)' }
    });
    if (!r.ok) {
      res.status(502).json({ error: 'Last.fm returned an error', status: r.status });
      return;
    }
    const data = await r.json();
    // Cache identical searches at the edge for an hour.
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json(data);
  } catch (_) {
    res.status(504).json({ error: 'Last.fm request failed' });
  }
};
