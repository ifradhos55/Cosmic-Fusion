import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SphereGeometry, Vector3 } from 'three';
import { earthOrientation, moonOrientation, lockedMoonOrientation } from './orientation.js';
import { Ephemeris, scenePosition } from './ephemeris.js';

const RAD = Math.PI / 180;
const ephemeris = new Ephemeris(JSON.parse(readFileSync(new URL('../../public/data/ephemeris-snapshot.json', import.meta.url))));

test('the actual map center, north pole and east longitude match the sphere axes', () => {
  const sphere = new SphereGeometry(1, 32, 16);
  const position = sphere.getAttribute('position'), uv = sphere.getAttribute('uv');
  for (const [u, expected] of [[.5, [1, 0, 0]], [.75, [0, 0, -1]], [0, [-1, 0, 0]]]) {
    let index = -1;
    for (let i = 0; i < uv.count; i++) if (uv.getX(i) === u && uv.getY(i) === .5) index = i;
    assert.ok(index >= 0);
    assert.ok(new Vector3().fromBufferAttribute(position, index).distanceTo(new Vector3(...expected)) < 1e-6);
  }
  assert.equal(position.getY(0), 1, 'north is the top of the map');
  sphere.dispose();
});

test('near side faces Earth throughout a full JPL month, with bounded lunar libration', () => {
  const longitudes = [], latitudes = [];
  for (let time = ephemeris.start; time <= ephemeris.end; time += 3 * 3600000) {
    const direction = new Vector3(...scenePosition(ephemeris.at('moon', time).position, true)).negate().normalize();
    const q = moonOrientation(time);
    const near = new Vector3(1, 0, 0).applyQuaternion(q);
    const far = near.clone().negate();
    assert.ok(near.angleTo(direction) < 11 * RAD, new Date(time).toISOString());
    assert.ok(far.dot(direction) < -.98, 'the cratered far side faces away from Earth');
    const geographic = direction.applyQuaternion(q.clone().invert());
    longitudes.push(Math.atan2(-geographic.z, geographic.x) / RAD);
    latitudes.push(Math.asin(geographic.y) / RAD);
    assert.ok(Math.abs(q.length() - 1) < 1e-12);
  }
  assert.ok(Math.min(...longitudes) < -3 && Math.max(...longitudes) > 3);
  assert.ok(Math.min(...latitudes) < -3 && Math.max(...latitudes) > 3);
});

test('Earth has the known Greenwich sidereal orientation at J2000, including obliquity', () => {
  const q = earthOrientation(Date.UTC(2000, 0, 1, 12));
  // USNO: Greenwich mean sidereal time at J2000 is 18.697374558 hours.
  const greenwich = new Vector3(1, 0, 0).applyQuaternion(q);
  // Reverse scene (x,z,-y) and J2000 obliquity to recover equatorial RA.
  const epsilon = 23.439291111 * RAD;
  const equatorialY = -greenwich.z * Math.cos(epsilon) - greenwich.y * Math.sin(epsilon);
  const ra = (Math.atan2(equatorialY, greenwich.x) / RAD + 360) % 360;
  assert.ok(Math.abs(ra - 18.697374558 * 15) < 1e-6);
  const north = new Vector3(0, 1, 0).applyQuaternion(q);
  assert.ok(Math.abs(north.angleTo(new Vector3(0, 1, 0)) / RAD - 23.439291111) < 1e-8);
});

test('Earth geography completes a sidereal turn; time jumps do not accumulate spin', () => {
  const at = Date.parse('2026-10-10T03:02:14Z');
  const initial = earthOrientation(at);
  assert.ok(initial.angleTo(earthOrientation(at + 86164.0905 * 1000)) < 1e-6);
  assert.ok(initial.angleTo(earthOrientation(at + 43200000)) > 3);
  for (const orient of [earthOrientation, moonOrientation]) {
    const saved = orient(at);
    orient(at + 86400000 * 300); orient(at - 86400000 * 300);
    assert.ok(saved.angleTo(orient(at)) < 1e-7);
  }
});

test('the illustrative fallback locks its texture center to the actual Earth direction in 3D', () => {
  for (let i = -32; i <= 32; i++) {
    const angle = i * .2;
    const p = new Vector3(5.1 * Math.cos(angle), .45 * Math.sin(angle), 5.1 * Math.sin(angle));
    const near = new Vector3(1, 0, 0).applyQuaternion(lockedMoonOrientation(p));
    assert.ok(near.dot(p.clone().negate().normalize()) > 1 - 1e-12);
  }
});
