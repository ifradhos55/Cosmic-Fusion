import test from 'node:test';
import assert from 'node:assert/strict';
import { createNasaService, createNasaHandler, normalize, plainText } from '../server/nasa.js';

const instant = Date.parse('2026-10-05T12:00:00Z');
const window = { start: '2026-10-05', end: '2026-10-11' };
const apod = { date: '2026-10-05', title: 'A galaxy', media_type: 'image', explanation: '<p>A &amp; B</p>',
  credit: '<a href="https://example.com">Photographer</a>', hdurl: 'https://assets.science.nasa.gov/image.jpg',
  url: 'https://science.nasa.gov/image-article/galaxy/', basic_html: '<script>unsafe()</script>' };
const asteroid = { id: '123', name: '(2026 AB)', nasa_jpl_url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=123',
  is_potentially_hazardous_asteroid: true, estimated_diameter: { meters: { estimated_diameter_min: 10, estimated_diameter_max: 20 } },
  close_approach_data: [{ orbiting_body: 'Earth', epoch_date_close_approach: instant + 86_400_000,
    miss_distance: { kilometers: '384400', lunar: '1' }, relative_velocity: { kilometers_per_second: '8.25' } }] };
const neo = { near_earth_objects: { '2026-10-06': [asteroid] } };
const notification = { messageID: '20261005-AL-001', messageType: 'FLR', messageIssueTime: '2026-10-05T10:00Z',
  messageURL: 'https://ccmc.gsfc.nasa.gov/DONKI/view/Alert/1/1', messageBody: 'Solar flare report' };
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers });

test('APOD uses the newest published entry and hdurl, preserving attribution without upstream HTML', () => {
  const data = normalize('apod', [{ ...apod, date: '2026-10-04' }, apod, { ...apod, date: '2026-10-06' }], { end: '2026-10-05' });
  assert.equal(data.date, '2026-10-05');
  assert.equal(data.image, apod.hdurl);
  assert.equal(data.source, apod.url);
  assert.equal(data.credit, 'Photographer');
  assert.equal(data.explanation, 'A & B');
  assert.equal(data.basic_html, undefined);
  assert.equal(normalize('apod', { ...apod, media_type: 'video', hdurl: 'javascript:bad' }, { end: '2026-10-05' }).image, null);
  assert.equal(normalize('apod', { ...apod, hdurl: 'https://example.com/image.jpg' }, { end: '2026-10-05' }).image, null);
  assert.throws(() => normalize('apod', { error: 'No data' }, window));
});

test('NeoWs preserves approach timestamps, converts numeric strings, filters other worlds and duplicate entries', () => {
  const data = normalize('asteroids', { near_earth_objects: { a: [asteroid, asteroid, { ...asteroid, id: 'mars', close_approach_data: [{ orbiting_body: 'Mars' }] }] } }, window);
  assert.equal(data.total, 1);
  assert.deepEqual(data.approaches[0], { id: '123', name: '(2026 AB)', at: '2026-10-06T12:00:00.000Z', hazardous: true,
    diameterMin: 10, diameterMax: 20, distanceKm: 384400, lunarDistances: 1, speedKmS: 8.25, source: asteroid.nasa_jpl_url });
  const unknown = normalize('asteroids', { near_earth_objects: { a: [{ ...asteroid, estimated_diameter: null, close_approach_data: [{ orbiting_body: 'Earth', close_approach_date: '2026-10-06' }] }] } }, window).approaches[0];
  assert.equal(unknown.diameterMin, null);
  assert.equal(unknown.distanceKm, null);
  assert.equal(normalize('asteroids', { near_earth_objects: {} }, window).total, 0);
  assert.throws(() => normalize('asteroids', {}, window));
});

test('DONKI reports sort newest first and omit untrusted links and upstream markup', () => {
  const data = normalize('weather', [notification, { ...notification, messageID: 'later', messageIssueTime: '2026-10-05T11:00Z', messageURL: 'javascript:alert(1)', messageBody: '<script>bad</script>Report &lt;safe&gt;' }], window);
  assert.equal(data.reports[0].id, 'later');
  assert.equal(data.reports[0].source, 'https://ccmc.gsfc.nasa.gov/DONKI/');
  assert.equal(data.reports[0].body, 'Report <safe>');
  assert.deepEqual(normalize('weather', [], window), { total: 0, reports: [] });
  assert.throws(() => normalize('weather', '<html>Service announcement</html>', window));
  assert.throws(() => normalize('weather', [{ error: 'Service unavailable' }], window));
  assert.equal(plainText('&#x1f; &#999999999; &#39;'), "\u001f '" );
});

test('service shares concurrent requests and computes seven UTC dates across month boundaries', async () => {
  let calls = 0, captured;
  const read = createNasaService({ now: () => Date.parse('2026-10-31T23:59:59Z'), apiKey: () => 'private-test-key',
    fetchImpl: async url => { calls++; captured = new URL(url); await new Promise(resolve => setTimeout(resolve, 10)); return json({ near_earth_objects: {} }); } });
  const [first, second] = await Promise.all([read('asteroids'), read('asteroids')]);
  assert.equal(calls, 1);
  assert.deepEqual(first, second);
  assert.equal(captured.searchParams.get('start_date'), '2026-10-31');
  assert.equal(captured.searchParams.get('end_date'), '2026-11-06');
  assert.equal(captured.searchParams.get('api_key'), 'private-test-key');
  assert.equal(JSON.stringify(first).includes('private-test-key'), false);
  await read('asteroids'); assert.equal(calls, 1);
});

test('demo cache expiration causes a new fetch, not a change to the observation date', async () => {
  let now = instant, calls = 0;
  const read = createNasaService({ now: () => now, fetchImpl: async () => { calls++; return json(neo); } });
  const first = await read('asteroids'); assert.equal(first.ttl, 7200); assert.equal(first.body.demo, true);
  now += 7199_000; await read('asteroids'); assert.equal(calls, 1);
  now += 2000; const second = await read('asteroids'); assert.equal(calls, 2);
  assert.notEqual(first.body.fetchedAt, second.body.fetchedAt);
  assert.equal(first.body.data.approaches[0].at, second.body.data.approaches[0].at);
});

test('space weather uses the migrated public endpoint without a key', async () => {
  let url;
  const read = createNasaService({ now: () => instant, fetchImpl: async input => { url = new URL(input); return json([notification]); } });
  const value = await read('weather');
  assert.equal(url.origin + url.pathname, 'https://ccmc.gsfc.nasa.gov/DONKI-API/get/notifications');
  assert.equal(url.searchParams.get('startDate'), '2026-09-29');
  assert.equal(url.searchParams.get('endDate'), '2026-10-05');
  assert.equal(url.searchParams.has('api_key'), false);
  assert.equal(value.ttl, 900);
});

test('failures retain the original successful timestamp with a warning, then expire after a day', async () => {
  let now = instant, working = true;
  const read = createNasaService({ now: () => now, fetchImpl: async () => working ? json([notification]) : new Response('<html>Unavailable</html>') });
  const first = await read('weather');
  working = false; now += 901_000;
  const stale = await read('weather');
  assert.equal(stale.status, 200); assert.equal(stale.body.stale, true);
  assert.equal(stale.body.fetchedAt, first.body.fetchedAt);
  assert.ok(stale.body.warning); assert.ok(stale.body.retryAt);
  now += 86_400_000;
  const expired = await read('weather'); assert.equal(expired.status, 503); assert.equal(expired.body.data, undefined);
});

test('rate limits back off, do not leak key-bearing errors, and allow independent feeds', async () => {
  let now = instant, calls = 0;
  const read = createNasaService({ now: () => now, apiKey: () => 'secret-key', fetchImpl: async url => {
    calls++;
    if (url.hostname === 'science.nasa.gov') return json(apod);
    return json({ error: `Invalid API key ${url}` }, 429, { 'Retry-After': '3600' });
  } });
  const first = await read('asteroids'); assert.equal(first.status, 429);
  assert.equal(JSON.stringify(first).includes('secret-key'), false);
  await read('asteroids'); assert.equal(calls, 1);
  assert.equal((await read('apod')).status, 200); assert.equal(calls, 2);
  now += 3601_000; await read('asteroids'); assert.equal(calls, 3);
});

test('HTTP adapter rejects unknown feeds, methods and arbitrary proxy parameters', async () => {
  let calls = 0;
  const handle = createNasaHandler(async feed => { calls++; return { status: 200, ttl: 900, body: { feed } }; });
  async function request(url, method = 'GET') {
    const response = { headers: {}, statusCode: 200, setHeader(name, value) { this.headers[name] = value; }, end(body) { this.body = JSON.parse(body); } };
    await handle({ url, method }, response); return response;
  }
  assert.equal((await request('/api/nasa?feed=weather', 'POST')).statusCode, 405);
  assert.equal((await request('/api/nasa?feed=weather&url=https://evil.com')).statusCode, 400);
  assert.equal((await request('/api/nasa?feed=weather&feed=apod')).statusCode, 400);
  assert.equal((await request('/api/nasa')).statusCode, 400);
  const ok = await request('/api/nasa?feed=weather');
  assert.equal(calls, 1); assert.equal(ok.headers['Cache-Control'], 'no-store');
  assert.equal(ok.headers['Vercel-CDN-Cache-Control'], 'public, s-maxage=900');
  const read = createNasaService({ fetchImpl: () => { throw new Error('Must not fetch'); } });
  assert.equal((await read('https://evil.com')).status, 400);
});
