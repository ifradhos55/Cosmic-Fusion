import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { generateGalaxy, STAR_COUNTS } from './galaxy/distribution.js';
import { Galaxy } from './Galaxy.js';

test('the galaxy contains over 100,000 independent finite stars at every quality level', () => {
  const galaxy = new Galaxy(new THREE.Scene());
  const positions = galaxy.stars.geometry.attributes.position;
  assert.equal(positions.count, 260000);
  assert.ok(positions.array.every(Number.isFinite));
  const first = Array.from(positions.array.slice(0, 1500));
  assert.ok(new Set(first).size > 1400, 'Particles must occupy individual positions');
  for (const quality of ['high', 'balanced']) {
    galaxy.setQuality(quality);
    assert.ok(galaxy.starCount > 100000);
    assert.equal(galaxy.stars.geometry.drawRange.count, STAR_COUNTS[quality]);
  }
  galaxy.dispose(); galaxy.dispose();
});

test('the seeded galaxy is stable and keeps a thin disk, central bar and sparse halo', () => {
  const a = generateGalaxy(5000), b = generateGalaxy(5000);
  assert.deepEqual(a.positions, b.positions);
  let thin = 0, halo = 0, barX = 0, barZ = 0;
  for (let i = 0; i < a.populations.length; i++) {
    if (Math.abs(a.positions[i*3+1]) < 15) thin++;
    if (a.populations[i] === 4) halo++;
    if (a.populations[i] === 0) { barX += a.positions[i*3]**2; barZ += a.positions[i*3+2]**2; }
  }
  assert.ok(thin > 4500, 'Most stars belong to a thin disk');
  assert.ok(halo > 60 && halo < 200, 'Halo must remain sparse');
  assert.ok(barX > barZ*3, 'The center must form a bar rather than a sphere');
});
