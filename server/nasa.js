const DAY = 86_400_000;
export const FEEDS = ['apod', 'asteroids', 'weather'];
const SOURCES = {
  apod: 'https://science.nasa.gov/apod/',
  asteroids: 'https://cneos.jpl.nasa.gov/',
  weather: 'https://ccmc.gsfc.nasa.gov/DONKI/',
};

// NASA's WordPress feed includes HTML in text fields. Return only plain text;
// the browser also escapes every value before inserting it into the interface.
export function plainText(value, limit = 6000) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(value ?? '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, entity) => {
      if (entity[0] !== '#') return entities[entity.toLowerCase()] || ' ';
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ' ';
    }).replace(/\s+/g, ' ').trim().slice(0, limit);
}

const number = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const timestamp = value => value !== null && value !== undefined && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : null;
const date = time => new Date(time).toISOString().slice(0, 10);
const nasaURL = value => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !(url.hostname === 'nasa.gov' || url.hostname.endsWith('.nasa.gov')) || url.username || url.password) return null;
    url.searchParams.delete('api_key');
    return url.href;
  } catch { return null; }
};

export function normalize(feed, raw, window) {
  if (feed === 'apod') {
    const item = (Array.isArray(raw) ? raw : [raw]).filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item?.date) && item.date <= window.end)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!item?.title || !item.media_type) throw new Error('Invalid astronomy response');
    return { date: item.date, title: plainText(item.title, 200), explanation: plainText(item.explanation),
      credit: plainText(item.credit || item.copyright, 500), copyright: plainText(item.copyright, 500),
      alt: plainText(item.alt, 500), mediaType: item.media_type,
      image: item.media_type === 'image' ? nasaURL(item.hdurl) : null,
      source: nasaURL(item.permalink || item.url) || SOURCES.apod };
  }
  if (feed === 'asteroids') {
    if (!raw?.near_earth_objects || typeof raw.near_earth_objects !== 'object' || Array.isArray(raw.near_earth_objects)) throw new Error('Invalid asteroid response');
    const objects = Object.values(raw.near_earth_objects);
    if (objects.some(items => !Array.isArray(items))) throw new Error('Invalid asteroid entries');
    const seen = new Set();
    const approaches = objects.flat().flatMap(item => (item.close_approach_data || []).filter(approach => approach.orbiting_body === 'Earth').map(approach => {
      const epoch = number(approach.epoch_date_close_approach);
      const at = epoch !== null ? timestamp(epoch) : timestamp(approach.close_approach_date);
      const key = `${item.id}:${at}`;
      if (!at || at.slice(0, 10) < window.start || at.slice(0, 10) > window.end || seen.has(key)) return null;
      seen.add(key);
      return { id: plainText(item.id, 80), name: plainText(item.name, 160), at,
        hazardous: item.is_potentially_hazardous_asteroid === true,
        diameterMin: number(item.estimated_diameter?.meters?.estimated_diameter_min),
        diameterMax: number(item.estimated_diameter?.meters?.estimated_diameter_max),
        distanceKm: number(approach.miss_distance?.kilometers), lunarDistances: number(approach.miss_distance?.lunar),
        speedKmS: number(approach.relative_velocity?.kilometers_per_second), source: nasaURL(item.nasa_jpl_url) || SOURCES.asteroids };
    })).filter(Boolean).sort((a, b) => a.at.localeCompare(b.at));
    return { total: approaches.length, approaches };
  }
  if (!Array.isArray(raw)) throw new Error('Invalid weather response');
  if (raw.length && !raw.some(item => item?.messageID && timestamp(item.messageIssueTime))) throw new Error('Invalid weather entries');
  const reports = raw.filter(item => item?.messageID && timestamp(item.messageIssueTime)).map(item => ({
    id: plainText(item.messageID, 100), type: plainText(item.messageType, 40), at: timestamp(item.messageIssueTime),
    body: plainText(item.messageBody, 1800), source: nasaURL(item.messageURL) || SOURCES.weather,
  })).filter(item => item.at.slice(0, 10) >= window.start && item.at.slice(0, 10) <= window.end)
    .sort((a, b) => b.at.localeCompare(a.at));
  return { total: reports.length, reports: reports.slice(0, 12) };
}

/** Fixed upstream endpoints, bounded caches and no browser-visible credentials. */
export function createNasaService({ fetchImpl = fetch, now = Date.now, apiKey = () => process.env.NASA_API_KEY || 'DEMO_KEY' } = {}) {
  const cache = new Map(), pending = new Map(), failures = new Map();
  return async function read(feed) {
    if (!FEEDS.includes(feed)) return { status: 400, ttl: 0, body: { error: 'Unknown NASA feed.' } };
    if (pending.has(feed)) return pending.get(feed);
    const time = now(), demo = apiKey() === 'DEMO_KEY';
    const ttl = feed === 'apod' ? 3600 : feed === 'weather' ? 900 : demo ? 7200 : 3600;
    const existing = cache.get(feed), failure = failures.get(feed);
    const response = (entry, stale = false, warning = null, retryAt = null) => ({ status: 200, ttl: stale ? 60 : Math.max(1, Math.ceil((entry.expires - now()) / 1000)),
      body: { ...entry.body, stale, warning, retryAt: retryAt ? new Date(retryAt).toISOString() : null } });
    if (existing && time < existing.expires) return response(existing);
    const unavailable = error => existing && time - Date.parse(existing.body.fetchedAt) < DAY
      ? response(existing, true, error.message, error.retryAt)
      : { status: error.status, ttl: 0, body: { feed, error: error.message, retryAt: new Date(error.retryAt).toISOString(), source: SOURCES[feed] } };
    if (failure && time < failure.retryAt) return unavailable(failure);
    const request = (async () => {
      const end = date(time), start = date(time + (feed === 'weather' ? -6 : 0) * DAY);
      const window = { start, end: feed === 'asteroids' ? date(time + 6 * DAY) : end };
      const url = new URL(feed === 'apod' ? 'https://science.nasa.gov/wp-json/wp/v2/apod-basic/'
        : feed === 'weather' ? 'https://ccmc.gsfc.nasa.gov/DONKI-API/get/notifications' : 'https://api.nasa.gov/neo/rest/v1/feed');
      if (feed === 'weather') { url.searchParams.set('startDate', start); url.searchParams.set('endDate', end); url.searchParams.set('type', 'all'); }
      if (feed === 'asteroids') { url.searchParams.set('start_date', start); url.searchParams.set('end_date', window.end); url.searchParams.set('api_key', apiKey()); }
      let upstream;
      try {
        upstream = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12_000), redirect: 'error' });
        if (!upstream.ok) throw new Error('NASA request failed');
        const data = normalize(feed, await upstream.json(), window);
        const fetchedAt = new Date(now()).toISOString();
        const entry = { expires: now() + ttl * 1000, body: { feed, fetchedAt, nextRefreshAt: new Date(now() + ttl * 1000).toISOString(),
          window, source: SOURCES[feed], demo: feed === 'asteroids' && demo, data } };
        cache.set(feed, entry); failures.delete(feed);
        return response(entry);
      } catch {
        // Never forward upstream bodies or exception messages: they may contain the key.
        const limited = upstream?.status === 429;
        const badKey = [401, 403].includes(upstream?.status);
        const retrySeconds = limited ? Math.min(7200, Math.max(3600, Number(upstream.headers?.get('retry-after')) || 0)) : badKey ? 900 : 60;
        const error = { status: limited ? 429 : 503, retryAt: now() + retrySeconds * 1000,
          message: limited ? 'NASA request limit reached. This feed will retry later.'
            : badKey ? 'NASA could not authorize this feed. Check the server API key.' : 'NASA is not responding with usable data. Try again shortly.' };
        failures.set(feed, error);
        return unavailable(error);
      } finally { pending.delete(feed); }
    })();
    pending.set(feed, request);
    return request;
  };
}

export function createNasaHandler(read = createNasaService()) {
  return async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET'); res.statusCode = 405;
      res.end(JSON.stringify({ error: 'Use GET for NASA feeds.' })); return;
    }
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/api/nasa' || [...url.searchParams.keys()].some(key => key !== 'feed') || url.searchParams.getAll('feed').length !== 1) {
      res.statusCode = 400; res.end(JSON.stringify({ error: 'Choose a NASA feed: apod, asteroids or weather.' })); return;
    }
    const result = await read(url.searchParams.get('feed'));
    res.statusCode = result.status;
    // Keep application freshness timestamps aligned with CDN expiry.
    if (result.status === 200) res.setHeader('Vercel-CDN-Cache-Control', `public, s-maxage=${result.ttl}`);
    else if (result.body.retryAt) res.setHeader('Retry-After', String(Math.max(1, Math.ceil((Date.parse(result.body.retryAt) - Date.now()) / 1000))));
    res.end(JSON.stringify(result.body));
  };
}
