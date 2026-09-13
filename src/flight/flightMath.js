/** Flight helpers are independent of the renderer so safety rules stay testable. */
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const dampFactor = (rate, delta) => 1 - Math.exp(-rate * Math.max(0, delta));
export const surfaceClearance = (radius) => Math.max(1.8, radius * 0.18);
export const collisionRadius = (radius) => radius + surfaceClearance(radius);
export const arrivalRadius = (radius) => Math.max(9, radius * 2.65);

/** Return the first time [0, 1] a segment enters a sphere, including initial overlap. */
export function segmentSphereEntry(start, end, center, radius) {
  const sx = start.x - center.x, sy = start.y - center.y, sz = start.z - center.z;
  const dx = end.x - start.x, dy = end.y - start.y, dz = end.z - start.z;
  const c = sx * sx + sy * sy + sz * sz - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy + dz * dz;
  if (a < 1e-12) return null;
  const b = 2 * (sx * dx + sy * dy + sz * dz);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

/** Comfortable speed with enough stopping distance for the navigation controller. */
export function approachSpeed(distance, maxSpeed, acceleration = 30) {
  return Math.min(maxSpeed, Math.sqrt(2 * acceleration * Math.max(0, distance)));
}
