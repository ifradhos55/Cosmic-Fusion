import { Ephemeris } from '../simulation/ephemeris.js';

/** Keeps observation requests separate from animation, flight and time warp. */
export class SolarData {
  constructor(app) { this.app = app; this.status = 'loading'; this.values = new Map(); this.requests = new Map(); }
  start() {
    this.loadPositions();
    this.timer = setInterval(() => {
      if (document.hidden) return;
      if (!this.ephemeris || Date.parse(this.ephemeris.payload.nextRefreshAt) <= Date.now()) this.loadPositions();
    }, 300000);
  }
  async fetch(feed, body = '', date = '') {
    const key = `${feed}:${body}:${date}`, previous = this.values.get(key);
    if (previous && Date.parse(previous.nextRefreshAt) > Date.now()) return previous;
    if (this.requests.has(key)) return this.requests.get(key).promise;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), feed === 'ephemeris' ? 65000 : 16000);
    const promise = (async () => {
      const query = new URLSearchParams({ feed }); if (body) query.set('body', body); if (date) query.set('date', date);
      try {
        const response = await fetch(`/api/solar?${query}`, { signal: controller.signal, cache: 'no-store' });
        const value = await response.json();
        if (!response.ok || !value.data || value.feed !== feed) throw new Error(value.error || 'Observation data unavailable.');
        if (!this.disposed) this.values.set(key, value);
        return value;
      } finally { clearTimeout(timeout); this.requests.delete(key); }
    })();
    this.requests.set(key, { promise, controller });
    return promise;
  }
  async loadPositions(date = '') {
    if (this.positionLoading || (this.retryAt || 0) > Date.now()) return;
    this.positionLoading = true;
    this.status = this.ephemeris ? 'refreshing' : 'loading';
    try {
      this.apply(await this.fetch('ephemeris', '', date));
    } catch {
      this.retryAt = Date.now() + 300000;
      if (!this.ephemeris) {
        try {
          const response = await fetch('/data/ephemeris-snapshot.json', { signal: AbortSignal.timeout(10000) });
          if (response.ok) this.apply({ ...await response.json(), stale: true });
        } catch { /* The visible unavailable state is retained. */ }
      }
      this.status = this.ephemeris ? 'saved' : 'unavailable';
    } finally { this.positionLoading = false; }
  }
  apply(payload) {
    if (this.disposed) return;
    const ephemeris = new Ephemeris(payload);
    const at = this.app.clock.date.getTime();
    if (at < ephemeris.start || at > ephemeris.end) throw new Error('JPL tables do not cover the displayed date.');
    this.ephemeris = ephemeris;
    this.status = payload.stale ? 'saved' : 'ready';
    // Flight retains its launch snapshot. Install new tables after leaving flight.
    if (this.app.mode !== 'flight') this.install();
  }
  install() {
    if (!this.ephemeris) return;
    const time = this.app.clock.date.getTime();
    if (time >= this.ephemeris.start && time <= this.ephemeris.end) this.app.universe.setEphemeris(this.ephemeris, time);
  }
  dispose() {
    this.disposed = true; clearInterval(this.timer);
    for (const request of this.requests.values()) request.controller.abort();
    this.requests.clear();
  }
}
