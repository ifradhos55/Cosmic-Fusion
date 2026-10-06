import { icon } from './icons.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const safeURL = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } };
const link = (url, title) => `<a href="${escape(safeURL(url))}" target="_blank" rel="noopener noreferrer">${escape(title)} ${icon('arrow')}</a>`;
const format = (value, digits = 0) => Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: digits }) : 'Unavailable';
const time = (value, dayOnly = false) => {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Unavailable';
  const text = new Date(value).toLocaleString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric',
    ...(dayOnly ? {} : { hour: '2-digit', minute: '2-digit', hour12: false }) });
  return `<time datetime="${escape(value)}">${escape(text)}${dayOnly ? '' : ' UTC'}</time>`;
};
const TITLES = { apod: 'Astronomy picture', weather: 'Space weather', asteroids: 'Asteroid approaches' };
const TYPES = { FLR: 'Solar flare', CME: 'Coronal mass ejection', GST: 'Geomagnetic storm', SEP: 'Solar energetic particles',
  IPS: 'Interplanetary shock', RBE: 'Radiation belt enhancement', MPC: 'Magnetopause crossing', HSS: 'High speed stream', Report: 'Daily report', report: 'Daily report' };

/** Loads on demand, independently of simulation time. Owns its dialog and requests. */
export class NasaPanel {
  constructor(root) {
    this.values = new Map();
    this.pending = new Map();
    this.retry = new Map();
    root.insertAdjacentHTML('beforeend', `<dialog id="nasa-panel" class="nasa-panel" aria-labelledby="nasa-title">
      <header class="nasa-header"><div><span class="eyebrow">CURRENT SPACE DATA</span><h2 id="nasa-title">NASA observations</h2></div><button class="icon-button" data-nasa-action="close" aria-label="Close NASA observations">${icon('close')}</button></header>
      <div class="nasa-toolbar"><p>Recent reports from NASA. Dates use real time, independent of the simulation clock.</p><button data-nasa-action="refresh">${icon('reset')}<span>Refresh feeds</span></button></div>
      <p class="nasa-summary" role="status" aria-live="polite">Open a feed to explore current observations.</p>
      <div class="nasa-grid">${['apod', 'weather', 'asteroids'].map(feed => `<section class="nasa-card nasa-${feed}" data-nasa-feed="${feed}" aria-label="${TITLES[feed]}"><h3>${TITLES[feed]}</h3><p>Waiting for NASA data.</p></section>`).join('')}</div>
      <footer class="nasa-footer">The solar system remains an illustrative model. These feeds do not set planet positions or change flight physics. Space weather reports are research data from NASA CCMC and the Moon to Mars Space Weather Analysis Office.</footer>
    </dialog>`);
    this.dialog = root.querySelector('#nasa-panel');
    this.onClick = event => {
      const action = event.target.closest('[data-nasa-action]')?.dataset.nasaAction;
      if (action === 'close') this.close();
      if (action === 'refresh') this.refresh(true);
      if (action === 'retry') this.load(event.target.closest('[data-nasa-retry]').dataset.nasaRetry, true);
    };
    this.onClose = () => {
      clearInterval(this.timer);
      for (const controller of this.pending.values()) controller.abort();
      this.pending.clear();
      for (const feed of Object.keys(TITLES)) this.render(feed);
      this.updateSummary();
      if (this.returnFocus?.isConnected && !this.returnFocus.closest('[inert]')) this.returnFocus.focus({ preventScroll: true });
    };
    this.onVisibility = () => { if (this.dialog.open && !document.hidden) this.refresh(); };
    this.dialog.addEventListener('click', this.onClick);
    this.dialog.addEventListener('close', this.onClose);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  open() {
    if (this.dialog.open) return;
    this.returnFocus = document.activeElement;
    this.dialog.showModal();
    this.dialog.scrollTop = 0;
    this.refresh();
    this.timer = setInterval(() => { if (!document.hidden) this.refresh(); }, 60_000);
  }

  close() { if (this.dialog.open) this.dialog.close(); }

  refresh(force = false) {
    for (const feed of Object.keys(TITLES)) this.load(feed, force);
  }

  async load(feed, force = false) {
    if (!this.dialog.open || this.pending.has(feed)) return;
    const previous = this.values.get(feed), now = Date.now();
    if ((this.retry.get(feed) || 0) > now) return;
    if (!force && previous && Date.parse(previous.retryAt || previous.nextRefreshAt) > now) return;
    const controller = new AbortController();
    this.pending.set(feed, controller);
    this.render(feed);
    this.updateSummary();
    const timeout = setTimeout(() => controller.abort('timeout'), 16_000);
    try {
      const response = await fetch(`/api/nasa?feed=${feed}`, { signal: controller.signal, cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.data || payload.feed !== feed || !payload.fetchedAt) {
        const retryAt = Date.parse(payload.retryAt);
        if (Number.isFinite(retryAt)) this.retry.set(feed, retryAt);
        throw new Error(payload.error || 'This NASA feed is unavailable.');
      }
      if (controller.signal.aborted) return;
      this.values.set(feed, payload);
      this.retry.delete(feed);
    } catch (error) {
      if (controller.signal.aborted && controller.signal.reason !== 'timeout') return;
      const message = error.name === 'TypeError' ? 'Cannot reach NASA. Check your connection and try again.'
        : controller.signal.aborted ? 'NASA took too long to respond. Try again shortly.' : error.message;
      this.values.set(feed, previous ? { ...previous, stale: true, warning: message } : { error: message });
      if (!this.retry.has(feed)) this.retry.set(feed, Date.now() + 60_000);
    } finally {
      clearTimeout(timeout);
      // A close followed by reopening can start a different request for this feed.
      if (this.pending.get(feed) === controller) {
        this.pending.delete(feed);
        this.render(feed);
        this.updateSummary();
      }
    }
  }

  updateSummary() {
    const loading = this.pending.size > 0;
    const button = this.dialog.querySelector('[data-nasa-action="refresh"]');
    button.disabled = loading;
    button.querySelector('span').textContent = loading ? 'Checking NASA' : 'Refresh feeds';
    const unavailable = [...this.values.values()].some(value => value.error || value.stale);
    this.dialog.querySelector('.nasa-summary').textContent = loading ? 'Checking NASA feeds. Each feed loads separately.'
      : unavailable ? 'Some feeds are unavailable or showing their last successful update.'
        : 'Feeds checked. Refresh reuses cached data until the next scheduled update.';
  }

  render(feed) {
    const card = this.dialog.querySelector(`[data-nasa-feed="${feed}"]`), value = this.values.get(feed);
    const loading = this.pending.has(feed);
    card.setAttribute('aria-busy', String(loading));
    const status = loading ? 'Checking' : value?.error ? 'Unavailable' : value?.stale ? 'Saved update' : 'Latest available';
    let content = '';
    if (value?.data) content = feed === 'apod' ? this.astronomy(value.data) : feed === 'weather' ? this.weather(value) : this.asteroids(value);
    else if (!value?.error) content = '<div class="nasa-loading"><span></span>Fetching NASA data</div>';
    const warning = value?.error || value?.warning;
    const retryAt = value?.retryAt || (this.retry.has(feed) ? new Date(this.retry.get(feed)).toISOString() : null);
    const waiting = retryAt && Date.parse(retryAt) > Date.now();
    card.innerHTML = `<div class="nasa-card-heading"><h3>${TITLES[feed]}</h3><span class="nasa-status ${warning ? 'nasa-status-warning' : ''}">${status}</span></div>
      ${warning ? `<div class="nasa-error"><p>${escape(warning)}</p>${value.data ? '<p>The values below are from the last successful update.</p>' : ''}${waiting ? `<p>Retry after ${time(retryAt)}</p>` : ''}<button data-nasa-action="retry" data-nasa-retry="${feed}" ${waiting ? 'disabled' : ''}>Try again</button></div>` : ''}${content}
      ${value?.fetchedAt ? `<div class="nasa-freshness"><span>Fetched ${time(value.fetchedAt)}</span><span>Next check ${time(value.retryAt || value.nextRefreshAt)}</span>${value.demo ? '<span>Shared demo key. Asteroid data is cached for two hours.</span>' : ''}</div>` : ''}`;
    const image = card.querySelector('img');
    if (image) image.addEventListener('error', () => {
      image.hidden = true;
      card.querySelector('.nasa-image-fallback').hidden = false;
    }, { once: true });
  }

  astronomy(item) {
    let image = safeURL(item.image);
    if (image && new URL(image).hostname === 'assets.science.nasa.gov') {
      const sized = new URL(image); sized.searchParams.set('w', '1000'); sized.searchParams.set('h', '800'); image = sized.href;
    }
    return `${image ? `<div class="nasa-image"><img src="${escape(image)}" alt="${escape(item.alt || item.title)}" loading="lazy" referrerpolicy="no-referrer"><p class="nasa-image-fallback" hidden>Image unavailable. Open the NASA article to view it.</p></div>` : '<div class="nasa-media-note">Today’s entry includes media available on the NASA article.</div>'}
      <div class="nasa-article"><span class="nasa-date">Published ${time(item.date, true)}</span><h4>${escape(item.title)}</h4>
      <p class="nasa-credit">${escape(item.credit ? `Credit: ${item.credit}` : 'Credit details on the NASA article.')}${item.copyright && item.copyright !== item.credit ? `<br>Copyright: ${escape(item.copyright)}` : ''}</p>
      <details><summary>Read the explanation</summary><p>${escape(item.explanation)}</p></details>${link(item.source, 'Read on NASA')}</div>`;
  }

  weather(value) {
    const { reports, total } = value.data;
    return `<p class="nasa-context">NASA notifications from ${time(value.window.start, true)} to ${time(value.window.end, true)}. Reports can include observations, forecasts and analysis.</p>
      ${reports.length ? `<div class="nasa-metric"><strong>${format(total)}</strong><span>notifications in the past seven days</span></div><div class="nasa-report-list">${reports.map(report => `<details class="nasa-report"><summary><span>${escape(TYPES[report.type] || report.type || 'Space weather report')}</span>${time(report.at)}</summary><div><p>${escape(report.body && report.body !== '##' ? report.body : 'Open the NASA report for the full analysis.')}</p>${link(report.source, 'NASA report')}</div></details>`).join('')}</div>${total > reports.length ? '<p class="nasa-context">Showing the twelve most recent notifications.</p>' : ''}` : '<div class="nasa-empty">NASA returned no notifications for this date range.</div>'}
      <div class="nasa-source-link">${link(value.source, 'NASA CCMC')}</div>`;
  }

  asteroids(value) {
    const { total, approaches } = value.data;
    const upcoming = approaches.filter(item => Date.parse(item.at) >= Date.now());
    const visible = upcoming.slice(0, 12);
    return `<p class="nasa-context">Earth approaches from ${time(value.window.start, true)} to ${time(value.window.end, true)}. These are NASA orbital predictions.</p>
      <div class="nasa-metric"><strong>${format(total)}</strong><span>approaches in the seven-day window</span></div>
      <p class="nasa-context">${format(upcoming.length)} still upcoming. Distances are measured from Earth’s center. LD is the mean Earth to Moon distance.</p>
      ${visible.length ? `<div class="nasa-approach-list">${visible.map(item => `<article class="nasa-approach"><div><h4>${escape(item.name)}</h4>${time(item.at)}</div>
        <dl><div><dt>Miss distance</dt><dd>${format(item.lunarDistances, 2)} LD<small>${format(item.distanceKm)} km</small></dd></div><div><dt>Estimated diameter</dt><dd>${format(item.diameterMin)} to ${format(item.diameterMax)} m</dd></div><div><dt>Relative speed</dt><dd>${format(item.speedKmS, 2)} km/s</dd></div></dl>
        ${item.hazardous ? '<span class="nasa-classification">NASA classifies this object as potentially hazardous</span>' : ''}${link(item.source, 'JPL orbit details')}</article>`).join('')}</div>` : '<div class="nasa-empty">No remaining approaches in the returned date range.</div>'}
      ${upcoming.length > visible.length ? '<p class="nasa-context">Showing the next twelve approaches.</p>' : ''}
      <p class="nasa-context">“Potentially hazardous” is an orbit and size classification. It is not a prediction of an impact.</p>`;
  }

  dispose() {
    this.close(); this.onClose();
    this.dialog.removeEventListener('click', this.onClick);
    this.dialog.removeEventListener('close', this.onClose);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.dialog.remove();
  }
}
