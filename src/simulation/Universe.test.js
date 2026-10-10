import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Universe } from './Universe.js';

// These checks exercise the scene model without a GPU. Shader/render coverage
// belongs to the browser smoke check; canvas/image stand-ins keep this offline.
const originalDocument = globalThis.document;
const originalWindow = globalThis.window;
let universe;
let scene;

before(() => {
  const context = {
    createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
    putImageData() {}, createRadialGradient: () => ({ addColorStop() {} }),
    beginPath() {}, ellipse() {}, fill() {}, fillRect() {},
  };
  globalThis.document = {
    createElement: () => ({ getContext: () => context }),
    createElementNS: () => ({ addEventListener() {}, removeEventListener() {} }),
  };
  globalThis.window = { devicePixelRatio: 1 };
  scene = new THREE.Scene();
  universe = new Universe(scene, { capabilities: { getMaxAnisotropy: () => 4 } });
});

after(() => {
  universe.dispose();
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});

test('a complete Earth year closes its orbit while preserving the live navigation position reference', () => {
  universe.update(0, 0);
  const earth = universe.getBody('earth');
  const livePosition = earth.position;
  const initialPosition = livePosition.clone();
  universe.update(earth.data.orbitalPeriod / 2, 0);
  assert.ok(initialPosition.clone().add(livePosition).length() < 1e-9, 'half-year position should be opposite the Sun');
  universe.update(earth.data.orbitalPeriod, 0);
  assert.ok(initialPosition.distanceTo(livePosition) < 1e-9);
  assert.equal(earth.position, livePosition);
  assert.equal(earth.root.position, livePosition);
});

test('forward and reverse time keep every planet on its orbital plane and outside the Sun', () => {
  for (const days of [-1e6, -365.25, 0, 1, 365.25, 1e6]) {
    universe.update(days, 1 / 60);
    for (const body of universe.bodies.filter(body => body.id !== 'sun')) {
      assert.ok(body.position.toArray().every(Number.isFinite), `${body.id} position stays finite`);
      assert.ok(Math.abs(body.position.length() - body.orbitRadius) < 1e-8, `${body.id} stays on its orbit`);
      assert.ok(body.position.length() - body.radius > universe.getBody('sun').radius);
      assert.ok(Number.isFinite(body.mesh.rotation.y));
    }
  }
});

test('hiding orbital guides also keeps the Moon guide hidden when selection changes', () => {
  universe.setOrbits(false);
  universe.selectBody('saturn');
  universe.selectBody('earth');
  assert.ok([...universe.orbits.values()].every(orbit => !orbit.visible));
  assert.equal(universe.moonOrbit.visible, false);
  universe.setOrbits(true);
  assert.equal(universe.moonOrbit.visible, true);
  universe.selectBody('mars');
  assert.equal(universe.moonOrbit.visible, false);
});

test('installing JPL tables preserves body references and uses true vectors for all selectable objects', async () => {
  const { readFile } = await import('node:fs/promises');
  const { Ephemeris, scenePosition } = await import('./ephemeris.js');
  const { EPOCH } = await import('../core/SimulationClock.js');
  const ephemeris = new Ephemeris(JSON.parse(await readFile(new URL('../../public/data/ephemeris-snapshot.json', import.meta.url))));
  const at = Date.parse('2026-10-06T12:00:00Z'), earth = universe.getBody('earth'), reference = earth.position;
  universe.setEphemeris(ephemeris, at); universe.update((at - EPOCH) / 86400000, 0);
  assert.equal(earth.position, reference); assert.equal(universe.navigationBodies.length, 14);
  for (const body of universe.navigationBodies) assert.ok(body.position.distanceTo(new THREE.Vector3(...scenePosition(ephemeris.at(body.id, at).position))) < 1e-9);
  // Check the rendered world-space axes, including the Moon's parent hierarchy.
  for (let time = ephemeris.start; time <= ephemeris.end; time += 86400000) {
    universe.update((time - EPOCH) / 86400000, 0);
    scene.updateMatrixWorld(true);
    assert.ok(universe.moon.position.distanceTo(new THREE.Vector3(...scenePosition(ephemeris.at('moon', time).position, true))) < 1e-9);
    const earthward = earth.position.clone().sub(universe.moon.getWorldPosition(new THREE.Vector3())).normalize();
    const near = new THREE.Vector3(1, 0, 0).applyQuaternion(universe.moon.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(near.dot(earthward) > .98, 'the rendered near side remains Earth-facing');
    assert.ok(earth.root.quaternion.equals(new THREE.Quaternion()), 'daily spin cannot rotate the lunar orbit');
    assert.ok(earth.mesh.quaternion.equals(new THREE.Quaternion()), 'no arbitrary surface spin is added to the geographic frame');
  }
  universe.setOrbits(false); assert.ok([...universe.orbits.values()].every(orbit => !orbit.visible));
});

test('disposing twice releases scene resources once and removes all owned content', () => {
  let geometryDisposals = 0, materialDisposals = 0;
  const sun = universe.getBody('sun');
  sun.mesh.geometry.addEventListener('dispose', () => geometryDisposals++);
  sun.mesh.material.addEventListener('dispose', () => materialDisposals++);
  universe.dispose();
  universe.dispose();
  assert.equal(geometryDisposals, 1);
  assert.equal(materialDisposals, 1);
  assert.equal(scene.children.includes(universe.group), false);
});
