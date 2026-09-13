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
