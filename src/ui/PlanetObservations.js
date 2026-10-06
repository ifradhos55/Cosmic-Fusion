import { OBSERVATORIES } from '../data/observatories.js';
import { icon } from './icons.js';
import { escape, formatNumber as n, utcTime as time, sourceLink as link, freshness } from './dataFormatting.js';

const weatherUnavailable = '<p>No public live weather feed is available for this world.</p>';

export class PlanetObservations {
  constructor(app) {
    this.app = app; this.generation = 0;
    app.root.insertAdjacentHTML('beforeend', '<dialog id="planet-observations" class="nasa-panel planet-observations" aria-labelledby="observations-title"></dialog>');
    this.dialog = app.root.querySelector('#planet-observations');
    this.onClick = event => {
      const action = event.target.closest('[data-observation-action]')?.dataset.observationAction;
      if (action === 'close') this.close();
      if (action === 'load-dates') this.app.solarData.loadPositions(this.app.clock.date.toISOString().slice(0, 10));
      if (action === 'nasa') { this.close(); this.app.nasa.open(); }
      const tab = event.target.closest('[data-observation-tab]');
      if (tab) this.showTab(tab.dataset.observationTab);
      if (action === 'retry') this.showTab(this.tab, true);
    };
    this.onClose = () => { this.generation++; clearInterval(this.timer); this.returnFocus?.focus({ preventScroll: true }); };
    this.dialog.addEventListener('click', this.onClick); this.dialog.addEventListener('close', this.onClose);
  }
  open(body) {
    this.body = body; this.tab = 'position'; this.generation++;
    this.returnFocus = document.activeElement;
    const spec = OBSERVATORIES[body.id];
    this.dialog.innerHTML = `<header class="nasa-header"><div><span class="eyebrow">PLANETARY OBSERVATORY</span><h2 id="observations-title">${escape(body.data.name)} observations</h2></div><button class="icon-button" data-observation-action="close" aria-label="Close ${escape(body.data.name)} observations">${icon('close')}</button></header>
      <nav class="observation-tabs" aria-label="Observation sections">${[['position', 'Position'], ['weather', 'Atmosphere'], ['images', spec?.imagery || 'Terrain images']].map(([id, label]) => `<button data-observation-tab="${id}" aria-pressed="${id === 'position'}">${escape(label)}</button>`).join('')}</nav>
      <section id="observation-position" class="observation-section"></section><section id="observation-weather" class="observation-section" hidden></section><section id="observation-images" class="observation-section" hidden></section>
      <footer class="nasa-footer">Directions and orbital motion use NASA JPL vector tables interpolated at the displayed UTC time. Distances, body sizes and asteroid markers are compressed or enlarged for viewing. Weather and imagery keep their own observation dates.</footer>`;
    this.dialog.showModal(); this.dialog.scrollTop = 0;
    this.renderPosition();
    this.timer = setInterval(() => { if (this.tab === 'position') this.renderPosition(); }, 1000);
  }
  showTab(tab, force = false) {
    this.tab = tab;
    this.dialog.querySelectorAll('[data-observation-tab]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.observationTab === tab)));
    for (const name of ['position', 'weather', 'images']) this.dialog.querySelector(`#observation-${name}`).hidden = name !== tab;
    this.dialog.scrollTop = 0;
    if (tab === 'position') this.renderPosition();
    else this.loadTab(tab, force);
  }
  renderPosition() {
    if (!this.dialog.open) return;
    const host = this.dialog.querySelector('#observation-position'), ephemeris = this.app.universe.ephemeris;
    const at = this.app.clock.date.getTime(), metrics = ephemeris?.metrics(this.body.id, at);
    if (!metrics) {
      const text = this.app.solarData.positionLoading ? 'Loading JPL positions.' : 'Position data is unavailable for the displayed date.';
      if (!host.querySelector('[data-position-unavailable]')) host.innerHTML = '<p data-position-unavailable></p><button class="observation-button" data-observation-action="load-dates">Load positions for this date</button>';
      host.querySelector('[data-position-unavailable]').textContent = text;
      return;
    }
    // Do not rebuild a focused button while the user is pressing it.
    if (!host.querySelector('[data-position-metric]')) host.innerHTML = `<div class="observation-position-heading"><span class="eyebrow">${this.app.livePositions ? 'CURRENT UTC' : 'SIMULATION UTC'}</span><p data-position-time></p></div>
      <div class="observation-metrics">${[['sun', 'From Sun', 'AU'], ['earth', 'From Earth', 'AU'], ['speed', 'Orbital speed', 'km/s'], ['light', 'Light travel to Earth', 'min']].map(([key, title, unit]) => `<div><span>${title}</span><strong data-position-metric="${key}"></strong><small>${unit}</small></div>`).join('')}</div>
      <p class="nasa-context">Heliocentric J2000 ecliptic coordinates in AU. X and Y lie in the reference orbital plane; Z is perpendicular to it.</p>
      <dl class="observation-vectors">${['X', 'Y', 'Z'].map((axis, index) => `<div><dt>${axis}</dt><dd data-position-axis="${index}"></dd></div>`).join('')}</dl>
      <p class="nasa-context">${this.app.mode === 'flight' ? 'Orbital positions are held at the launch time during flight.' : 'Live now follows the real clock. Choosing a time warp advances the displayed date through the loaded ephemeris.'}</p>
      <div class="observation-source">${link(ephemeris.payload.source, 'NASA JPL Horizons')}<span>Tables fetched ${time(ephemeris.payload.fetchedAt)}</span><span>${ephemeris.payload.stale ? 'Saved ephemeris table' : 'Interpolated ephemeris'} · Coverage ${time(ephemeris.start, true)} to ${time(ephemeris.end, true)}</span></div>
      <button class="observation-button" data-observation-action="load-dates">Refresh date coverage</button>`;
    host.querySelector('[data-position-time]').innerHTML = time(at);
    for (const [key, value] of Object.entries({ sun: metrics.sunAU, earth: metrics.earthAU, speed: metrics.speedKmS, light: metrics.lightSeconds / 60 })) host.querySelector(`[data-position-metric="${key}"]`).textContent = n(value, key === 'light' ? 2 : 5);
    metrics.position.forEach((value, axis) => { host.querySelector(`[data-position-axis="${axis}"]`).textContent = value.toFixed(8); });
  }
  async loadTab(tab, force) {
    const host = this.dialog.querySelector(`#observation-${tab}`);
    if (host.dataset.loaded && !force) return;
    const generation = this.generation, body = this.body, spec = OBSERVATORIES[body.id];
    host.innerHTML = '<div class="nasa-loading"><span></span>Loading observations</div>'; host.setAttribute('aria-busy', 'true');
    try {
      let html;
      if (tab === 'images') {
        if (!spec) html = `<p>NASA mission imagery for this asteroid is available in the image catalogue.</p>${link(`https://images.nasa.gov/search?q=${encodeURIComponent(body.data.name)}`, 'Search NASA images')}`;
        else {
          const value = await this.app.solarData.fetch('images', body.id);
          html = `<h3>${escape(spec.imagery)}</h3><p class="nasa-context">NASA archive images. Archive dates are shown below; these are not live terrain updates. Descriptions identify radar, mosaics and processed color.</p>
            ${value.data.length ? `<div class="observation-gallery">${value.data.map(item => `<article><a href="${escape(item.source)}" target="_blank" rel="noopener noreferrer"><img loading="lazy" src="${escape(item.image)}" alt="${escape(item.title)}"></a><div><h4>${escape(item.title)}</h4><span class="nasa-date">Archive date ${time(item.date, true)}</span><p class="nasa-credit">${escape(item.credit)}</p><details><summary>Image details</summary><p>${escape(item.description)}</p></details>${link(item.source, 'Open NASA image')}</div></article>`).join('')}</div>` : `<p>No matching mission images were returned.</p>${link(`https://images.nasa.gov/search?q=${encodeURIComponent(body.data.name)}`, 'Search NASA images')}`}${freshness(value)}`;
        }
      } else html = await this.weather(body, spec);
      if (generation !== this.generation || !this.dialog.open) return;
      host.innerHTML = html; host.dataset.loaded = 'true';
      host.querySelectorAll('img').forEach(image => image.addEventListener('error', () => { image.replaceWith(Object.assign(document.createElement('p'), { className: 'nasa-context', textContent: 'Image unavailable. Use the NASA source link.' })); }, { once: true }));
    } catch {
      if (generation === this.generation && this.dialog.open) host.innerHTML = '<div class="nasa-error"><p>This observation service is unavailable. Other sections remain usable.</p><button data-observation-action="retry">Try again</button></div>';
    } finally { if (generation === this.generation) host.removeAttribute('aria-busy'); }
  }
  async weather(body, spec) {
    let html = `<h3>${escape(spec?.atmosphere || 'Atmosphere')}</h3><p>${escape(spec?.note || 'This is a small rocky body. No public live weather feed is available.')}</p>`;
    if (body.id === 'earth') {
      const outcomes = await Promise.allSettled([this.app.solarData.fetch('earth'), this.app.solarData.fetch('clouds')]);
      const stations = outcomes[0].status === 'fulfilled' ? outcomes[0].value : null, clouds = outcomes[1].status === 'fulfilled' ? outcomes[1].value : null;
      if (stations) html += `<h4>NOAA station observations</h4><div class="observation-weather-grid">${stations.data.observations.map(item => `<article><h4>${escape(item.name)}</h4><span class="nasa-date">Observed ${time(item.at)}</span><p>${escape(item.description)}</p><dl>${[['Air temperature', `${n(item.temperatureC)} °C`], ['Wind', `${n(item.windKmH)} km/h`], ['Pressure', `${n(item.pressurePa === null ? null : item.pressurePa / 100)} hPa`], ['Humidity', `${n(item.humidity)}%`]].map(([name, value]) => `<div><dt>${name}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>${link(item.source, 'NOAA observation')}</article>`).join('')}</div>${freshness(stations)}`;
      else html += '<p class="nasa-context">NOAA station readings are temporarily unavailable.</p>';
      if (clouds?.data.length) html += `<h4>Latest published EPIC Earth view</h4><p class="nasa-context">Observed ${time(clouds.data[0].date)}. This image is not a live global weather map.</p><img class="observation-earth-image" loading="lazy" src="${escape(clouds.data[0].image)}" alt="Sunlit Earth and cloud systems observed by DSCOVR EPIC"><p class="nasa-credit">NASA EPIC / NOAA DSCOVR</p>${link(clouds.source, 'EPIC observations')}${freshness(clouds)}`;
      else html += '<p class="nasa-context">EPIC imagery is temporarily unavailable.</p>';
    } else if (body.id === 'mars') {
      const value = await this.app.solarData.fetch('mars'), latest = value.data[0];
      if (!latest) return `${html}<p>No published Mars readings were returned.</p>`;
      const age = Math.max(0, Math.floor((Date.now() - Date.parse(latest.date)) / 86400000));
      html += `<span class="observation-age">${age > 2 ? 'Historical reading' : 'Recent published reading'} · ${age} days old</span><h4>Sol ${n(latest.sol, 0)} · ${time(latest.date, true)}</h4><p class="nasa-context">Gale Crater · NASA Curiosity REMS / Centro de Astrobiología. Air and ground temperatures differ.</p>
        <div class="observation-metrics"><div><span>Air minimum</span><strong>${n(latest.minC)}</strong><small>°C</small></div><div><span>Air maximum</span><strong>${n(latest.maxC)}</strong><small>°C</small></div><div><span>Ground minimum</span><strong>${n(latest.groundMinC)}</strong><small>°C</small></div><div><span>Pressure</span><strong>${n(latest.pressurePa)}</strong><small>Pa</small></div></div>
        <p>Reported conditions: ${escape(latest.conditions)}. Wind: ${n(latest.windMS)} m/s.</p><div class="observation-source">${link(value.source, 'NASA Mars weather')}</div>${freshness(value)}`;
    } else if (body.id === 'sun') html += '<p>Recent solar notifications are available in NASA observations.</p><button class="observation-button" data-observation-action="nasa">Open space weather reports</button>';
    else html += `${weatherUnavailable}${body.data.temperature ? `<p class="nasa-context">Reference mean temperature: ${escape(body.data.temperature)}. This is a climate reference, not a current measurement. Giant-planet values refer to atmospheric levels.</p>` : ''}`;
    return html + (spec ? `<div class="observation-source">${link(spec.source, `${body.data.name} data source`)}</div>` : '');
  }
  close() { if (this.dialog.open) this.dialog.close(); }
  dispose() { this.close(); this.onClose(); this.dialog.removeEventListener('click', this.onClick); this.dialog.removeEventListener('close', this.onClose); this.dialog.remove(); }
}
