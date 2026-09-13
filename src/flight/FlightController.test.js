import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FlightController } from './FlightController.js';
import { arrivalRadius, collisionRadius } from './flightMath.js';

globalThis.window = { addEventListener() {}, removeEventListener() {} };
globalThis.document = { addEventListener() {}, removeEventListener() {}, pointerLockElement: null };

const body = (name, x, radius) => ({ data: { name }, position: new THREE.Vector3(x, 0, 0), radius });
const setup = () => {
  const camera = new THREE.PerspectiveCamera(50, 1, .05, 10000);
  camera.position.set(-130, 10, 25);
  return new FlightController({ camera, domElement: {}, scene: new THREE.Scene() });
};

test('manual acceleration and orientation remain stable across frame rates', () => {
  const simulate = (fps) => {
    const flight = setup();
    flight.enter();
    flight.setInput('forward', true);
    flight.setInput('right', true);
    for (let frame = 0; frame < fps * 2; frame++) flight.update(1 / fps);
    const result = { position: flight.ship.position.clone(), velocity: flight.velocity.clone(), orientation: flight.ship.quaternion.clone() };
    flight.dispose();
    return result;
  };
  const at30 = simulate(30), at60 = simulate(60), at144 = simulate(144);
  assert.ok(at30.position.distanceTo(at60.position) < 1e-8);
  assert.ok(at144.position.distanceTo(at60.position) < .7, 'sub-frame integration differences remain small');
  assert.ok(at144.orientation.angleTo(at60.orientation) < .015);
  assert.ok(at60.velocity.length() > 20);
});

test('manual launch starts pointed away from a planet surface', () => {
  const flight = setup();
  const planet = body('Earth', 0, 2);
  flight.enter(planet);
  const radial = flight.ship.position.clone().sub(planet.position).normalize();
  const nose = new THREE.Vector3(0, 0, -1).applyQuaternion(flight.ship.quaternion);
  assert.ok(nose.dot(radial) > .99, 'the first thrust input must move away from the launch body');
  flight.dispose();
});

test('autopilot routes around an intervening star and arrives outside the target surface', () => {
  const flight = setup();
  const bodies = [body('Origin', -100, 5), body('Star', 0, 15), body('Destination', 100, 5)];
  flight.enter(bodies[0]);
  flight.setDestination(bodies[2]);
  let closestToStar = Infinity;
  let telemetry;
  for (let frame = 0; frame < 60 * 16; frame++) {
    telemetry = flight.update(1 / 60, bodies);
    closestToStar = Math.min(closestToStar, flight.ship.position.distanceTo(bodies[1].position));
  }
  assert.equal(telemetry.arrived, true);
  assert.equal(telemetry.autopilot, true, 'arrival holds position until the pilot takes control');
  assert.ok(closestToStar > collisionRadius(15));
  assert.ok(Math.abs(flight.ship.position.distanceTo(bodies[2].position) - arrivalRadius(5)) < .1);
  assert.ok(telemetry.speed < .1);
  flight.dispose();
});

test('assisted inner-world approaches settle without a navigation loop', () => {
  for (const [name, x, z, radius] of [['Earth', 29, 0, 2], ['Mars', 0, 37, 1.22]]) {
    const flight = setup();
    const target = body(name, x, radius);
    target.position.z = z;
    flight.enter();
    flight.setDestination(target);
    for (let frame = 0; frame < 60 * 12; frame++) flight.update(1 / 60, [target]);
    assert.equal(flight._telemetry.arrived, true, `${name} should reach station keeping`);
    assert.ok(flight._telemetry.speed < .1);
    assert.ok(flight.ship.position.distanceTo(target.position) > radius + 1.8);
    flight.dispose();
  }
});

test('collision guard prevents high-speed surface penetration and camera clipping', () => {
  const flight = setup();
  const planet = body('Planet', 0, 5);
  flight.enter(planet);
  flight.ship.position.set(0, 0, 12);
  flight.ship.quaternion.identity();
  flight.velocity.set(0, 0, -180);
  flight.setInput('boost', true);
  flight.update(.12, [planet]);
  assert.ok(flight.ship.position.length() >= collisionRadius(planet.radius));
  assert.ok(flight.camera.position.length() >= planet.radius + .59);
  assert.ok(flight.velocity.z >= 0);
  flight.dispose();
});

test('manual input cancels navigation and blur/exit clear held controls', () => {
  const flight = setup();
  const planet = body('Planet', 0, 5);
  flight.enter(planet);
  flight.setDestination(planet);
  flight.setInput('forward', true);
  assert.equal(flight.update(1 / 60, [planet]).autopilot, false);
  flight._onBlur();
  assert.equal(flight.inputs.size, 0);
  flight.setInput('boost', true);
  flight.exit();
  assert.equal(flight.active, false);
  assert.equal(flight.inputs.size, 0);
  assert.equal(flight.velocity.length(), 0);
  flight.dispose();
});

test('cockpit camera looks along vessel negative Z after a view change', () => {
  const flight = setup();
  flight.enter();
  flight.ship.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), .7);
  flight.setView('cockpit');
  const shipForward = new THREE.Vector3(0, 0, -1).applyQuaternion(flight.ship.quaternion);
  const cameraForward = flight.camera.getWorldDirection(new THREE.Vector3());
  assert.ok(shipForward.distanceTo(cameraForward) < 1e-10);
  flight.dispose();
});
