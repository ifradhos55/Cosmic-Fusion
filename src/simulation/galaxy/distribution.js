import { seededRandom } from '../textures.js';

export const STAR_COUNTS = { high: 260000, balanced: 130000 };
export const GALAXY_RADIUS = 260;
export const SOLAR_POSITION = [108, 0.12, 71];
const TAU = Math.PI * 2;

/** Statistical reconstruction, not a catalogue of measured stellar positions.
 * Two major logarithmic arms, weaker gas-rich arms, an exponential disk,
 * a triaxial central bar/bulge, the local spur, and a sparse thick halo.
 * Components are interleaved so either quality level retains the same galaxy.
 */
export function generateGalaxy(count = STAR_COUNTS.high, seed = 92741) {
  const random = seededRandom(seed);
  const gaussian = () => Math.sqrt(-2 * Math.log(Math.max(1e-9, random()))) * Math.cos(TAU * random());
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const populations = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const population = random();
    let x, y, z, young = false, component;
    if (population < .18) {
      component = 0;
      const bulge = random() < .45;
      x = gaussian() * (bulge ? 17 : 36);
      z = gaussian() * (bulge ? 13 : 8);
      y = gaussian() * (bulge ? 8 : 3.2);
    } else if (population < .56) {
      component = 1;
      let r;
      do { r = -64 * Math.log(Math.max(1e-9, random() * random())); } while (r > GALAXY_RADIUS);
      const angle = random() * TAU;
      x = Math.cos(angle) * r; z = Math.sin(angle) * r;
      y = gaussian() * (2.3 + r * .014);
    } else if (population < .95) {
      component = 2;
      const minor = random() < .20;
      const arm = random() < .5 ? 0 : Math.PI;
      const cluster = random() < .28;
      const radius = cluster
        ? 45 + Math.floor(random()*95)/95*208 + gaussian()*1.8
        : 42 + Math.pow(random(), .83) * 214;
      const patch = Math.sin(radius * .125 + arm) * .032 + Math.sin(radius * .039) * .04;
      const angle = arm + (minor ? Math.PI / 2 : 0) + Math.log(radius / 48) * 3.4 + patch + gaussian() * (cluster ? .026 : minor ? .09 : .145);
      x = Math.cos(angle) * radius; z = Math.sin(angle) * radius;
      y = gaussian() * (1.1 + radius * .007);
      young = random() < .68;
    } else if (population < .975) {
      component = 3;
      const radius = 105 + random() * 52;
      const angle = .56 + (radius - 129) * .016 + gaussian() * .038;
      x = Math.cos(angle) * radius; z = Math.sin(angle) * radius;
      y = gaussian() * 1.2;
      young = true;
    } else {
      component = 4;
      x = gaussian() * 105; z = gaussian() * 105; y = gaussian() * 45;
    }
    const radius = Math.hypot(x, z);
    // A mild warp at the outer edge; the bar itself does not spin in seconds.
    y += Math.max(0, radius - 175) * .045 * Math.sin(Math.atan2(z, x) + .4);
    positions.set([x, y, z], i * 3);
    populations[i] = component;
    const rare = random();
    const luminosity = .2 + Math.pow(random(), 4) * 1.5;
    const warm = component === 0 || (!young && random() < .55);
    const color = young ? [.65, .79, 1.0] : warm ? [1.0, .82, .60] : [1.0, .96, .88];
    const theta = Math.atan2(z, x) - Math.log(Math.max(radius, 42) / 48) * 3.4;
    const turbulence = Math.sin(x*.075)*Math.sin(z*.069)*.15 + Math.sin((x+z)*.14)*.08;
    const lane = Math.pow(.5 + .5 * Math.cos(2 * (theta - .16 + turbulence)), 36);
    const extinction = 1 - lane * .65 * Math.exp(-Math.abs(y) / 2.2) * Math.min(1, radius / 55);
    const brightness = luminosity * extinction * (component === 4 ? .4 : 1);
    colors.set(color.map(value => value * brightness), i * 3);
    sizes[i] = rare > .998 ? 3.4 + random() * 1.5 : .72 + random() * .85;
  }
  return { positions, colors, sizes, populations };
}
