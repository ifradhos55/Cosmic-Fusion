import * as THREE from 'three';
import { createShip, updateShip } from './createShip.js';
import { approachSpeed, arrivalRadius, clamp, collisionRadius, dampFactor, segmentSphereEntry } from './flightMath.js';

const FORWARD = new THREE.Vector3(0, 0, -1);
const UP = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const KEY_ACTION = {
  KeyW: 'forward', KeyS: 'reverse', KeyA: 'left', KeyD: 'right',
  ArrowUp: 'pitchUp', ArrowDown: 'pitchDown', ArrowLeft: 'left', ArrowRight: 'right',
  KeyQ: 'rollLeft', KeyE: 'rollRight', ShiftLeft: 'boost', ShiftRight: 'boost', Space: 'brake',
};
const ACTION_ALIAS = { throttle: 'forward', backward: 'reverse', yawLeft: 'left', yawRight: 'right', up: 'pitchUp', down: 'pitchDown' };
const MANUAL_ACTIONS = new Set(['forward', 'reverse', 'left', 'right', 'pitchUp', 'pitchDown', 'rollLeft', 'rollRight']);
const bodyPosition = (body) => body.position || body.root?.position || body.mesh?.position;
const bodyName = (body) => body?.data?.name || body?.name || 'Free flight';

/** Inertial flight with gentle stabilization and optional collision-safe navigation. */
export class FlightController {
  constructor({ camera, domElement, scene }) {
    this.camera = camera;
    this.domElement = domElement;
    this.scene = scene;
    this.ship = createShip();
    this.ship.visible = false;
    scene.add(this.ship);
    this.active = false;
    this.velocity = new THREE.Vector3();
    this.angularVelocity = new THREE.Vector3();
    this.inputs = new Set();
    this.touchSteering = new THREE.Vector2();
    this.touchThrottle = 0;
    this.touchAssist = false;
    this.view = 'chase';
    this._destination = null;
    this._autopilot = false;
    this._arrived = false;
    this._approach = new THREE.Vector3(0, .25, 1).normalize();
    this._mouse = new THREE.Vector2();
    this._elapsed = 0;
    this._warning = '';
    this._warningUntil = 0;
    this._lastTarget = new THREE.Vector3();
    this._targetVelocity = new THREE.Vector3();
    this._targetSampleValid = false;
    this._waypoint = null;
    this._bodies = [];
    this._telemetry = { speed: 0, boosting: false, autopilot: false, arrived: false, distance: 0, targetName: 'Free flight', view: this.view, pointerLocked: false, warning: '' };
    this._onKeyDown = (event) => {
      if (!this.active || /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName) || event.target?.isContentEditable) return;
      const action = KEY_ACTION[event.code];
      if (action) { event.preventDefault(); this.setInput(action, true); }
    };
    this._onKeyUp = (event) => {
      const action = KEY_ACTION[event.code];
      if (action) { if (this.active) event.preventDefault(); this.setInput(action, false); }
    };
    this._onBlur = () => this._clearInputs();
    this._onMouseMove = (event) => {
      if (this.active && this.pointerLocked) {
        this._mouse.x += event.movementX || 0;
        this._mouse.y += event.movementY || 0;
        if (Math.abs(event.movementX) + Math.abs(event.movementY) > 1) this.cancelAutopilot();
      }
    };
    this._onVisibility = () => { if (document.hidden) this._clearInputs(); };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('visibilitychange', this._onVisibility);
  }

  get pointerLocked() { return document.pointerLockElement === this.domElement; }

  enter(targetBody) {
    if (this.active) return;
    this.active = true;
    this.ship.visible = true;
    this._clearInputs();
    this.reset(targetBody);
    this._telemetry = { ...this._telemetry, speed: 0, boosting: false, autopilot: false, arrived: false, distance: 0, targetName: bodyName(targetBody), view: this.view, pointerLocked: this.pointerLocked, warning: '' };
    this._updateCamera(1, true);
  }

  exit() {
    this.active = false;
    this.ship.visible = false;
    this._clearInputs();
    this.cancelAutopilot();
    this.velocity.set(0, 0, 0);
    this.angularVelocity.set(0, 0, 0);
    if (this.pointerLocked) document.exitPointerLock?.();
  }

  /** Pointer lock is exclusively opt-in; all controls also work with keyboard/touch. */
  engagePointerLock() {
    if (!this.active || !this.domElement.requestPointerLock) return;
    try {
      const request = this.domElement.requestPointerLock();
      request?.catch?.(() => this._showWarning('Mouse capture unavailable. Keyboard controls remain active.', 5));
    } catch {
      this._showWarning('Mouse capture unavailable. Keyboard controls remain active.', 5);
    }
  }

  setInput(action, pressed) {
    action = ACTION_ALIAS[action] || action;
    if (pressed) {
      if (!this.active) return;
      this.inputs.add(action);
      if (MANUAL_ACTIONS.has(action) || action === 'brake') this.cancelAutopilot();
    } else this.inputs.delete(action);
  }

  setTouchSteering(x, y) {
    this.touchSteering.set(clamp(x, -1, 1), clamp(y, -1, 1));
    if (this.touchSteering.lengthSq() > 0) this.cancelAutopilot();
  }

  setTouchThrottle(value) {
    this.touchThrottle = clamp(value, -1, 1);
    if (value) this.cancelAutopilot();
  }

  setView(view) {
    if (view !== 'chase' && view !== 'cockpit') return;
    this.view = view;
    if (this.active) this._updateCamera(1, true);
  }

  reset(body = this._destination) {
    this.cancelAutopilot();
    this._destination = body || null;
    this.velocity.set(0, 0, 0);
    this.angularVelocity.set(0, 0, 0);
    this._clearInputs();
    const center = body && bodyPosition(body);
    const position = center ? center.clone() : new THREE.Vector3();
    const radial = center ? this.camera.position.clone().sub(center) : new THREE.Vector3(0, .3, 1);
    if (radial.lengthSq() < .01) radial.set(0, .25, 1);
    radial.normalize();
    // Give the chase camera and the entire vessel generous surface clearance.
    this.ship.position.copy(position).addScaledVector(radial, body ? arrivalRadius(body.radius) + 9 : 35);
    // A manual launch faces away from the surface. The former controller
    // pointed the nose into Earth/Mars, so the first W thrust immediately hit
    // the collision guard and kicked the craft into a confusing spin.
    const launchLook = this.ship.position.clone().add(radial);
    this.ship.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(this.ship.position, launchLook, UP));
    this._approach.copy(radial);
    this._warning = '';
    this._warningUntil = 0;
    this._targetSampleValid = false;
    if (this.active) this._updateCamera(1, true);
  }

  setDestination(body) {
    if (!body || !bodyPosition(body)) return;
    this._destination = body;
    this._approach.copy(this.ship.position).sub(bodyPosition(body));
    if (this._approach.lengthSq() < .01) this._approach.copy(UP);
    this._approach.normalize();
    this._autopilot = true;
    this._arrived = false;
    this._waypoint = null;
    this._targetSampleValid = false;
    this._clearInputs();
    this._telemetry = { ...this._telemetry, speed: this.velocity.length(), boosting: false, autopilot: true, arrived: false, distance: Math.max(0, this.ship.position.distanceTo(bodyPosition(body)) - body.radius), targetName: bodyName(body), view: this.view, pointerLocked: this.pointerLocked };
  }

  cancelAutopilot() {
    this._autopilot = false;
    this._arrived = false;
    this._waypoint = null;
    this._targetSampleValid = false;
    this._telemetry = { ...this._telemetry, autopilot: false, arrived: false };
  }

  brake() {
    this.cancelAutopilot();
    this.velocity.set(0, 0, 0);
    this.angularVelocity.set(0, 0, 0);
    this._showWarning('All stop · velocity cancelled', 2);
  }

  _clearInputs() { this.inputs.clear(); this._mouse.set(0, 0); this.touchSteering.set(0, 0); this.touchThrottle = 0; }

  _showWarning(message, duration = 1) {
    this._warning = message;
    this._warningUntil = this._elapsed + duration;
  }

  update(delta, bodies = []) {
    if (!this.active) return this._telemetry;
    const dt = clamp(Number.isFinite(delta) ? delta : 0, 0, .12);
    this._elapsed += dt;
    this._bodies = bodies;
    if (this._elapsed > this._warningUntil) this._warning = '';
    const boosting = this.inputs.has('boost') && !this._autopilot && !this.inputs.has('brake');
    if (this._autopilot && this._destination) this._sampleTargetVelocity(dt);
    if (this._mouse.lengthSq() > 0) {
      this._rotate(-this._mouse.y * .002, -this._mouse.x * .002, 0);
      this._mouse.set(0, 0);
    }
    const steps = Math.max(1, Math.ceil(dt / (1 / 60)));
    for (let step = 0; step < steps; step++) {
      const stepDt = dt / steps;
      if (this._autopilot && this._destination) this._updateAutopilot(stepDt, bodies);
      else this._updateManual(stepDt, boosting);
      this._moveSafely(stepDt, bodies);
    }
    this.ship.updateMatrixWorld(true);
    this._updateCamera(dt);
    const speed = this.velocity.length();
    updateShip(this.ship, clamp(speed / 52, 0, 1), boosting, this._elapsed);
    let distance = 0;
    if (this._destination) distance = Math.max(0, this.ship.position.distanceTo(bodyPosition(this._destination)) - this._destination.radius);
    this._telemetry = { speed, boosting, autopilot: this._autopilot, arrived: this._arrived, distance, targetName: bodyName(this._destination), view: this.view, pointerLocked: this.pointerLocked, warning: this._warning };
    return this._telemetry;
  }

  _rotate(pitch, yaw, roll) {
    const rotation = new THREE.Quaternion();
    if (yaw) this.ship.quaternion.multiply(rotation.setFromAxisAngle(Y, yaw));
    if (pitch) this.ship.quaternion.multiply(rotation.setFromAxisAngle(X, pitch));
    if (roll) this.ship.quaternion.multiply(rotation.setFromAxisAngle(Z, roll));
    this.ship.quaternion.normalize();
  }

  _updateManual(dt, boosting) {
    const input = (positive, negative) => Number(this.inputs.has(positive)) - Number(this.inputs.has(negative));
    const desiredAngular = new THREE.Vector3(clamp(input('pitchUp', 'pitchDown') - this.touchSteering.y, -1, 1), clamp(input('left', 'right') - this.touchSteering.x, -1, 1), input('rollLeft', 'rollRight')).multiplyScalar(boosting ? .75 : 1.12);
    this.angularVelocity.lerp(desiredAngular, dampFactor(8, dt));
    this._rotate(this.angularVelocity.x * dt, this.angularVelocity.y * dt, this.angularVelocity.z * dt);
    if (this.inputs.has('brake')) {
      this.velocity.multiplyScalar(Math.exp(-6 * dt));
      if (this.velocity.lengthSq() < .0025) this.velocity.set(0, 0, 0);
      return;
    }
    const thrust = clamp(input('forward', 'reverse') + this.touchThrottle, -1, 1);
    const forward = FORWARD.clone().applyQuaternion(this.ship.quaternion);
    this.velocity.addScaledVector(forward, thrust * (boosting ? 95 : 26) * dt);
    // Flight assist damps lateral drift while preserving useful forward momentum.
    const axial = forward.clone().multiplyScalar(this.velocity.dot(forward));
    this.velocity.lerp(axial, dampFactor(1.35, dt));
    this.velocity.multiplyScalar(Math.exp(-(this.touchAssist && !thrust ? 2.4 : .1) * dt));
    this.velocity.clampLength(0, boosting ? 180 : 52);
  }

  _sampleTargetVelocity(dt) {
    const center = bodyPosition(this._destination);
    if (this._targetSampleValid && dt > 0) this._targetVelocity.copy(center).sub(this._lastTarget).divideScalar(dt).clampLength(0, 160);
    else this._targetVelocity.set(0, 0, 0);
    this._lastTarget.copy(center);
    this._targetSampleValid = true;
  }

  _navigationPoint(destination, bodies) {
    const position = this.ship.position;
    // Keep a committed bypass until reached to avoid left/right oscillation.
    if (this._waypoint && position.distanceTo(this._waypoint) > 3) return this._waypoint;
    this._waypoint = null;
    let obstacle = null;
    let earliest = Infinity;
    for (const body of bodies) {
      if (body === this._destination || body.id === this._destination?.id) continue;
      const radius = collisionRadius(body.radius) + Math.max(3, body.radius * .3);
      const center = bodyPosition(body);
      if (!center) continue;
      const hit = segmentSphereEntry(position, destination, center, radius);
      if (hit !== null && hit < earliest) { earliest = hit; obstacle = { center, radius }; }
    }
    if (!obstacle) return destination;
    const route = destination.clone().sub(position).normalize();
    const fromCenter = position.clone().sub(obstacle.center);
    let side = fromCenter.clone().addScaledVector(route, -fromCenter.dot(route));
    if (side.lengthSq() < .2) side.crossVectors(route, UP);
    if (side.lengthSq() < .2) side.set(1, 0, 0);
    side.normalize();
    // The radial offset is deliberately roomy enough to clear the approach chord.
    this._waypoint = obstacle.center.clone().addScaledVector(side, obstacle.radius * 2.2);
    this._showWarning('Navigation assist · routing around a celestial body', 2);
    return this._waypoint;
  }

  _updateAutopilot(dt, bodies) {
    const body = this._destination;
    const target = bodyPosition(body).clone().addScaledVector(this._approach, arrivalRadius(body.radius));
    const remaining = this.ship.position.distanceTo(target);
    const navPoint = this._navigationPoint(target, bodies);
    const delta = navPoint.clone().sub(this.ship.position);
    const distance = delta.length();
    const finalLeg = navPoint.distanceToSquared(target) < 1e-8;
    const arrivalThreshold = Math.max(.8, body.radius * .12);
    this._arrived = finalLeg && remaining < arrivalThreshold;
    if (this._arrived) {
      this.ship.position.copy(target);
      this.velocity.set(0, 0, 0);
      this.angularVelocity.set(0, 0, 0);
      this._arrived = true;
      return;
    }
    if (distance > .02) {
      const lookTarget = this._arrived ? bodyPosition(body) : navPoint;
      const orientation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(this.ship.position, lookTarget, UP));
      this.ship.quaternion.slerp(orientation, dampFactor(3.2, dt));
    }
    const speed = finalLeg ? Math.min(remaining * 1.3, approachSpeed(remaining, 130, 26)) : approachSpeed(distance, 115, 24);
    const desiredVelocity = distance > .001 ? delta.multiplyScalar(speed / distance) : new THREE.Vector3();
    if (finalLeg) desiredVelocity.add(this._targetVelocity);
    this.velocity.lerp(desiredVelocity, dampFactor(3.5, dt));
    this.angularVelocity.multiplyScalar(Math.exp(-7 * dt));
  }

  _moveSafely(dt, bodies) {
    const start = this.ship.position.clone();
    const end = start.clone().addScaledVector(this.velocity, dt);
    let first = null;
    let firstTime = Infinity;
    for (const body of bodies) {
      const center = bodyPosition(body);
      if (!center || !Number.isFinite(body.radius)) continue;
      const radius = collisionRadius(body.radius);
      const time = segmentSphereEntry(start, end, center, radius);
      if (time !== null && time < firstTime) { firstTime = time; first = { center, radius, body }; }
    }
    if (first) {
      const contact = start.clone().lerp(end, Math.max(0, firstTime - .001));
      const normal = contact.clone().sub(first.center);
      if (normal.lengthSq() < .0001) normal.copy(UP);
      normal.normalize();
      this.ship.position.copy(first.center).addScaledVector(normal, first.radius + .08);
      const inward = this.velocity.dot(normal);
      if (inward < 0) this.velocity.addScaledVector(normal, -inward);
      this.velocity.multiplyScalar(.7);
      this._waypoint = null;
      this._showWarning(`${bodyName(first.body)} proximity · collision avoidance active`, 2);
    } else this.ship.position.copy(end);
  }

  _updateCamera(dt, snap = false) {
    this.ship.updateMatrixWorld(true);
    let cameraPoint;
    let orientation;
    if (this.view === 'cockpit') {
      // The camera sits just above the canopy, retaining a sliver of nose as reference.
      cameraPoint = this.ship.localToWorld(new THREE.Vector3(0, .68, -.82));
      orientation = this.ship.quaternion.clone();
    } else {
      const framing = clamp(1 / this.camera.aspect, 1, 1.9);
      cameraPoint = this.ship.localToWorld(new THREE.Vector3(0, 3.1 * framing, 10.4 * framing));
      const lookAt = this.ship.localToWorld(new THREE.Vector3(0, .3, -7));
      const up = UP.clone().applyQuaternion(this.ship.quaternion);
      orientation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(cameraPoint, lookAt, up));
    }
    const blend = snap ? 1 : dampFactor(this.view === 'cockpit' ? 20 : 7, dt);
    this.camera.position.lerp(cameraPoint, blend);
    this.camera.quaternion.slerp(orientation, blend);
    // Avoid a following camera drifting through a surface during close maneuvers.
    for (const body of this._bodies) {
      const center = bodyPosition(body);
      if (!center) continue;
      const offset = this.camera.position.clone().sub(center);
      const radius = body.radius + .6;
      if (offset.lengthSq() < radius * radius) {
        if (offset.lengthSq() < .0001) offset.copy(UP);
        this.camera.position.copy(center).addScaledVector(offset.normalize(), radius);
      }
    }
    this.camera.updateMatrixWorld();
  }

  dispose() {
    this.exit();
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('visibilitychange', this._onVisibility);
    const geometries = new Set();
    const materials = new Set();
    this.ship.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    this.scene.remove(this.ship);
  }
}
