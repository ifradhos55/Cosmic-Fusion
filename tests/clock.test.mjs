import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SimulationClock } from '../src/core/SimulationClock.js';

// Time controls are exercised independently of rendering so flight and camera
// frame rate cannot silently change the simulation's elapsed days.
test('the clock advances at its selected speed and freezes while paused', () => {
  const clock = new SimulationClock();
  assert.equal(clock.speed, 0.1);
  clock.update(0.05);
  assert.ok(Math.abs(clock.days - 0.005) < 1e-9);
  const normalStep = clock.days;
  clock.setSpeed(10);
  clock.update(0.05);
  assert.ok(Math.abs(clock.days - (normalStep + 0.5)) < 1e-9);
  clock.paused = true;
  const pausedDays = clock.days;
  clock.update(0.05);
  assert.equal(clock.days, pausedDays);
});

test('large or negative frame intervals cannot jump time', () => {
  const ordinaryFrame = new SimulationClock();
  const resumedFrame = new SimulationClock();
  ordinaryFrame.update(0.1);
  resumedFrame.update(12);
  assert.equal(resumedFrame.days, ordinaryFrame.days);
  const beforeNegative = resumedFrame.days;
  resumedFrame.update(-1);
  assert.equal(resumedFrame.days, beforeNegative);
});

test('reset restores the epoch after advancing the simulation', () => {
  const clock = new SimulationClock();
  clock.setSpeed(100);
  clock.update(0.1);
  assert.ok(clock.days > 0);
  clock.reset();
  assert.equal(clock.days, 0);
  assert.equal(clock.date.toISOString(), '2026-01-01T00:00:00.000Z');
});

test('only supported simulation speed settings are accepted', () => {
  const clock = new SimulationClock();
  for (const speed of [0.1, 1, 10, 30, 100]) {
    clock.setSpeed(speed);
    assert.equal(clock.speed, speed);
  }
  const validSpeed = clock.speed;
  for (const speed of [0, -1, 5, Number.NaN, Number.POSITIVE_INFINITY]) {
    clock.setSpeed(speed);
    assert.equal(clock.speed, validSpeed);
  }
});
