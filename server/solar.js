import { OBSERVATORIES, CATALOGUE_ASTEROIDS, PLANET_COMMANDS } from '../src/data/observatories.js';
import { plainText } from './nasa.js';
import snapshot from '../public/data/ephemeris-snapshot.json' with { type: 'json' };

const DAY = 86400000;
const AGENT = 'CosmicFusion/2.1 (https://github.com/ifradhos55/Cosmic-Fusion)';
const jdToTime = jd => Math.round((jd - 2440587.5) * DAY);
const numeric = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
export const httpsURL = value => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
};
const nasaURL = value => {
  const url = httpsURL(value);
  return url && new URL(url).hostname.endsWith('.nasa.gov') ? url : null;
};

export function parseVectors(raw) {
  if (!['1.2', '1.3'].includes(raw?.signature?.version) || raw.error || !raw.result?.includes('Ecliptic of J2000.0') || !raw.result?.includes('AU-D')) throw new Error('Unsupported Horizons response');
  const section = raw.result.split('$$SOE')[1]?.split('$$EOE')[0];
  if (!section) throw new Error('Missing Horizons vectors');
  const samples = section.trim().split('\n').map(line => {
    const fields = line.split(',').map(field => field.trim());
    const numericFields = [fields[0], ...fields.slice(2, 8)];
    if (numericFields.some(value => !value)) throw new Error('Missing Horizons vector value');
    const values = numericFields.map(Number);
    if (values.length !== 7 || values.some(value => !Number.isFinite(value))) throw new Error('Invalid Horizons vectors');
    return [jdToTime(values[0]), ...values.slice(1)];
  });
  if (samples.length < 2 || samples.some((row, index) => index && row[0] <= samples[index - 1][0])) throw new Error('Invalid Horizons times');
  return { samples, solution: plainText(raw.result.match(/Target body name:.*?\{source:\s*([^}]+)\}/)?.[1] || 'JPL Horizons', 100), version: raw.signature.version };
}

export function normalizeImages(raw, body) {
  if (!Array.isArray(raw?.collection?.items)) throw new Error('Invalid NASA image catalogue');
  return raw.collection.items.flatMap(item => {
    const data = item.data?.[0];
    const text = `${data?.title} ${data?.description}`;
    if (!data?.nasa_id || /\b(?:illustration|artist|concept)\b/i.test(data.title || '') || data.media_type !== 'image' || !text.toLowerCase().includes(body) || /artist.{0,20}(concept|impression|illustration)|computer[- ]generated|simulation of|conceptual illustration/i.test(text)) return [];
    // Accessible captions describe the actual photograph without the long
    // mission boilerplate that also makes laboratory photos match terrain.
    const subject = `${data.title || ''} ${data.description_508 || data.description?.split(/\n\s*\n/)[0] || ''}`;
    if (/engineering models?|rover twins?|mars yard|garage|3d glasses|seen here working|launch pad|press conference|clean room|assembly facility|testing ground|vehicle system test bed|ground-based test|(?:scientist|engineer).{0,120}(?:poses|stands|seen|working)/i.test(subject)) return [];
    const image = nasaURL(item.links?.find(link => link.rel === 'alternate' && link.render === 'image')?.href || item.links?.find(link => link.rel === 'preview')?.href);
    if (!image) return [];
    return [{ id: plainText(data.nasa_id, 120), title: plainText(data.title, 240), description: plainText(data.description, 3000),
      date: Number.isFinite(Date.parse(data.date_created)) ? new Date(data.date_created).toISOString() : null,
      credit: plainText(data.secondary_creator || data.photographer || `NASA/${data.center || ''}`, 500), image,
      source: `https://images.nasa.gov/details/${encodeURIComponent(data.nasa_id)}` }];
  }).slice(0, 6);
}

export function normalizeMars(raw) {
  if (!Array.isArray(raw?.soles)) throw new Error('Invalid Mars weather feed');
  const rows = raw.soles.filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.terrestrial_date)).sort((a, b) => b.terrestrial_date.localeCompare(a.terrestrial_date));
  return rows.slice(0, 7).map(row => ({ date: row.terrestrial_date, sol: numeric(row.sol), minC: numeric(row.min_temp), maxC: numeric(row.max_temp),
    groundMinC: numeric(row.min_gts_temp), groundMaxC: numeric(row.max_gts_temp), pressurePa: numeric(row.pressure), windMS: numeric(row.wind_speed),
    conditions: plainText(row.atmo_opacity, 100), season: plainText(row.season, 100) }));
}

export function normalizeStation(raw, station) {
  const p = raw?.properties;
  if (!p?.timestamp || !Number.isFinite(Date.parse(p.timestamp))) throw new Error('Invalid Earth weather observation');
  const measurement = (name, unit) => p[name]?.unitCode === `wmoUnit:${unit}` ? numeric(p[name].value) : null;
  return { station, name: plainText(p.stationName, 160), at: new Date(p.timestamp).toISOString(), temperatureC: measurement('temperature', 'degC'),
    windKmH: measurement('windSpeed', 'km_h-1'), pressurePa: measurement('barometricPressure', 'Pa'), humidity: measurement('relativeHumidity', 'percent'),
    description: plainText(p.textDescription, 160), source: `https://api.weather.gov/stations/${station}/observations/latest` };
}

/** Daily cached vector tables. JPL calls share one queue per server instance. */
export function createSolarService({ fetchImpl = fetch, now = Date.now, seed = null } = {}) {
  const cache = new Map(), pending = new Map(), failures = new Map();
  let jplQueue = Promise.resolve();
  const fetchJSON = async url => {
    const response = await fetchImpl(url, { headers: { Accept: 'application/json', 'User-Agent': AGENT }, signal: AbortSignal.timeout(12000), redirect: 'error' });
    if (!response.ok) throw new Error('Observation service unavailable');
    return response.json();
  };
  const jpl = url => {
    const result = jplQueue.then(() => fetchJSON(url));
    jplQueue = result.catch(() => {});
    return result;
  };
  async function vectors(id, command, anchor) {
    const time = Date.parse(anchor), start = new Date(time - 2 * DAY).toISOString().slice(0, 10), end = new Date(time + 32 * DAY).toISOString().slice(0, 10);
    const url = new URL('https://ssd.jpl.nasa.gov/api/horizons.api');
    const parameters = { format: 'json', COMMAND: command, OBJ_DATA: 'NO', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'VECTORS', CENTER: id === 'moon' ? '500@399' : '500@10',
      START_TIME: start, STOP_TIME: end, STEP_SIZE: '6 h', OUT_UNITS: 'AU-D', REF_PLANE: 'ECLIPTIC', REF_SYSTEM: 'ICRF', TIME_TYPE: 'UT', VEC_TABLE: '2', CSV_FORMAT: 'YES', VEC_CORR: 'NONE' };
    for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, key === 'format' ? value : `'${value}'`);
    return { id, center: id === 'moon' ? 'earth' : 'sun', ...parseVectors(await jpl(url)) };
  }
  const loaders = {
    async ephemeris(body, anchor) {
      const bodies = {}, warnings = [];
      const deadline = now() + 55000;
      // Sequential requests comply with JPL's fair-use policy.
      for (const [id, command] of [...Object.entries(PLANET_COMMANDS), ...CATALOGUE_ASTEROIDS.map(item => [item.id, item.command])]) {
        if (deadline - now() < 12000) { warnings.push(id); continue; }
        try { bodies[id] = await vectors(id, command, anchor); } catch { warnings.push(id); }
      }
      if (Object.keys(PLANET_COMMANDS).filter(id => id !== 'moon').some(id => !bodies[id])) throw new Error('Planetary ephemeris unavailable');
      return { data: { bodies, warnings, frame: 'Heliocentric J2000 ecliptic; Moon is Earth-centered', timeScale: 'UTC', units: 'AU and AU/day',
        start: Math.max(...Object.values(bodies).map(value => value.samples[0][0])), end: Math.min(...Object.values(bodies).map(value => value.samples.at(-1)[0])) }, source: 'https://ssd.jpl.nasa.gov/horizons/' };
    },
    async images(body) {
      const url = new URL('https://images-api.nasa.gov/search');
      url.searchParams.set('q', OBSERVATORIES[body].query); url.searchParams.set('media_type', 'image'); url.searchParams.set('page_size', '30');
      return { data: normalizeImages(await fetchJSON(url), body), source: 'https://images.nasa.gov/' };
    },
    async mars() {
      return { data: normalizeMars(await fetchJSON('https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json')), source: 'https://mars.nasa.gov/msl/weather/' };
    },
    async earth() {
      const outcomes = await Promise.allSettled(['KJFK', 'KLAX', 'PHNL'].map(async station => normalizeStation(await fetchJSON(`https://api.weather.gov/stations/${station}/observations/latest`), station)));
      const observations = outcomes.filter(item => item.status === 'fulfilled').map(item => item.value);
      if (!observations.length) throw new Error('Earth observations unavailable');
      return { data: { observations, missingStations: outcomes.filter(item => item.status === 'rejected').length }, source: 'https://www.weather.gov/documentation/services-web-api' };
    },
    async clouds() {
      const raw = await fetchJSON('https://epic.gsfc.nasa.gov/api/natural');
      if (!Array.isArray(raw)) throw new Error('Invalid EPIC feed');
      const images = raw.filter(item => /^epic_[\w]+$/.test(item.image) && /^\d{4}-\d{2}-\d{2} /.test(item.date)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4).map(item => {
        const date = item.date.slice(0, 10), path = date.replaceAll('-', '/');
        return { date: `${item.date.replace(' ', 'T')}Z`, image: `https://epic.gsfc.nasa.gov/archive/natural/${path}/jpg/${item.image}.jpg`,
          caption: plainText(item.caption, 500), latitude: numeric(item.centroid_coordinates?.lat), longitude: numeric(item.centroid_coordinates?.lon) };
      });
      return { data: images, source: 'https://epic.gsfc.nasa.gov/' };
    },
  };
  return async function read(feed, body = '', anchor = new Date(now()).toISOString().slice(0, 10)) {
    if (!Object.hasOwn(loaders, feed) || (feed === 'images' ? !Object.hasOwn(OBSERVATORIES, body) : body !== '') || !/^\d{4}-\d{2}-\d{2}$/.test(anchor) || !Number.isFinite(Date.parse(anchor)) || new Date(anchor).toISOString().slice(0, 10) !== anchor || Math.abs(Date.parse(anchor) - now()) > 3660 * DAY) {
      return { status: 400, ttl: 0, body: { error: 'Unknown observation request.' } };
    }
    const key = `${feed}:${body}:${feed === 'ephemeris' ? anchor : ''}`;
    if (pending.has(key)) return pending.get(key);
    const time = now();
    if (!cache.has(key) && feed === 'ephemeris' && seed?.data?.start <= Date.parse(anchor) && seed.data.end >= Date.parse(anchor) + DAY) {
      cache.set(key, { expires: Date.parse(seed.fetchedAt) + 43200000, body: seed });
    }
    const existing = cache.get(key);
    const result = (entry, stale = false) => ({ status: 200, ttl: stale ? 60 : Math.max(1, Math.ceil((entry.expires - now()) / 1000)), body: { ...entry.body, stale } });
    if (existing && time < existing.expires) return result(existing);
    const unavailable = () => existing ? result(existing, true) : { status: 503, ttl: 0, body: { feed, body, error: 'The observation service is unavailable. Try again later.', retryAt: new Date(now() + 300000).toISOString() } };
    if ((failures.get(key) || 0) > time) return unavailable();
    const request = (async () => {
      try {
        const loaded = await loaders[feed](body, anchor);
        const ttl = feed === 'ephemeris' ? 43200 : feed === 'images' ? 86400 : feed === 'earth' ? 900 : 3600;
        const entry = { expires: now() + ttl * 1000, body: { feed, body, fetchedAt: new Date(now()).toISOString(), nextRefreshAt: new Date(now() + ttl * 1000).toISOString(), ...loaded } };
        cache.set(key, entry); failures.delete(key);
        // Keep historical time-warp requests bounded in a warm server.
        if (cache.size > 24) cache.delete(cache.keys().next().value);
        return result(entry);
      } catch { failures.set(key, now() + 300000); if (failures.size > 24) failures.delete(failures.keys().next().value); return unavailable(); }
      finally { pending.delete(key); }
    })();
    pending.set(key, request);
    return request;
  };
}

export function createSolarHandler(read = createSolarService({ seed: snapshot })) {
  return async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.statusCode = 405; res.end(JSON.stringify({ error: 'Use GET for observations.' })); return; }
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/api/solar' || (url.searchParams.has('date') && url.searchParams.get('feed') !== 'ephemeris') || [...url.searchParams.keys()].some(key => !['feed', 'body', 'date'].includes(key)) || ['feed', 'body', 'date'].some(key => url.searchParams.getAll(key).length > 1)) {
      res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid observation parameters.' })); return;
    }
    const result = await read(url.searchParams.get('feed'), url.searchParams.get('body') || '', url.searchParams.get('date') || undefined);
    res.statusCode = result.status;
    if (result.status === 200) res.setHeader('Vercel-CDN-Cache-Control', `public, s-maxage=${result.ttl}`);
    res.end(JSON.stringify(result.body));
  };
}
