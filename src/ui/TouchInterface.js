import { icon } from './icons.js';

/** Owns responsive navigation and pointer lifecycles for touch devices. */
export class TouchInterface {
  constructor(app) {
    this.app = app;
    this.root = app.root;
    this.listeners = [];
    this.pointers = new Map();
    this.sheet = null;
    this.portraitDismissed = false;
    this.media = matchMedia('(any-pointer: coarse), (max-width: 1024px)');
    this.root.querySelector('.main-shell').insertAdjacentHTML('beforeend', `
      <nav class="touch-dock" aria-label="Touch navigation">
        <button data-touch-action="worlds" aria-controls="touch-worlds" aria-expanded="false">${icon('grid')}<span>Worlds</span></button>
        <button data-touch-action="details" aria-controls="object-panel" aria-expanded="false">${icon('layers')}<span id="touch-details-label">Details</span></button>
        <button data-action="clean-view" aria-pressed="false">${icon('eye-off')}<span>Hide UI</span></button>
        <button data-action="help">${icon('help')}<span>Controls</span></button>
      </nav>`);
    this.root.insertAdjacentHTML('beforeend', '<button class="touch-sheet-backdrop" data-touch-action="close" aria-label="Close panel" hidden></button>');
    const sidebar = this.root.querySelector('.sidebar');
    sidebar.id = 'touch-worlds';
    sidebar.insertAdjacentHTML('afterbegin', `<div class="touch-sheet-heading"><div><span class="eyebrow">CHOOSE A VIEW</span><h2>Worlds</h2></div><button data-touch-action="close" aria-label="Close worlds">${icon('close')}</button></div>`);
    this.root.querySelector('.viewport').insertAdjacentHTML('beforeend', `
      <div class="touch-view-tools" aria-label="View controls">
        <button data-action="zoom-in" aria-label="Zoom in">${icon('plus')}</button>
        <button data-action="zoom-out" aria-label="Zoom out">${icon('minus')}</button>
        <button data-action="recenter" aria-label="Recenter view">${icon('target')}</button>
      </div>
      <div class="touch-orbit-tip">Drag to rotate <span>·</span> Pinch to zoom <span>·</span> Two fingers to pan</div>`);
    this.root.querySelector('#flight-hud').insertAdjacentHTML('beforeend', `
      <div class="flight-touch-layer" id="flight-touch-layer">
        <div class="touch-steer-zone" data-touch-steer aria-label="Drag here to steer the spacecraft">
          <span class="touch-zone-label">STEER<small>Touch and drag</small></span>
          <div class="virtual-joystick" id="virtual-joystick" aria-hidden="true"><div class="virtual-joystick-ring"></div><div class="virtual-joystick-knob"></div></div>
        </div>
        <div class="touch-thrust-zone" data-touch-thrust aria-label="Hold to thrust. Slide up for more thrust or down to reverse.">
          <span class="touch-zone-label">THRUST<small>Hold · Slide down to reverse</small></span>
          <div class="touch-throttle-meter"><i></i></div>
        </div>
        <div class="touch-flight-actions">
          <button data-action="brake" aria-label="Stop spacecraft">${icon('target')}<span>Stop</span></button>
          <button data-touch-hold="boost" aria-label="Hold to boost" aria-pressed="false">${icon('ship')}<span>Boost</span></button>
          <button data-action="view" aria-label="Switch spacecraft camera">${icon('eye')}<span>Camera</span></button>
        </div>
      </div>`);
    this.joystick = this.root.querySelector('#virtual-joystick');
    this.thrust = this.root.querySelector('[data-touch-thrust]');
    this.on(this.root, 'pointerdown', this.pointerDown);
    this.on(window, 'pointermove', this.pointerMove, { passive: false });
    this.on(window, 'pointerup', this.pointerUp);
    this.on(window, 'pointercancel', this.pointerUp);
    this.on(this.root, 'lostpointercapture', this.pointerUp);
    this.on(window, 'blur', () => this.resetGestures());
    this.on(document, 'visibilitychange', () => { if (document.hidden) this.resetGestures(); });
    this.on(window, 'resize', this.updateLayout);
    this.on(this.media, 'change', this.updateLayout);
    this.on(window, 'keydown', event => {
      if (event.key === 'Escape' && this.sheet) { this.closeSheet(); event.preventDefault(); }
      if (event.key !== 'Tab' || !this.sheet) return;
      const panel = this.sheet === 'worlds' ? sidebar : this.root.querySelector('#object-panel');
      const controls = [...panel.querySelectorAll('button,a,select,input')].filter(el => el.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { last?.focus(); event.preventDefault(); }
      else if (!event.shiftKey && document.activeElement === last) { first?.focus(); event.preventDefault(); }
    });
    this.updateLayout();
    this.syncDetails();
  }

  on(target, name, handler, options) {
    target.addEventListener(name, handler, options);
    this.listeners.push(() => target.removeEventListener(name, handler, options));
  }

  updateLayout = () => {
    const active = this.media.matches;
    const signature = `${innerWidth}:${innerHeight}:${active}`;
    const changed = signature !== this.layoutSignature;
    if (changed) this.resetGestures();
    this.layoutSignature = signature;
    document.body.toggleAttribute('data-touch-layout', active);
    this.app.flight.touchAssist = active;
    const details = this.root.querySelector('#object-panel');
    const parent = active ? this.root : this.root.querySelector('.viewport');
    if (details.parentElement !== parent) parent.appendChild(details);
    // Narrow folded screens get a rotation suggestion; tablets stay in portrait.
    document.body.toggleAttribute('data-phone-portrait', active && matchMedia('(any-pointer: coarse)').matches && innerWidth < 600 && innerHeight > innerWidth);
    document.body.toggleAttribute('data-portrait-ready', this.portraitDismissed);
    const sidebar = this.root.querySelector('.sidebar');
    sidebar.inert = active && this.sheet !== 'worlds';
    if (!active && this.sheet) this.closeSheet();
    this.app.cameraRig.controls.zoomToCursor = !active;
    this.app.cameraRig.controls.panSpeed = active ? .75 : 1;
    this.app.cameraRig.controls.zoomSpeed = active ? .65 : .8;
    this.syncDetails();
    this.app.resize();
    if (changed && this.app.mode === 'explore' && this.app.view === 'solar' && !this.app.selectedBody) this.app.cameraRig.overview(true);
  };

  handleClick(event) {
    const action = event.target.closest('[data-touch-action]')?.dataset.touchAction;
    if (!action) return false;
    if (action === 'portrait') {
      this.portraitDismissed = true;
      document.body.setAttribute('data-portrait-ready', '');
      this.app.resize();
    } else if (action === 'close') this.closeSheet();
    else if (action === 'details' || action === 'worlds') this.openSheet(action);
    return true;
  }

  openSheet(name) {
    if (this.sheet === name) { this.closeSheet(); return; }
    this.resetGestures();
    this.sheet = name;
    this.returnFocus = document.activeElement;
    document.body.dataset.touchSheet = name;
    this.root.querySelector('.touch-sheet-backdrop').hidden = false;
    this.root.querySelector('.sidebar').inert = name !== 'worlds';
    if (name === 'details') this.root.querySelector('#object-panel').hidden = false;
    this.syncDetails();
    const panel = name === 'worlds' ? this.root.querySelector('.sidebar') : this.root.querySelector('#object-panel');
    panel.querySelector('button')?.focus({ preventScroll: true });
  }

  closeSheet() {
    const wasOpen = this.sheet;
    this.sheet = null;
    delete document.body.dataset.touchSheet;
    this.root.querySelector('.touch-sheet-backdrop').hidden = true;
    this.root.querySelector('.sidebar').inert = this.media.matches;
    this.syncDetails();
    if (wasOpen) this.returnFocus?.focus({ preventScroll: true });
  }

  syncDetails() {
    if (!this.media) return;
    const panel = this.root.querySelector('#object-panel');
    panel.inert = this.media.matches && this.sheet !== 'details';
    this.root.querySelectorAll('[data-touch-action="worlds"], [data-touch-action="details"]').forEach(button => {
      button.setAttribute('aria-expanded', String(this.sheet === button.dataset.touchAction));
    });
    const label = this.root.querySelector('#touch-details-label');
    if (label) label.textContent = this.app.selectedBody?.data.name || (this.app.view === 'galaxy' ? 'Milky Way' : 'Details');
  }

  pointerDown = event => {
    if (!this.media.matches || this.app.mode !== 'flight' || this.sheet || this.app.cleanView) return;
    const control = event.target.closest('[data-touch-steer], [data-touch-thrust], [data-touch-hold]');
    if (!control || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const kind = control.hasAttribute('data-touch-steer') ? 'steer' : control.hasAttribute('data-touch-thrust') ? 'thrust' : 'boost';
    if ([...this.pointers.values()].some(p => p.kind === kind)) return;
    event.preventDefault();
    const point = { kind, control, x: event.clientX, y: event.clientY };
    this.pointers.set(event.pointerId, point);
    try { control.setPointerCapture(event.pointerId); } catch { /* Synthetic pointers have no native capture. */ }
    control.classList.add('active');
    if (kind === 'steer') {
      const rect = control.getBoundingClientRect();
      this.joystick.style.left = `${event.clientX - rect.left}px`;
      this.joystick.style.top = `${event.clientY - rect.top}px`;
      this.joystick.classList.add('active');
      this.joystick.querySelector('.virtual-joystick-knob').style.transform = 'translate(0px, 0px)';
    } else if (kind === 'thrust') this.setThrottle(.65);
    else { this.app.flight.setInput('boost', true); control.setAttribute('aria-pressed', 'true'); }
  };

  pointerMove = event => {
    const point = this.pointers.get(event.pointerId);
    if (!point) return;
    event.preventDefault();
    const dx = event.clientX - point.x, dy = event.clientY - point.y;
    if (point.kind === 'steer') {
      const radius = 48, length = Math.hypot(dx, dy);
      const scale = length > radius ? radius / length : 1;
      const amount = Math.max(0, Math.min(1, (length - 7) / (radius - 7)));
      this.app.flight.setTouchSteering(length ? dx / length * amount : 0, length ? dy / length * amount : 0);
      this.joystick.querySelector('.virtual-joystick-knob').style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
    } else if (point.kind === 'thrust') this.setThrottle(Math.max(-1, Math.min(1, .65 - dy / 64)));
  };

  setThrottle(value) {
    this.app.flight.setTouchThrottle(value);
    this.thrust.style.setProperty('--thrust', `${Math.abs(value) * 100}%`);
    this.thrust.querySelector('.touch-zone-label').innerHTML = `${value < 0 ? 'REVERSE' : 'THRUST'}<small>${Math.round(Math.abs(value) * 100)}% · Release to slow</small>`;
  }

  pointerUp = event => {
    const point = this.pointers.get(event.pointerId);
    if (!point) return;
    this.pointers.delete(event.pointerId);
    point.control.classList.remove('active');
    if (point.kind === 'steer') { this.app.flight.setTouchSteering(0, 0); this.joystick.classList.remove('active'); }
    else if (point.kind === 'thrust') {
      this.app.flight.setTouchThrottle(0);
      this.thrust.style.setProperty('--thrust', '0%');
      this.thrust.querySelector('.touch-zone-label').innerHTML = 'THRUST<small>Hold · Slide down to reverse</small>';
    } else { this.app.flight.setInput('boost', false); point.control.setAttribute('aria-pressed', 'false'); }
    try { if (point.control.hasPointerCapture(event.pointerId)) point.control.releasePointerCapture(event.pointerId); } catch { /* Capture already released. */ }
  };

  resetGestures() {
    for (const pointerId of [...this.pointers.keys()]) this.pointerUp({ pointerId });
    this.app.flight.setTouchSteering(0, 0);
    this.app.flight.setTouchThrottle(0);
  }

  dispose() {
    this.resetGestures();
    this.listeners.forEach(remove => remove());
    this.root.querySelector('.sidebar').inert = false;
    for (const attribute of ['data-touch-layout', 'data-touch-sheet', 'data-phone-portrait', 'data-portrait-ready']) document.body.removeAttribute(attribute);
  }
}
