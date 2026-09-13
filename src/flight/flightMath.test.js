import test from 'node:test';
import assert from 'node:assert/strict';
import { approachSpeed, arrivalRadius, collisionRadius, dampFactor, segmentSphereEntry } from './flightMath.js';

const point = (x, y = 0, z = 0) => ({ x, y, z });

test('swept collision catches a ship that crosses an entire planet in one frame', () => {
  assert.equal(segmentSphereEntry(point(-30), point(30), point(0), 5), 25 / 60);
});
test('collision is absent for paths that miss the surface or travel away', () => {
  assert.equal(segmentSphereEntry(point(-30, 6), point(30, 6), point(0), 5), null);
  assert.equal(segmentSphereEntry(point(7), point(30), point(0), 5), null);
});
test('collision resolves overlap, tangency, and a stationary vessel', () => {
  assert.equal(segmentSphereEntry(point(0), point(0), point(0), 5), 0);
  assert.equal(segmentSphereEntry(point(10), point(10), point(0), 5), null);
  assert.equal(segmentSphereEntry(point(-10, 5), point(10, 5), point(0), 5), .5);
});
test('navigation arrival always leaves greater clearance than the collision envelope', () => {
  for (const radius of [.1, 2, 5, 13, 30, 100]) assert.ok(arrivalRadius(radius) > collisionRadius(radius) + 1);
});
test('damping composes over time independently of frame rate', () => {
  const rate = 7;
  const whole = 1 - dampFactor(rate, 1);
  for (const fps of [30, 60, 144]) {
    const stepped = Math.pow(1 - dampFactor(rate, 1 / fps), fps);
    assert.ok(Math.abs(whole - stepped) < 1e-12);
  }
});
test('autopilot slows to zero at destination and obeys its speed cap', () => {
  assert.equal(approachSpeed(0, 120), 0);
  assert.equal(approachSpeed(-3, 120), 0);
  assert.equal(approachSpeed(10000, 120), 120);
  assert.ok(approachSpeed(1, 120) < approachSpeed(10, 120));
});
