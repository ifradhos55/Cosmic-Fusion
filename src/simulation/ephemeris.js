export const AU_KM = 149597870.7;
export const DAY_MS = 86400000;
const MU_SUN = 0.0002959122082855911;
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = vector => Math.hypot(...vector);
const unit = vector => { const size = length(vector); return vector.map(value => value / size); };

/** Cubic Hermite interpolation retains Horizons' velocity and orbital curvature. */
export function sampleState(samples, at) {
  if (!samples?.length || at < samples[0][0] || at > samples.at(-1)[0]) return null;
  let low = 0, high = samples.length - 1;
  while (high - low > 1) { const middle = (low + high) >> 1; if (samples[middle][0] > at) high = middle; else low = middle; }
  if (low === samples.length - 1) low--;
  const first = samples[low], second = samples[low + 1];
  const span = (second[0] - first[0]) / DAY_MS, t = (at - first[0]) / (second[0] - first[0]), t2 = t * t, t3 = t2 * t;
  const p = [], v = [];
  for (let axis = 0; axis < 3; axis++) {
    const p0 = first[axis + 1], p1 = second[axis + 1], v0 = first[axis + 4], v1 = second[axis + 4];
    p.push((2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * span * v0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * span * v1);
    v.push(((6 * t2 - 6 * t) * p0 + (3 * t2 - 4 * t + 1) * span * v0 + (-6 * t2 + 6 * t) * p1 + (3 * t2 - 2 * t) * span * v1) / span);
  }
  return { position: p, velocity: v };
}

// Monotonic radial compression preserves the true heliocentric direction. It
// also places planets and asteroids at the same displayed position for equal AU.
const ANCHORS = [[0, 0], [.387, 15], [.723, 21], [1, 29], [1.524, 37], [5.203, 54], [9.537, 72], [19.191, 91], [30.069, 110]];
export function displayRadius(au) {
  const index = ANCHORS.findIndex(point => point[0] >= au);
  const upper = index < 0 ? ANCHORS.at(-1) : ANCHORS[Math.max(1, index)], lower = index < 0 ? ANCHORS.at(-2) : ANCHORS[Math.max(0, index - 1)];
  return lower[1] + (au - lower[0]) / (upper[0] - lower[0]) * (upper[1] - lower[1]);
}
export function scenePosition(position, moon = false) {
  const distance = length(position);
  const scale = moon ? 5.1 / .00257 : distance ? displayRadius(distance) / distance : 0;
  return [position[0] * scale, position[2] * scale, -position[1] * scale];
}

/** A guide ellipse from the instantaneous state, not a predicted trajectory. */
export function orbitGuide(state, count = 384) {
  if (!state) return [];
  const r = state.position, v = state.velocity, radius = length(r), h = cross(r, v);
  if (!radius || !length(h)) return [];
  const e = cross(v, h).map((value, axis) => value / MU_SUN - r[axis] / radius), eccentricity = length(e);
  const a = 1 / (2 / radius - dot(v, v) / MU_SUN);
  if (!(a > 0) || eccentricity >= 1) return [];
  const normal = unit(h), periapsis = eccentricity > 1e-8 ? unit(e) : unit(r), tangent = cross(normal, periapsis);
  return Array.from({ length: count }, (_, i) => {
    const angle = i * Math.PI * 2 / count, distance = a * (1 - eccentricity ** 2) / (1 + eccentricity * Math.cos(angle));
    return scenePosition(periapsis.map((value, axis) => distance * (value * Math.cos(angle) + tangent[axis] * Math.sin(angle))));
  });
}

export class Ephemeris {
  constructor(payload) {
    if (!payload?.data?.bodies?.earth) throw new Error('Missing Earth ephemeris');
    for (const body of Object.values(payload.data.bodies)) {
      if (!Array.isArray(body.samples) || body.samples.length < 2 || body.samples.some((row, i) => row.length !== 7 || row.some(value => !Number.isFinite(value)) || (i && row[0] <= body.samples[i - 1][0]))) throw new Error('Invalid ephemeris samples');
    }
    this.payload = payload; this.bodies = payload.data.bodies;
    this.start = payload.data.start; this.end = payload.data.end;
    if (!Number.isFinite(this.start) || !Number.isFinite(this.end) || this.start >= this.end || Object.values(this.bodies).some(body => body.samples[0][0] > this.start || body.samples.at(-1)[0] < this.end)) throw new Error('Invalid ephemeris coverage');
  }
  at(id, time) { return id === 'sun' ? { position: [0, 0, 0], velocity: [0, 0, 0] } : sampleState(this.bodies[id]?.samples, time); }
  metrics(id, time) {
    let state = this.at(id, time);
    const earth = this.at('earth', time);
    if (!state || !earth) return null;
    if (id === 'moon') state = { position: state.position.map((value, axis) => value + earth.position[axis]), velocity: state.velocity.map((value, axis) => value + earth.velocity[axis]) };
    const distanceEarth = length(state.position.map((value, axis) => value - earth.position[axis]));
    return { ...state, sunAU: length(state.position), earthAU: distanceEarth, speedKmS: length(state.velocity) * AU_KM / 86400, lightSeconds: distanceEarth * AU_KM / 299792.458 };
  }
}
