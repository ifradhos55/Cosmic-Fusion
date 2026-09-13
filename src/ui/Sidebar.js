import { icon } from './icons.js';

export function sidebar(bodies) {
  return `<aside class="sidebar">
    <a class="brand" href="/" aria-label="Cosmic Fusion home"><span class="brand-symbol">${icon('orbit')}</span><span>COSMIC<span class="brand-light">FUSION</span></span></a>
    <div class="sidebar-content"><div class="eyebrow nav-caption">YOUR OBSERVATORY</div>
    <button class="overview-button" data-action="overview">${icon('grid')}<span>Solar system</span><span class="keycap">1</span></button>
    <button class="overview-button" data-action="galaxy">${icon('galaxy')}<span>Milky Way</span><span class="keycap">2</span></button>
    <div class="nav-section"><span class="eyebrow">CELESTIAL BODIES</span><span class="small-count">09</span></div>
    <nav class="body-nav" aria-label="Celestial bodies">${bodies.map((body, i) => `<button class="body-button" data-body="${body.id}" aria-pressed="false"><span class="planet-dot planet-${body.id}" style="--planet-color:${body.color}"></span><span>${body.name}</span><span class="body-number">${String(i).padStart(2, '0')}</span><span class="selected-dot"></span></button>`).join('')}</nav>
    <button class="journey-card" data-action="journeys"><span class="journey-top">${icon('compass')}<span>GO A LITTLE FURTHER</span></span><strong>The next frontier</strong><span class="journey-bottom">Choose your next journey ${icon('arrow')}</span></button></div>
    <div class="sidebar-footer"><span class="online-dot"></span>ALL SYSTEMS NOMINAL <span class="version">V2.0</span></div>
  </aside>`;
}
