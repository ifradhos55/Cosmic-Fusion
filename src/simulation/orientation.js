import { Matrix4, Quaternion, Vector3 } from 'three';

const DAY = 86400000;
const J2000 = Date.UTC(2000, 0, 1, 12);
const RAD = Math.PI / 180;
const X = new Vector3(1, 0, 0), Y = new Vector3(0, 1, 0), Z = new Vector3(0, 0, 1);
// Horizons vectors use the fixed J2000 ecliptic. The renderer uses (x, z, -y).
const EQUATOR_TO_SCENE = new Quaternion().setFromAxisAngle(X, -(90 + 23.439291111) * RAD);
const angle = degrees => (degrees % 360) * RAD;

// E1...E13 and lunar pole/prime-meridian coefficients: NASA NAIF pck00011,
// IAU 2009 model. https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc
const LUNAR_ARGUMENTS = [
  [125.045, -.0529921], [250.089, -.1059842], [260.008, 13.0120009],
  [176.625, 13.3407154], [357.529, .9856003], [311.589, 26.4057084],
  [134.963, 13.0649930], [276.617, .3287146], [34.226, 1.7484877],
  [15.134, -.1589763], [119.743, .0036096], [239.961, .1643573], [25.053, 12.9590088],
];
const POLE_RA = [-3.8787, -.1204, .0700, -.0172, 0, .0072, 0, 0, 0, -.0052, 0, 0, .0043];
const POLE_DEC = [1.5419, .0239, -.0278, .0068, 0, -.0029, .0009, 0, 0, .0008, 0, 0, -.0009];
const MERIDIAN = [3.5610, .1208, -.0642, .0158, .0252, -.0066, -.0047, -.0046, .0028, .0052, .0040, .0019, -.0044];

/** Convert geographic axes to the axes of our unmodified SphereGeometry.
 * Both maps have 0° longitude at u=.5 (+X), north at +Y, 90° east at -Z.
 * Keeping this explicit prevents a 180° texture offset or mirrored longitude.
 */
function surfaceQuaternion(prime, north, target) {
  const west = new Vector3().crossVectors(prime, north).normalize();
  return target.setFromRotationMatrix(new Matrix4().makeBasis(prime, north, west));
}

/** Approximate UTC-aligned Earth geography in the fixed J2000 scene frame.
 * Mean sidereal time uses UTC as UT1 (no live Earth-orientation corrections).
 * Lieske's precession angles undo the equator/equinox-of-date rotation before
 * converting to the J2000 ecliptic; a fixed obliquity alone would drift.
 * GMST: https://aa.usno.navy.mil/faq/GAST
 */
export function earthOrientation(time, target = new Quaternion()) {
  const d = (time - J2000) / DAY, t = d / 36525;
  const gmst = angle(280.46061837 + 360.98564736629 * d + .000387933 * t * t - t ** 3 / 38710000);
  const zeta = (2306.2181 * t + .30188 * t * t + .017998 * t ** 3) * RAD / 3600;
  const z = (2306.2181 * t + 1.09468 * t * t + .018203 * t ** 3) * RAD / 3600;
  const theta = (2004.3109 * t - .42665 * t * t - .041833 * t ** 3) * RAD / 3600;
  const toScene = EQUATOR_TO_SCENE.clone()
    .multiply(new Quaternion().setFromAxisAngle(Z, -zeta))
    .multiply(new Quaternion().setFromAxisAngle(Y, theta))
    .multiply(new Quaternion().setFromAxisAngle(Z, -z));
  const prime = new Vector3(Math.cos(gmst), Math.sin(gmst), 0).applyQuaternion(toScene);
  const north = Z.clone().applyQuaternion(toScene);
  return surfaceQuaternion(prime, north, target);
}

/** IAU lunar attitude, including the small libration of the Earth-facing side.
 * TT approximates TDB; the fixed TT-UTC offset is for the contemporary (2017+)
 * simulation. Historical/future leap-second differences are not modeled. This
 * is a cartographic approximation, not a DE440 binary orientation kernel.
 */
export function moonOrientation(time, target = new Quaternion()) {
  const d = (time - J2000 + 69184) / DAY, t = d / 36525;
  const args = LUNAR_ARGUMENTS.map(([phase, rate]) => angle(phase + rate * d));
  const sum = (coefficients, fn) => coefficients.reduce((value, coefficient, i) => value + coefficient * fn(args[i]), 0);
  const ra = angle(269.9949 + .0031 * t + sum(POLE_RA, Math.sin));
  const dec = angle(66.5392 + .0130 * t + sum(POLE_DEC, Math.cos));
  const w = angle(38.3213 + 13.17635815 * d - 1.4e-12 * d * d + sum(MERIDIAN, Math.sin));
  const north = new Vector3(Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec));
  const node = new Vector3(-Math.sin(ra), Math.cos(ra), 0);
  const prime = node.clone().multiplyScalar(Math.cos(w))
    .addScaledVector(new Vector3().crossVectors(north, node), Math.sin(w));
  return surfaceQuaternion(prime.applyQuaternion(EQUATOR_TO_SCENE), north.applyQuaternion(EQUATOR_TO_SCENE), target);
}

/** Before JPL positions load, keep the illustrative Moon tidally locked too. */
export function lockedMoonOrientation(position, target = new Quaternion()) {
  const prime = position.clone().negate().normalize();
  const north = Y.clone().addScaledVector(prime, -prime.y).normalize();
  return surfaceQuaternion(prime, north, target);
}
