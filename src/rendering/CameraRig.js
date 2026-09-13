import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SOLAR_POSITION } from '../simulation/galaxy/distribution.js';

export class CameraRig {
  constructor(camera, element) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, element);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.065, minDistance: 3, maxDistance: 480, enablePan: true, screenSpacePanning: true, rotateSpeed: 0.6, zoomSpeed: 0.8, zoomToCursor: true });
    this.body = null;
    this.transition = null;
    this.lastPosition = new THREE.Vector3();
    this.controls.addEventListener('start', () => { this.transition = null; });
    this.element = element;
    this.skyTouches = new Map();
    this.skyTouchStart = event => {
      if (this.skyMode && event.pointerType === 'touch') this.skyTouches.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
    };
    this.skyTouchMove = event => {
      if (!this.skyMode || !this.skyTouches.has(event.pointerId)) return;
      const points = [...this.skyTouches.values()];
      const before = points.length === 2 ? points[0].distanceTo(points[1]) : 0;
      this.skyTouches.get(event.pointerId).set(event.clientX, event.clientY);
      if (before > 0) {
        const after = points[0].distanceTo(points[1]);
        if (after > 0) { event.preventDefault(); this.zoom(before/after); }
      }
    };
    this.skyTouchEnd = event => this.skyTouches.delete(event.pointerId);
    element.addEventListener('pointerdown', this.skyTouchStart);
    element.addEventListener('pointermove', this.skyTouchMove, { passive: false });
    element.addEventListener('pointerup', this.skyTouchEnd);
    element.addEventListener('pointercancel', this.skyTouchEnd);
    this.skyWheel = event => { if (this.skyMode) { event.preventDefault(); this.zoom(Math.exp(event.deltaY * .001)); } };
    element.addEventListener('wheel', this.skyWheel, { passive: false });
  }
  orbitalMode() {
    this.skyMode = false;
    this.skyTouches.clear();
    this.camera.fov = 42;
    this.camera.updateProjectionMatrix();
    Object.assign(this.controls, { maxDistance: 480, enablePan: true, enableZoom: true, rotateSpeed: .6 });
  }
  focus(body, immediate = false) {
    this.orbitalMode();
    this.body = body;
    this.lastPosition.copy(body.position);
    this.controls.minDistance = body.radius * 1.45;
    const outward = body.position.clone().normalize();
    if (outward.lengthSq() === 0) outward.set(1, 0, 0);
    const offset = outward.multiplyScalar(-1).applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.8);
    offset.y = 0.35;
    offset.normalize().multiplyScalar(body.radius * (body.id === 'saturn' ? 7.7 : 4.8));
    this.moveTo(body.position, offset, immediate);
  }
  overview(immediate = false) {
    this.orbitalMode();
    this.body = null;
    this.controls.minDistance = 15;
    this.moveTo(new THREE.Vector3(), new THREE.Vector3(25, 142, 170), immediate);
  }
  galaxy(immediate = false, perspective = 'structure') {
    this.orbitalMode();
    this.body = null;
    this.controls.minDistance = 30;
    this.controls.maxDistance = 1200;
    const offset = perspective === 'edge' ? new THREE.Vector3(40, 34, 700) : new THREE.Vector3(35, 510, 530);
    this.moveTo(new THREE.Vector3(), offset, immediate);
  }
  galaxySky() {
    this.body = null; this.transition = null; this.skyMode = true;
    this.camera.position.fromArray(SOLAR_POSITION);
    this.camera.up.set(0, 1, 0);
    this.camera.fov = 72;
    this.camera.updateProjectionMatrix();
    const direction = new THREE.Vector3(...SOLAR_POSITION).negate().normalize();
    this.controls.target.copy(this.camera.position).addScaledVector(direction, .01);
    Object.assign(this.controls, { minDistance: .01, maxDistance: .01, enablePan: false, enableZoom: false, rotateSpeed: -.3 });
    this.controls.update();
  }
  moveTo(target, offset, immediate) {
    this.camera.up.set(0, 1, 0);
    if (immediate) {
      this.controls.target.copy(target);
      this.camera.position.copy(target).add(offset);
      this.camera.lookAt(target);
      this.transition = null;
      this.controls.update();
    } else this.transition = { fromPosition: this.camera.position.clone(), fromTarget: this.controls.target.clone(), offset, progress: 0, target: target.clone() };
  }
  update(dt) {
    if (!this.controls.enabled) return;
    if (this.transition) {
      const t = this.transition;
      t.progress = Math.min(1, t.progress + dt / 1.4);
      const ease = 1 - (1 - t.progress) ** 3;
      if (this.body) t.target.copy(this.body.position);
      this.controls.target.lerpVectors(t.fromTarget, t.target, ease);
      this.camera.position.lerpVectors(t.fromPosition, t.target.clone().add(t.offset), ease);
      if (t.progress === 1) this.transition = null;
    } else if (this.body) {
      const displacement = this.body.position.clone().sub(this.lastPosition);
      this.camera.position.add(displacement);
      this.controls.target.add(displacement);
    }
    if (this.body) this.lastPosition.copy(this.body.position);
    this.controls.update();
  }
  zoom(factor) {
    if (this.skyMode) {
      this.camera.fov = THREE.MathUtils.clamp(this.camera.fov * factor, 28, 95);
      this.camera.updateProjectionMatrix();
      return;
    }
    this.transition = null;
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, this.controls.minDistance, this.controls.maxDistance));
    this.camera.position.copy(this.controls.target).add(offset);
  }
  dispose() {
    this.element.removeEventListener('wheel', this.skyWheel);
    this.element.removeEventListener('pointerdown', this.skyTouchStart);
    this.element.removeEventListener('pointermove', this.skyTouchMove);
    this.element.removeEventListener('pointerup', this.skyTouchEnd);
    this.element.removeEventListener('pointercancel', this.skyTouchEnd);
    this.controls.dispose();
  }
}
