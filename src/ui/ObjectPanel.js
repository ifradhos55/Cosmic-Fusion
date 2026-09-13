import { icon } from './icons.js';

const format = value => typeof value === 'number' ? value.toLocaleString('en-US') : value;
export function objectPanel(data, isFlight = false) {
  const orbital = data.orbitalPeriod ? data.orbitalPeriod >= 700 ? `${(data.orbitalPeriod / 365.25).toFixed(1)} years` : `${format(Math.round(data.orbitalPeriod))} days` : 'Galactic orbit';
  const rotation = Math.abs(data.rotationPeriod || 0) < 2 ? `${(Math.abs(data.rotationPeriod) * 24).toFixed(1)} hours` : `${Math.abs(data.rotationPeriod).toFixed(1)} days`;
  return `<div class="panel-eyebrow"><span class="status-dot"></span> ${isFlight ? 'NAVIGATION TARGET' : 'IN FOCUS'}<span class="catalog-id">SOL / ${String(data.order ?? 3).padStart(2, '0')}</span></div>
    <h1 id="body-title">${data.name}</h1><div class="body-type">${data.type}</div>
    <p class="body-description">${data.description}</p>
    <div class="distance-display"><span class="eyebrow">DISTANCE FROM SUN</span><div>${data.distanceAU || '0'}<span>AU</span></div><span class="distance-km">${data.distanceAU ? `${format(Math.round(data.distanceAU * 149.598))} million kilometers` : 'The heart of our solar system'}</span></div>
    <div class="body-facts"><div><span>Diameter</span><strong>${format(data.diameter)} <small>km</small></strong></div><div><span>Orbital period</span><strong>${orbital}</strong></div><div><span>Day length</span><strong>${rotation}</strong></div><div><span>Mean temperature</span><strong>${data.temperature}</strong></div></div>
    <div class="field-note"><div>${icon('sun')}<span class="eyebrow">FIELD NOTES</span></div><p>${data.fact}</p></div>
    <button class="primary-button" data-action="autopilot">${icon('ship')}<span>Fly to ${data.name}</span>${icon('arrow')}</button>
    <div class="panel-footnote">${isFlight ? 'Assisted navigation · Safe approach' : 'Your spacecraft is ready when you are'}</div>`;
}

export function overviewPanel() {
  return `<div class="panel-eyebrow"><span class="status-dot"></span> THE BIG PICTURE <span class="catalog-id">SOL</span></div><h1 id="body-title">Our solar<br>system.</h1><div class="body-type">One star. Countless possibilities.</div><p class="body-description">From the rocky inner worlds to the quiet ice giants, explore our small corner of the universe.</p><div class="overview-stats"><div><strong>4.6<span>B</span></strong><span>YEARS IN THE MAKING</span></div><div><strong>8</strong><span>WORLDS TO DISCOVER</span></div></div><div class="field-note"><div>${icon('orbit')}<span class="eyebrow">A DIFFERENT PERSPECTIVE</span></div><p>Select a world to get closer. Drag to change your perspective, or accelerate time to watch the planets trace their paths.</p></div><button class="primary-button" data-body="earth">${icon('target')}<span>Return to Earth</span>${icon('arrow')}</button><div class="panel-footnote">Distances and sizes compressed for exploration</div>`;
}

export function galaxyPanel(starCount = 260000, perspective = 'structure') {
  return `<div class="panel-eyebrow"><span class="status-dot"></span> GALACTIC NEIGHBORHOOD <span class="catalog-id">MW / 01</span></div><h1 id="body-title">The Milky<br>Way.</h1><div class="body-type">Our home galaxy</div><p class="body-description">A warm central bar, sweeping spiral arms, and dark rivers of interstellar dust. Orbit the full galaxy, or look along its star-filled disk from Earth.</p><div class="overview-stats"><div><strong>100<span>B+</span></strong><span>ESTIMATED STARS</span></div><div><strong>105<span>K</span></strong><span>LIGHT-YEAR DIAMETER</span></div></div><div class="field-note"><div>${icon('galaxy')}<span class="eyebrow">YOU ARE HERE</span></div><p>The gold marker is the Solar System, roughly 26,000 light-years from the galactic center.</p></div><button class="primary-button" data-action="overview">${icon('orbit')}<span>Return to solar system</span>${icon('arrow')}</button><div class="panel-footnote">${perspective === 'sky' ? 'Observed panorama · ESO/S. Brunier' : `${starCount.toLocaleString('en-US')} star particles · Structural reconstruction`}</div>`;
}
