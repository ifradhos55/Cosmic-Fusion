import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sampleState, scenePosition, displayRadius, orbitGuide, Ephemeris, DAY_MS, AU_KM } from './ephemeris.js';
const snapshot = JSON.parse(await readFile(new URL('../../public/data/ephemeris-snapshot.json', import.meta.url)));
test('Hermite vectors reproduce curved motion and velocity without extrapolation', () => {
  const samples = [[0, 0, 0, 0, 0, 0, 0], [DAY_MS, 1, 1, 1, 2, 2, 2]]; // p = t squared
  const halfway = sampleState(samples, DAY_MS / 2);
  assert.deepEqual(halfway.position, [.25, .25, .25]); assert.deepEqual(halfway.velocity, [1, 1, 1]);
  assert.equal(sampleState(samples, -1), null); assert.equal(sampleState(samples, DAY_MS + 1), null); assert.deepEqual(sampleState(samples, DAY_MS).position, [1, 1, 1]);
});
test('compressed positions preserve ecliptic direction and a common radius mapping', () => {
  assert.deepEqual(scenePosition([1, 0, 0]), [29, 0, -0]);
  assert.deepEqual(scenePosition([0, 1, 0]), [0, 0, -29]);
  const position = scenePosition([.6, .8, .01]); assert.ok(Math.abs(position[0] / -position[2] - .75) < 1e-12);
  for (let au = 0; au < 35; au += .05) assert.ok(displayRadius(au + .05) > displayRadius(au));
});
test('actual JPL snapshot interpolates all planets and asteroids with physical units', () => {
  const ephemeris = new Ephemeris(snapshot), at = Date.parse('2026-10-06T12:00:00Z');
  for (const id of Object.keys(snapshot.data.bodies)) assert.ok(ephemeris.at(id, at)?.position.every(Number.isFinite));
  const earth = ephemeris.metrics('earth', at), sun = ephemeris.metrics('sun', at);
  assert.ok(ephemeris.metrics('moon', at).earthAU > .002 && ephemeris.metrics('moon', at).earthAU < .003);
  assert.equal(earth.earthAU, 0); assert.ok(earth.sunAU > .98 && earth.sunAU < 1.02); assert.ok(earth.speedKmS > 28 && earth.speedKmS < 31);
  assert.equal(sun.lightSeconds, sun.earthAU * AU_KM / 299792.458);
  assert.equal(ephemeris.metrics('earth', ephemeris.end + 1), null);
  assert.throws(() => new Ephemeris({ ...snapshot, data: { ...snapshot.data, start: NaN } }));
});
test('orbit guides represent a finite closed ellipse in the state plane', () => {
  const points = orbitGuide({ position: [1, 0, 0], velocity: [0, Math.sqrt(.0002959122082855911), 0] });
  assert.equal(points.length, 384); assert.ok(points.every(point => point.every(Number.isFinite) && Math.abs(Math.hypot(...point) - 29) < 1e-8 && point[1] === 0));
  assert.deepEqual(orbitGuide({ position: [0, 0, 0], velocity: [0, 0, 0] }), []);
});
