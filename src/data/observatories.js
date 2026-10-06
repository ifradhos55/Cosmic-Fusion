export const OBSERVATORIES = Object.freeze({
  sun: { query: 'Sun solar surface SDO', imagery: 'Solar surface', atmosphere: 'Solar atmosphere', note: 'The Sun is a star. Its photosphere is plasma, not rocky terrain. Space weather reports describe flares, coronal mass ejections and their effects.', source: 'https://science.nasa.gov/sun/' },
  mercury: { query: 'Mercury MESSENGER surface', imagery: 'Surface terrain', atmosphere: 'Exosphere', note: 'Mercury has a very thin exosphere rather than an atmosphere that supports ordinary weather. No live surface weather station is available.', source: 'https://science.nasa.gov/mercury/facts/' },
  venus: { query: 'Venus Magellan radar surface', imagery: 'Radar terrain', atmosphere: 'Dense cloud deck', note: 'Venus has a carbon dioxide atmosphere and sulfuric acid clouds. Radar maps reveal terrain beneath the clouds. No public live surface weather feed is available.', source: 'https://science.nasa.gov/venus/venus-facts/' },
  earth: { query: 'Earth Landsat terrain', imagery: 'Earth terrain', atmosphere: 'Clouds and station observations', note: 'EPIC shows the sunlit hemisphere on its latest available observation date. NOAA readings are local station measurements, not a global average.', source: 'https://epic.gsfc.nasa.gov/' },
  mars: { query: 'Mars Curiosity surface terrain', imagery: 'Rover terrain', atmosphere: 'Curiosity REMS', note: 'REMS measures conditions at Curiosity in Gale Crater. The latest published sol may be delayed. These outreach readings do not describe the whole planet.', source: 'https://mars.nasa.gov/msl/weather/' },
  jupiter: { query: 'Jupiter Juno clouds', imagery: 'Cloud tops', atmosphere: 'Cloud bands and storms', note: 'Jupiter has no solid surface to photograph. Images show cloud tops, sometimes with enhanced color. No public live weather station feed is available.', source: 'https://science.nasa.gov/jupiter/facts/' },
  saturn: { query: 'Saturn Cassini atmosphere clouds', imagery: 'Cloud tops and rings', atmosphere: 'Cloud bands and storms', note: 'Saturn has no solid surface. Cassini images are historical observations of its atmosphere and rings. No public live weather station feed is available.', source: 'https://science.nasa.gov/saturn/facts/' },
  uranus: { query: 'Uranus Voyager atmosphere', imagery: 'Atmosphere', atmosphere: 'Methane clouds', note: 'Uranus has no solid surface. Voyager and telescope images show its atmosphere, often in processed color. No public live weather station feed is available.', source: 'https://science.nasa.gov/uranus/facts/' },
  neptune: { query: 'Neptune Voyager clouds', imagery: 'Atmosphere', atmosphere: 'Clouds and dark spots', note: 'Neptune has no solid surface. Spacecraft and telescope images document atmospheric features at their observation dates. No public live weather station feed is available.', source: 'https://science.nasa.gov/neptune/facts/' },
});

export const CATALOGUE_ASTEROIDS = Object.freeze([
  { id: 'ceres', command: '1;', name: 'Ceres', diameterKm: 939, type: 'Dwarf planet · Main belt' },
  { id: 'pallas', command: '2;', name: 'Pallas', diameterKm: 513, type: 'Asteroid · Main belt' },
  { id: 'vesta', command: '4;', name: 'Vesta', diameterKm: 525, type: 'Asteroid · Main belt' },
  { id: 'eros', command: '433;', name: 'Eros', diameterKm: 16.8, type: 'Near-Earth asteroid' },
  { id: 'apophis', command: '99942;', name: 'Apophis', diameterKm: .34, type: 'Near-Earth asteroid' },
]);

export const PLANET_COMMANDS = Object.freeze({ mercury: '199', venus: '299', earth: '399', mars: '499',
  jupiter: '599', saturn: '699', uranus: '799', neptune: '899', moon: '301' });
