import * as THREE from 'three';
import { createRenderer } from '../rendering/createRenderer.js';
import { CameraRig } from '../rendering/CameraRig.js';
import { Universe } from '../simulation/Universe.js';
import { FlightController } from '../flight/FlightController.js';
import { Galaxy } from '../simulation/Galaxy.js';
import { BODY_DATA } from '../data/bodies.js';
import { SimulationClock } from '../core/SimulationClock.js';
import { mountShell, modalContent } from '../ui/Shell.js';
import { objectPanel, overviewPanel, galaxyPanel, flightPanel } from '../ui/ObjectPanel.js';
import { icon } from '../ui/icons.js';

const STORAGE_KEY = 'cosmic-fusion-settings';

/** Coordinates the UI, simulation clock, camera and the two navigation modes. */
export class App {
  constructor(root) {
    this.root = root;
    this.clock = new SimulationClock();
    this.settings = { orbits: true, labels: true, quality: 'high' };
    try { this.settings = { ...this.settings, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; } catch { /* private browsing */ }
    this.selectedId = null;
    this.selectedBody = null;
    this.mode = 'explore';
    this.view = 'solar';
    this.galaxyPerspective = 'structure';
    this.orbitLocked = false;
    this.cleanView = false;
    this.running = false;
    this.lastFrame = 0;
    this.lastTelemetry = 0;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.dragStart = null;
    this.preFlightPaused = false;
    this.touchPointers = new Set();
    this.virtualJoystick = null;
    this.virtualActions = new Set();
    this.touchThrustPointers = new Set();
    this.bound = [];
  }

  start() {
    mountShell(this.root, BODY_DATA);
    this.root.querySelector('#time-speed').value = String(this.clock.speed);
    document.body.dataset.mode = 'explore';
    document.body.dataset.view = 'solar';
    document.body.classList.remove('clean-view');
    this.sceneHost = this.root.querySelector('#scene');
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x060a10, 0.00065);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.08, 5000);
    this.camera.position.set(25, 142, 170);
    this.renderer = createRenderer(this.sceneHost, this.settings.quality);
    this.cameraRig = new CameraRig(this.camera, this.renderer.domElement);
    this.universe = new Universe(this.scene, this.renderer);
    this.galaxy = new Galaxy(this.scene);
    this.universe.setOrbits(this.settings.orbits);
    this.universe.setQuality(this.settings.quality);
    this.galaxy.setQuality(this.settings.quality);
    this.flight = new FlightController({ camera: this.camera, domElement: this.renderer.domElement, scene: this.scene });
    this.overview();
    this.cameraRig.overview(true);
    this.bindEvents();
    this.updateLabels();
    this.running = true;
    this.lastFrame = performance.now();
    this.frameId = requestAnimationFrame(this.frame);
    this.resize();
    if (import.meta.env?.DEV) window.__COSMIC__ = { app: this };
  }

  frame = (now) => {
    if (!this.running) return;
    const dt = Math.min((now - this.lastFrame) / 1000 || 0, 0.12);
    this.lastFrame = now;
    if (this.mode === 'explore') {
      this.clock.update(dt);
      this.universe.update(this.clock.days, dt);
      if (this.view === 'galaxy') this.galaxy.update(dt);
      this.cameraRig.update(dt);
    } else {
      // Flight is deliberately a local navigation layer: freeze orbital drift while flying.
      this.flight.update(dt, this.universe.bodies);
    }
    this.updateSimulationUI();
    this.renderer.render(this.scene, this.camera);
    if (now - this.lastTelemetry > 80) {
      this.updateLabels();
      this.lastTelemetry = now;
    }
    this.frameId = requestAnimationFrame(this.frame);
  };

  bindEvents() {
    const on = (target, event, handler, options) => { target.addEventListener(event, handler, options); this.bound.push(() => target.removeEventListener(event, handler, options)); };
    on(this.root, 'click', event => {
      // A touch release can synthesize a click on the newly restored sidebar.
      if (event.pointerType === 'touch' && performance.now() < this.cleanTouchClickDeadline) {
        this.cleanTouchClickDeadline = 0;
        event.preventDefault(); event.stopImmediatePropagation();
      }
    }, true);
    on(this.root, 'click', this.handleClick);
    on(this.root, 'change', this.handleChange);
    on(this.root, 'pointerdown', this.handlePointerDown);
    on(this.root, 'pointermove', this.handlePointerMove);
    on(this.root, 'pointerup', this.handlePointerUp);
    on(this.root, 'pointercancel', this.handlePointerUp);
    // Pointer capture can retarget a release outside the app root (especially
    // on iOS Safari). Capture the lifecycle at window level as a fallback.
    on(window, 'pointermove', this.handlePointerMove, true);
    on(window, 'pointerup', this.handlePointerUp, true);
    on(window, 'pointercancel', this.handlePointerUp, true);
    on(window, 'resize', this.resize);
    on(window, 'keydown', this.handleKeyDown);
    on(this.renderer.domElement, 'click', this.handleSceneClick);
    on(this.renderer.domElement, 'dblclick', () => { if (this.cleanView) this.setCleanView(false); });
    on(this.renderer.domElement, 'pointerdown', event => { this.dragStart = { x: event.clientX, y: event.clientY }; });
    on(this.renderer.domElement, 'pointerup', event => {
      if (this.dragStart && Math.hypot(event.clientX - this.dragStart.x, event.clientY - this.dragStart.y) > 6) this.dragStart = null;
      if (!this.cleanView || event.pointerType !== 'touch') return;
      if (!this.dragStart) { this.lastCleanTap = null; return; }
      const now = event.timeStamp;
      const previous = this.lastCleanTap;
      this.lastCleanTap = { time: now, x: event.clientX, y: event.clientY };
      if (previous && now - previous.time < 350 && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) < 32) {
        this.dragStart = null;
        this.setCleanView(false);
        this.cleanTouchClickDeadline = performance.now() + 600;
      }
    });
  }

  handleClick = (event) => {
    const perspective = event.target.closest('[data-galaxy-view]');
    if (perspective) { this.setGalaxyPerspective(perspective.dataset.galaxyView); return; }
    const bodyButton = event.target.closest('[data-body]');
    if (bodyButton) {
      this.selectBody(bodyButton.dataset.body);
      return;
    }
    const journey = event.target.closest('[data-journey]');
    if (journey) {
      this.closeModal();
      this.selectBody(journey.dataset.journey);
      this.enterFlight(true);
      return;
    }
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;
    const action = actionButton.dataset.action;
    if (action === 'explore') {
      if (this.mode === 'flight') this.exitFlight();
      else if (this.view === 'galaxy') {
        this.showSolarSystem(true);
        if (this.selectedBody) this.selectBody(this.selectedBody.id, false);
        else this.overview();
      }
    }
    else if (action === 'flight') this.enterFlight(false);
    else if (action === 'galaxy') this.showGalaxy();
    else if (action === 'overview') this.overview();
    else if (action === 'pause') this.togglePause();
    else if (action === 'reset-time') { this.clock.reset(); this.showToast('Simulation date reset to January 1, 2026'); }
    else if (action === 'zoom-in') this.cameraRig.zoom(.72);
    else if (action === 'zoom-out') this.cameraRig.zoom(1.4);
    else if (action === 'recenter') this.view === 'galaxy' ? this.setGalaxyPerspective(this.galaxyPerspective) : this.mode === 'flight' ? this.flight.reset(this.selectedBody) : (this.selectedBody ? this.cameraRig.focus(this.selectedBody) : this.cameraRig.overview());
    else if (action === 'orbits') { this.settings.orbits = !this.settings.orbits; this.universe.setOrbits(this.settings.orbits); actionButton.classList.toggle('active', this.settings.orbits); this.persistSettings(); }
    else if (action === 'lock-orbit') this.toggleOrbitLock();
    else if (action === 'labels') { this.settings.labels = !this.settings.labels; this.updateLabels(); this.persistSettings(); actionButton.classList.toggle('active', this.settings.labels); }
    else if (action === 'autopilot') { if (this.mode !== 'flight') this.enterFlight(true); else this.flight.setDestination(this.selectedBody); this.showToast(`Navigation assist engaged · ${this.selectedBody?.data.name || 'Target'}`); }
    else if (action === 'brake') this.flight.brake();
    else if (action === 'pointer-lock') this.flight.engagePointerLock();
    else if (action === 'view') { this.flight.setView(this.flight.view === 'chase' ? 'cockpit' : 'chase'); this.updateFlightUI(this.flight._telemetry); }
    else if (action === 'reset-flight') { this.flight.reset(this.selectedBody); this.showToast('Spacecraft reset to a safe approach distance'); }
    else if (action === 'help') this.openModal('help');
    else if (action === 'settings') this.openModal('settings');
    else if (action === 'journeys') this.openModal('journeys');
    else if (action === 'about') this.openModal('about');
    else if (action === 'close-modal') this.closeModal();
    else if (action === 'close-panel') {
      this.root.querySelector('#object-panel').hidden = true;
      const selector = this.view === 'galaxy' ? '.mode-switch [data-action="galaxy"]' : this.selectedId ? `.body-button[data-body="${this.selectedId}"]` : '.mode-switch [data-action="explore"]';
      this.root.querySelector(selector)?.focus({ preventScroll: true });
    }
    else if (action === 'clean-view') this.setCleanView(!this.cleanView);
    else if (action === 'fullscreen') this.toggleFullscreen();
    else if (action === 'snapshot') this.snapshot();
  };

  handleChange = (event) => {
    const setting = event.target.dataset.setting;
    if (setting) {
      if (setting === 'orbits' || setting === 'labels') this.settings[setting] = event.target.checked;
      if (setting === 'quality') { this.settings.quality = event.target.value; this.universe.setQuality(this.settings.quality); }
      if (setting === 'quality') {
        this.galaxy.setQuality(this.settings.quality);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.settings.quality === 'high' ? 2 : 1.25));
        this.resize();
        if (this.view === 'galaxy') {
          this.renderObjectPanel(galaxyPanel(this.galaxy.starCount, this.galaxyPerspective));
          if (this.galaxyPerspective !== 'sky') this.root.querySelector('#view-detail').textContent = `${this.galaxy.starCount.toLocaleString('en-US')} STARS`;
        }
      }
      this.universe.setOrbits(this.settings.orbits);
      this.updateLabels();
      this.persistSettings();
      return;
    }
    if (event.target.id === 'time-speed') this.clock.setSpeed(event.target.value);
  };

  handlePointerDown = (event) => {
    const target = event.target;
    const input = target?.closest?.('[data-input]')?.dataset.input;
    if (this.mode !== 'flight') return;
    if (input) {
      event.preventDefault(); event.target.classList.add('pressed'); event.target.setPointerCapture?.(event.pointerId); this.flight.setInput(input, true);
      return;
    }
    if (event.pointerType !== 'touch' || target?.closest?.('button, a, select, input')) return;
    event.preventDefault();
    this.touchPointers.add(event.pointerId);
    if (target?.closest?.('[data-touch-thrust]')) this.beginTouchThrust(event);
    else if (!this.virtualJoystick) this.beginVirtualJoystick(event);
    if (this.touchPointers.size > 1) this.flight.setInput('boost', true);
  };
  handlePointerMove = (event) => {
    if (this.mode !== 'flight' || event.pointerType !== 'touch') return;
    if (this.virtualJoystick?.pointerId === event.pointerId) this.updateVirtualJoystick(event);
  };
  handlePointerUp = (event) => {
    const button = event.target?.closest?.('[data-input]');
    if (button) {
      button.classList.remove('pressed'); this.flight.setInput(button.dataset.input, false);
      return;
    }
    if (event.pointerType !== 'touch') return;
    if (this.virtualJoystick?.pointerId === event.pointerId) this.endVirtualJoystick(event);
    if (this.touchThrustPointers.delete(event.pointerId)) this.flight.setInput('forward', false);
    this.touchPointers.delete(event.pointerId);
    if (this.touchPointers.size < 2) this.flight.setInput('boost', false);
    if (this.touchThrustPointers.size === 0) this.root.querySelector('.touch-thrust-zone')?.classList.remove('active');
    if (this.touchPointers.size === 0) this.root.querySelector('.touch-flight-hint')?.removeAttribute('hidden');
  };

  beginVirtualJoystick(event) {
    const host = this.root.querySelector('#flight-touch-layer');
    const joystick = this.root.querySelector('#virtual-joystick');
    if (!host || !joystick) return;
    const rect = host.getBoundingClientRect();
    this.virtualJoystick = { pointerId: event.pointerId, x: event.clientX - rect.left, y: event.clientY - rect.top };
    joystick.style.left = `${this.virtualJoystick.x}px`;
    joystick.style.top = `${this.virtualJoystick.y}px`;
    joystick.classList.add('active');
    this.root.querySelector('.touch-flight-hint')?.setAttribute('hidden', '');
    try { event.target.setPointerCapture?.(event.pointerId); } catch { /* synthetic pointer events cannot be captured */ }
  }

  updateVirtualJoystick(event) {
    const joystick = this.root.querySelector('#virtual-joystick');
    if (!this.virtualJoystick || !joystick) return;
    const host = this.root.querySelector('#flight-touch-layer');
    const rect = host.getBoundingClientRect();
    const dx = event.clientX - rect.left - this.virtualJoystick.x;
    const dy = event.clientY - rect.top - this.virtualJoystick.y;
    const radius = 54;
    const length = Math.hypot(dx, dy);
    const scale = length > radius ? radius / length : 1;
    const x = dx * scale, y = dy * scale;
    joystick.querySelector('.virtual-joystick-knob').style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    const dead = radius * .2;
    this.setVirtualAction('left', x < -dead);
    this.setVirtualAction('right', x > dead);
    this.setVirtualAction('pitchUp', y < -dead);
    this.setVirtualAction('pitchDown', y > dead);
  }

  setVirtualAction(action, pressed) {
    const active = this.virtualActions.has(action);
    if (pressed === active) return;
    if (pressed) this.virtualActions.add(action);
    else this.virtualActions.delete(action);
    this.flight.setInput(action, pressed);
  }

  endVirtualJoystick(event) {
    try { event.target.releasePointerCapture?.(event.pointerId); } catch { /* synthetic or already-released pointer */ }
    for (const action of this.virtualActions) this.flight.setInput(action, false);
    this.virtualActions.clear();
    this.virtualJoystick = null;
    const joystick = this.root.querySelector('#virtual-joystick');
    joystick?.classList.remove('active');
  }

  beginTouchThrust(event) {
    this.touchThrustPointers.add(event.pointerId);
    this.flight.setInput('forward', true);
    try { event.target?.closest?.('[data-touch-thrust]')?.setPointerCapture?.(event.pointerId); } catch { /* synthetic pointer events cannot be captured */ }
    this.root.querySelector('.touch-thrust-zone')?.classList.add('active');
  }

  handleSceneClick = (event) => {
    if (this.cleanView || this.mode !== 'explore' || this.dragStart === null) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.universe.group.children, true);
    const hit = hits.find(item => item.object.userData.bodyId);
    if (hit) this.selectBody(hit.object.userData.bodyId);
    this.dragStart = null;
  };

  handleKeyDown = (event) => {
    if (event.key === 'Escape' && this.cleanView) { event.preventDefault(); this.setCleanView(false); return; }
    if (event.target?.matches('input,select,textarea,[contenteditable="true"]') || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === '?' || (event.shiftKey && event.key === '/')) { event.preventDefault(); this.openModal('help'); return; }
    if (event.key.toLowerCase() === 'h') { event.preventDefault(); if (!event.repeat) this.setCleanView(!this.cleanView); return; }
    const key = event.key?.toLowerCase();
    if (key === 'l') { this.toggleOrbitLock(); return; }
    if (this.mode === 'flight') return;
    if (event.code === 'Space') { event.preventDefault(); this.togglePause(); }
    if (key === 'r') { event.preventDefault(); this.overview(); }
    if (event.key === '1') this.overview();
    if (event.key === '2') this.showGalaxy();
  };

  selectBody(id, focus = true) {
    if (this.view === 'galaxy') this.showSolarSystem(false);
    const body = this.universe?.getBody(id);
    if (!body) return;
    this.selectedId = id;
    this.selectedBody = body;
    this.universe.selectBody(id, focus || this.mode === 'flight');
    this.renderObjectPanel(objectPanel(body.data, this.mode === 'flight'), true);
    this.root.querySelectorAll('.body-button').forEach(button => { const active = button.dataset.body === id; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
    this.root.querySelectorAll('.overview-button').forEach(button => button.classList.remove('active'));
    this.root.querySelector('#view-detail').textContent = body.data.name.toUpperCase();
    this.root.querySelector('.scene-location').innerHTML = `${body.data.name}<span>${body.data.type} · SOL SYSTEM</span>`;
    if (focus && this.mode === 'explore') this.cameraRig.focus(body);
    if (this.mode === 'flight' && this.flight.active && focus) this.flight.setDestination(body);
    this.updateLabels();
  }

  overview() {
    if (this.mode === 'flight') this.exitFlight();
    this.showSolarSystem(false);
    this.selectedId = null; this.selectedBody = null; this.universe.selectBody(null);
    this.root.querySelectorAll('.overview-button').forEach(button => button.classList.toggle('active', button.dataset.action === 'overview'));
    this.renderObjectPanel(overviewPanel(), true);
    this.root.querySelectorAll('.body-button').forEach(button => { button.classList.remove('active'); button.setAttribute('aria-pressed', 'false'); });
    this.root.querySelector('.scene-location').innerHTML = `Our solar system<span>NINE WORLDS · SOL SYSTEM</span>`;
    this.root.querySelector('#view-detail').textContent = 'SOL SYSTEM';
    const orbitHint = this.root.querySelector('.orbit-hint span');
    if (orbitHint) orbitHint.innerHTML = '<b>Drag</b> to rotate <i>·</i> <b>Scroll</b> to zoom <i>·</i> <b>Right drag</b> to pan';
    this.cameraRig.overview(); this.updateLabels();
  }

  showSolarSystem(focus = false) {
    this.renderer.setClearColor(0x060a10);
    this.cameraRig.orbitalMode();
    this.view = 'solar';
    document.body.dataset.view = 'solar';
    if (this.universe) this.universe.group.visible = true;
    if (this.galaxy) this.galaxy.group.visible = false;
    this.root.querySelector('.scene-heading .eyebrow').textContent = 'A UNIVERSE TO EXPLORE';
    this.root.querySelector('#view-label').textContent = this.mode === 'flight' ? 'FLIGHT DECK' : 'ORBITAL VIEW';
    this.root.querySelectorAll('.mode-switch button').forEach(button => {
      const active = button.dataset.action === (this.mode === 'flight' ? 'flight' : 'explore');
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    this.root.querySelectorAll('.overview-button').forEach(button => button.classList.toggle('active', button.dataset.action === 'overview' && !this.selectedBody));
    if (focus) this.cameraRig.overview();
    if (focus && this.selectedBody) this.cameraRig.focus(this.selectedBody);
  }

  showGalaxy() {
    this.renderer.setClearColor(0x010204);
    if (this.mode === 'flight') this.exitFlight();
    this.universe.focusDetail(null);
    this.view = 'galaxy';
    document.body.dataset.view = 'galaxy';
    this.universe.group.visible = false;
    this.galaxy.group.visible = true;
    this.orbitLocked = false;
    this.cameraRig.controls.enabled = true;
    this.root.querySelectorAll('.mode-switch button').forEach(button => {
      const active = button.dataset.action === 'galaxy';
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    this.root.querySelectorAll('.overview-button').forEach(button => button.classList.toggle('active', button.dataset.action === 'galaxy'));
    this.root.querySelectorAll('.body-button').forEach(button => { button.classList.remove('active'); button.setAttribute('aria-pressed', 'false'); });
    this.root.querySelector('.scene-heading .eyebrow').textContent = 'THE MILKY WAY';
    this.root.querySelector('.scene-location').innerHTML = 'Our galactic neighborhood<span>BARRED SPIRAL GALAXY · YOU ARE HERE</span>';
    this.renderObjectPanel(galaxyPanel(this.galaxy.starCount), true);
    this.root.querySelector('#view-label').textContent = 'GALACTIC VIEW';
    this.root.querySelector('#view-detail').textContent = 'MILKY WAY';
    this.setGalaxyPerspective(this.galaxyPerspective);
    this.updateLabels();
  }

  setGalaxyPerspective(perspective) {
    if (!['structure', 'edge', 'sky'].includes(perspective) || this.view !== 'galaxy') return;
    this.galaxyPerspective = perspective;
    this.galaxy.setPerspective(perspective);
    this.renderObjectPanel(galaxyPanel(this.galaxy.starCount, perspective));
    document.body.dataset.galaxyPerspective = perspective;
    this.root.querySelectorAll('[data-galaxy-view]').forEach(button => {
      const active = button.dataset.galaxyView === perspective;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
    });
    this.root.querySelector('.scene-location').innerHTML = perspective === 'sky'
      ? 'Beneath the Milky Way<span>360° OBSERVED SKY · OUR SOLAR NEIGHBORHOOD</span>'
      : 'Our galactic neighborhood<span>BARRED SPIRAL · THE ORION SPUR IS HOME</span>';
    this.root.querySelector('#view-detail').textContent = perspective === 'sky' ? 'VIEW FROM EARTH' : `${this.galaxy.starCount.toLocaleString('en-US')} STARS`;
    if (perspective === 'sky') this.cameraRig.galaxySky();
    else this.cameraRig.galaxy(false, perspective);
  }

  toggleOrbitLock() {
    if (this.mode === 'flight' || this.view === 'galaxy') return;
    this.orbitLocked = !this.orbitLocked;
    this.cameraRig.controls.enabled = !this.orbitLocked;
    const action = this.root.querySelector('[data-action="lock-orbit"]');
    action?.classList.toggle('active', this.orbitLocked);
    action?.setAttribute('aria-label', this.orbitLocked ? 'Unlock orbit camera (L)' : 'Lock orbit camera (L)');
    this.showToast(this.orbitLocked ? 'Orbit camera locked' : 'Orbit camera unlocked');
  }

  enterFlight(autopilot) {
    if (this.mode === 'flight') { if (autopilot && this.selectedBody) this.flight.setDestination(this.selectedBody); return; }
    if (this.view === 'galaxy') this.showSolarSystem(false);
    this.mode = 'flight'; document.body.dataset.mode = 'flight';
    this.universe.focusDetail(this.selectedId);
    this.preFlightPaused = this.clock.paused; this.clock.paused = true;
    this.cameraRig.controls.enabled = false;
    // An assisted journey launches from a neutral staging point, then flies
    // toward the selected body. This avoids the old "launch inside the
    // destination" behavior that made Earth/Mars approaches look erratic.
    this.flight.enter(autopilot ? null : this.selectedBody);
    if (autopilot) this.flight.setDestination(this.selectedBody);
    this.root.querySelectorAll('.mode-switch button').forEach(button => { const active = button.dataset.action === 'flight'; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
    this.root.querySelector('#view-label').textContent = 'FLIGHT DECK';
    this.renderObjectPanel(this.selectedBody ? objectPanel(this.selectedBody.data, true) : flightPanel());
    this.updateFlightUI(this.flight._telemetry);
  }

  exitFlight() {
    if (this.mode !== 'flight') return;
    this.flight.exit(); this.mode = 'explore'; document.body.dataset.mode = 'explore';
    this.clock.paused = this.preFlightPaused; this.cameraRig.controls.enabled = true;
    this.root.querySelectorAll('.mode-switch button').forEach(button => { const active = button.dataset.action === 'explore'; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
    this.root.querySelector('#view-label').textContent = 'ORBITAL VIEW';
    if (this.selectedBody) { this.renderObjectPanel(objectPanel(this.selectedBody.data)); this.cameraRig.focus(this.selectedBody); }
    else this.overview();
  }

  togglePause() {
    if (this.mode === 'flight') { this.flight.brake(); return; }
    this.clock.paused = !this.clock.paused;
    this.showToast(this.clock.paused ? 'Simulation paused' : 'Simulation running');
    this.updateSimulationUI();
  }

  updateSimulationUI() {
    const date = this.root.querySelector('#simulation-date');
    const state = this.root.querySelector('#time-state');
    const pause = this.root.querySelector('[data-action="pause"]');
    if (date) date.textContent = this.clock.date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase();
    if (state) { state.textContent = this.clock.paused ? 'PAUSED' : 'RUNNING'; state.className = this.clock.paused ? 'paused' : ''; }
    if (pause && this.pauseButtonState !== this.clock.paused) {
      this.pauseButtonState = this.clock.paused;
      pause.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${this.clock.paused ? '<path d="m8 4 12 8-12 8V4Z" fill="currentColor" stroke="none"/>' : '<path d="M9 5v14M15 5v14" stroke-width="3"/>'}</svg>`;
      pause.setAttribute('aria-label', this.clock.paused ? 'Resume simulation' : 'Pause simulation');
      pause.setAttribute('title', this.clock.paused ? 'Resume simulation' : 'Pause simulation');
    }
    if (this.mode === 'flight') this.updateFlightUI(this.flight._telemetry);
  }

  updateFlightUI(telemetry) {
    if (!telemetry) return;
    const speed = this.root.querySelector('#flight-speed');
    const distance = this.root.querySelector('#flight-distance');
    const target = this.root.querySelector('#flight-target');
    const state = this.root.querySelector('#flight-state');
    const fill = this.root.querySelector('#velocity-fill');
    const view = this.root.querySelector('#flight-view');
    if (!speed) return;
    speed.innerHTML = `${telemetry.speed.toFixed(1)} <small>u/s</small>`;
    distance.textContent = telemetry.distance ? `${telemetry.distance.toFixed(1)} u` : 'N/A';
    target.textContent = telemetry.autopilot ? (telemetry.arrived ? `Holding · ${telemetry.targetName}` : `Autopilot · ${telemetry.targetName}`) : 'Free flight';
    state.textContent = telemetry.warning || (telemetry.boosting ? 'BOOST VECTOR' : telemetry.autopilot ? (telemetry.arrived ? 'STATION KEEPING' : 'ASSISTED NAVIGATION') : 'MANUAL FLIGHT');
    fill.style.width = `${Math.min(100, telemetry.speed / 180 * 100)}%`;
    view.textContent = telemetry.view === 'chase' ? 'Cockpit view' : 'Chase view';
  }

  updateLabels() {
    const host = this.root.querySelector('#body-labels');
    if (!host) return;
    host.innerHTML = '';
    if (!this.settings.labels || this.mode === 'flight' || this.view === 'galaxy') return;
    const width = this.renderer.domElement.clientWidth, height = this.renderer.domElement.clientHeight;
    for (const body of this.universe?.bodies || []) {
      const point = body.position.clone().project(this.camera);
      if (point.z < -1 || point.z > 1) continue;
      const label = document.createElement('button');
      label.className = `body-label ${body.id === this.selectedId ? 'selected' : ''}`;
      label.dataset.body = body.id;
      label.textContent = body.data.name.toUpperCase();
      label.style.left = `${(point.x * .5 + .5) * width}px`;
      label.style.top = `${(-point.y * .5 + .5) * height + 8}px`;
      host.appendChild(label);
    }
  }

  renderObjectPanel(content, reopen = false) {
    const panel = this.root.querySelector('#object-panel');
    panel.innerHTML = content;
    panel.querySelector('.panel-eyebrow').insertAdjacentHTML('beforeend', `<button type="button" class="icon-button panel-close" data-action="close-panel" aria-label="Close description" title="Close description">${icon('close')}</button>`);
    if (reopen) panel.hidden = false;
  }

  setCleanView(enabled) {
    if (this.cleanView === enabled) return;
    if (enabled) this.cleanViewReturnFocus = document.activeElement;
    this.closeModal();
    this.cleanView = enabled;
    this.lastCleanTap = null;
    document.body.classList.toggle('clean-view', enabled);
    this.root.querySelectorAll('[data-action="clean-view"]').forEach(button => button.setAttribute('aria-pressed', String(enabled)));
    const hint = this.root.querySelector('#clean-view-hint');
    clearTimeout(this.cleanViewHintTimer);
    hint.hidden = !enabled;
    if (enabled) {
      hint.textContent = matchMedia('(pointer: coarse)').matches
        ? 'Clean view · Double-tap anywhere to show controls'
        : 'Clean view · Press H or Esc, or double-click to show controls';
      this.cleanViewHintTimer = setTimeout(() => { hint.hidden = true; }, 3200);
      this.renderer.domElement.focus({ preventScroll: true });
    } else {
      const previous = this.cleanViewReturnFocus;
      const focusTarget = previous?.isConnected && previous.getClientRects().length
        ? previous : this.renderer.domElement;
      focusTarget.focus({ preventScroll: true });
    }
    // The interface changes the canvas size without a window resize event.
    this.resize();
  }

  openModal(type) {
    if (this.cleanView) this.setCleanView(false);
    const dialog = this.root.querySelector('#modal');
    this.root.querySelector('#modal-content').innerHTML = modalContent(type, this.settings);
    if (!dialog.open) dialog.showModal();
  }
  closeModal() { const dialog = this.root.querySelector('#modal'); if (dialog?.open) dialog.close(); }
  showToast(message) { const toast = this.root.querySelector('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => toast.classList.remove('show'), 2600); }
  persistSettings() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings)); } catch { /* private browsing */ } }
  async toggleFullscreen() { try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); } catch { this.showToast('Fullscreen is not available here'); } }
  snapshot() { try { const link = document.createElement('a'); link.download = `cosmic-fusion-${this.clock.date.toISOString().slice(0, 10)}.png`; link.href = this.renderer.domElement.toDataURL('image/png'); link.click(); this.showToast('Space photograph saved'); } catch { this.showToast('Space photograph unavailable'); } }
  resize = () => { if (!this.renderer) return; const width = this.sceneHost.clientWidth || window.innerWidth; const height = this.sceneHost.clientHeight || window.innerHeight; this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height); this.updateLabels(); };

  dispose() {
    this.running = false; cancelAnimationFrame(this.frameId); this.bound.forEach(unbind => unbind());
    clearTimeout(this.cleanViewHintTimer); clearTimeout(this.toastTimer);
    document.body.classList.remove('clean-view');
    this.cameraRig?.dispose(); this.flight?.dispose(); this.universe?.dispose(); this.galaxy?.dispose(); this.renderer?.dispose();
    if (import.meta.env?.DEV && window.__COSMIC__?.app === this) delete window.__COSMIC__;
  }
}
