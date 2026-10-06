import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSolarService, createSolarHandler, parseVectors, normalizeImages, normalizeMars, normalizeStation } from '../server/solar.js';
const snapshot = JSON.parse(await readFile(new URL('../public/data/ephemeris-snapshot.json', import.meta.url)));
const instant = Date.parse('2026-10-06T12:00:00Z');
const rawVectors = { signature: { version: '1.2' }, result: 'Target body name: Earth {source: DE441}\nEcliptic of J2000.0\nAU-D\n$$SOE\n2461319.5, A.D. 2026-Oct-06 00:00:00.0000, 1, 0, 0, 0, .017, 0,\n2461319.75, A.D. 2026-Oct-06 06:00:00.0000, 1, .00425, 0, 0, .017, 0,\n$$EOE' };
const json = data => new Response(JSON.stringify(data));
test('Horizons parsing retains UTC sample times and AU/day velocities and rejects incompatible responses', () => {
  const value = parseVectors(rawVectors);
  assert.equal(value.samples[0][0], Date.parse('2026-10-06T00:00:00Z'));
  assert.equal(value.samples[1][0] - value.samples[0][0], 21600000);
  assert.equal(value.samples[0][5], .017);
  assert.equal(value.solution, 'DE441');
  for (const raw of [{ ...rawVectors, signature: { version: '9' } }, { ...rawVectors, result: rawVectors.result.replace('AU-D', 'KM-S') }, { ...rawVectors, error: 'No results' }, { ...rawVectors, result: rawVectors.result.replace('2461319.75', '2461319.5') }]) assert.throws(() => parseVectors(raw));
});
test('planet requests coalesce, JPL calls are sequential, and Moon vectors use an Earth center', async () => {
  let active = 0, maximum = 0, calls = 0; const urls = [];
  const read = createSolarService({ now: () => instant, fetchImpl: async url => {
    calls++; active++; maximum = Math.max(maximum, active); urls.push(new URL(url));
    await new Promise(resolve => setTimeout(resolve, 1)); active--; return json(rawVectors);
  } });
  const [first, second] = await Promise.all([read('ephemeris'), read('ephemeris')]);
  assert.equal(first.status, 200); assert.deepEqual(first, second); assert.equal(calls, 14); assert.equal(maximum, 1);
  assert.equal(Object.keys(first.body.data.bodies).length, 14);
  assert.equal(urls.find(url => url.searchParams.get('COMMAND') === "'301'").searchParams.get('CENTER'), "'500@399'");
  assert.ok(urls.every(url => url.searchParams.get('TIME_TYPE') === "'UT'"));
  await read('ephemeris'); assert.equal(calls, 14);
});
test('optional asteroid failures do not discard planetary positions and outages back off', async () => {
  let calls = 0;
  const read = createSolarService({ now: () => instant, fetchImpl: async url => { calls++; if (new URL(url).searchParams.get('COMMAND').includes(';')) throw new Error('Offline'); return json(rawVectors); } });
  const value = await read('ephemeris'); assert.equal(value.status, 200); assert.equal(value.body.data.warnings.length, 5); assert.equal(Object.keys(value.body.data.bodies).length, 9);
  const unavailable = createSolarService({ now: () => instant, fetchImpl: async () => { calls++; throw new Error('Private diagnostic'); } });
  const first = await unavailable('earth'), before = calls, second = await unavailable('earth');
  assert.equal(first.status, 503); assert.equal(second.status, 503); assert.equal(calls, before); assert.ok(!JSON.stringify(first).includes('Private'));
});
test('saved JPL tables retain their original fetch date on upstream failure', async () => {
  let now = Date.parse(snapshot.fetchedAt) + 43200001;
  const read = createSolarService({ seed: snapshot, now: () => now, fetchImpl: async () => { throw new Error('Offline'); } });
  const value = await read('ephemeris'); assert.equal(value.status, 200); assert.equal(value.body.stale, true); assert.equal(value.body.fetchedAt, snapshot.fetchedAt);
});
test('request validation prevents arbitrary endpoints and redundant body/date variants', async () => {
  let calls = 0;
  const read = createSolarService({ now: () => instant, fetchImpl: async () => { calls++; return json({}); } });
  for (const [feed, body, date] of [['constructor', '', '2026-10-06'], ['ephemeris', 'earth', '2026-10-06'], ['images', '__proto__', '2026-10-06'], ['ephemeris', '', '2026-02-30']]) assert.equal((await read(feed, body, date)).status, 400);
  assert.equal(calls, 0);
  const handler = createSolarHandler(read);
  for (const url of ['/api/solar?feed=earth&date=2026-10-06', '/api/solar?feed=earth&feed=mars', '/api/solar?feed=earth&url=https://example.com', '/different?feed=earth']) {
    let result; const res = { setHeader() {}, end(value) { result = JSON.parse(value); } }; await handler({ method: 'GET', url }, res); assert.equal(res.statusCode, 400); assert.ok(result.error);
  }
});
test('weather normalization preserves missing measurements and rejects incompatible units', () => {
  const mars = normalizeMars({ soles: [{ terrestrial_date: '2026-08-25', sol: '4995', min_temp: '-71', max_temp: '-5', wind_speed: '--', pressure: '777', atmo_opacity: '<b>Sunny</b>' }] })[0];
  assert.equal(mars.minC, -71); assert.equal(mars.windMS, null); assert.equal(mars.pressurePa, 777); assert.equal(mars.conditions, 'Sunny'); assert.equal(mars.date, '2026-08-25');
  const station = normalizeStation({ properties: { timestamp: '2026-10-06T00:00:00Z', temperature: { unitCode: 'wmoUnit:degC', value: null }, windSpeed: { unitCode: 'wmoUnit:m_s-1', value: 4 } } }, 'KJFK');
  assert.equal(station.temperatureC, null); assert.equal(station.windKmH, null); assert.equal(station.pressurePa, null);
});
test('terrain catalogue strips upstream markup and excludes artist concepts and untrusted image hosts', () => {
  const item = (title, image = 'https://images-assets.nasa.gov/image.jpg') => ({ data: [{ nasa_id: 'PIA123', media_type: 'image', title, description: 'Mars rover <script>bad()</script> terrain', date_created: '2020-01-01', secondary_creator: '<b>NASA/JPL</b>' }], links: [{ rel: 'alternate', render: 'image', href: image }] });
  const data = normalizeImages({ collection: { items: [item('Mars terrain'), item('Artist concept of Mars'), item('Illustration of Mars'), item('Mars image', 'https://example.com/image.jpg')] } }, 'mars');
  assert.equal(data.length, 1); assert.equal(data[0].credit, 'NASA/JPL'); assert.equal(data[0].description, 'Mars rover terrain'); assert.ok(data[0].source.includes('/details/PIA123'));
});

test('slow upstream failures leave enough time to return a saved table before the function deadline', async () => {
  let now = Date.parse(snapshot.fetchedAt) + 43200001, calls = 0; const start = now;
  const read = createSolarService({ seed: snapshot, now: () => now, fetchImpl: async () => { calls++; now += 12000; throw Error('Timeout'); } });
  const value = await read('ephemeris');
  assert.equal(value.status, 200); assert.equal(value.body.stale, true); assert.equal(calls, 4); assert.ok(now - start < 55000);
});

test('terrain search excludes laboratory photos whose mission boilerplate mentions planetary terrain', () => {
  const item = (title, caption) => ({ data: [{ nasa_id: title, media_type: 'image', title, description: 'NASA Curiosity explores Mars surface terrain.', description_508: caption }], links: [{ rel: 'alternate', render: 'image', href: 'https://images-assets.nasa.gov/image.jpg' }] });
  const values = normalizeImages({ collection: { items: [item('Twin Rover Twins', 'Engineering models in a garage at the Mars Yard.'), item('3D Glasses Used for Rover Driving', 'Vandi Verma, an engineer, is seen here working as a driver.'), item('MARDI Peeks Under Curiosity', 'This pair shows the Martian surface captured by the Mars Science Laboratory rover.')] } }, 'mars');
  assert.equal(values.length, 1); assert.equal(values[0].title, 'MARDI Peeks Under Curiosity');
});

test('planet cloud galleries exclude moon-only observations and simulated views', () => {
  const item = title => ({ data: [{ nasa_id: title, media_type: 'image', title, description: 'Cassini and Juno observations of Saturn and Jupiter clouds.' }], links: [{ rel: 'alternate', render: 'image', href: 'https://images-assets.nasa.gov/image.jpg' }] });
  assert.deepEqual(normalizeImages({ collection: { items: [item('Equatorial Titan Clouds'), item('Saturn clouds')] } }, 'saturn').map(value => value.title), ['Saturn clouds']);
  assert.deepEqual(normalizeImages({ collection: { items: [item('What Juno Will See at Jupiter Simulation'), item('Jupiter clouds')] } }, 'jupiter').map(value => value.title), ['Jupiter clouds']);
});
