import * as THREE from 'three';

export function seededRandom(seed = 1) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const palettes = {
  mercury: [[75, 72, 69], [170, 157, 140]],
  venus: [[158, 115, 69], [245, 222, 163]],
  mars: [[77, 44, 32], [201, 127, 85]],
  jupiter: [[111, 76, 52], [240, 221, 184]],
  saturn: [[157, 133, 91], [242, 222, 176]],
  uranus: [[114, 167, 175], [173, 221, 224]],
  neptune: [[36, 73, 140], [115, 159, 198]],
  moon: [[58, 58, 58], [170, 168, 161]],
  sun: [[191, 59, 4], [255, 228, 137]],
  earth: [[4, 23, 56], [10, 53, 87]],
};

/** Seamless seeded surface maps. No per-frame texture or random allocation. */
export function createSurfaceTexture(id, anisotropy = 4) {
  const width = 1024, height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  const image = context.createImageData(width, height);
  const [low, high] = palettes[id] || palettes.moon;
  const gas = ['jupiter', 'saturn', 'uranus', 'neptune', 'venus'].includes(id);
  const rand = seededRandom(id.split('').reduce((a, v) => a + v.charCodeAt(0), 0));
  const phases = Array.from({ length: 7 }, () => rand() * 6.28);
  for (let y = 0; y < height; y++) {
    const latitude = (y / height - 0.5) * Math.PI;
    const latCos = Math.cos(latitude), latSin = Math.sin(latitude);
    for (let x = 0; x < width; x++) {
      const longitude = x / width * Math.PI * 2;
      const sx = Math.cos(longitude) * latCos, sz = Math.sin(longitude) * latCos;
      const noise = Math.sin(sx * 11 + phases[0] + Math.sin(sz * 8 + latSin * 9)) * .22
        + Math.sin(sz * 29 + phases[1] + Math.sin(sx * 18 + latSin * 19)) * .12
        + Math.sin(sx * 68 + latSin * 81 + Math.sin(sz * 47)) * .07
        + Math.sin(sz * 159 + sx * 126 + latSin * 147) * .04;
      let value = .55 + noise;
      if (gas) {
        const warp = Math.sin(longitude * 7 + latitude * 12) * .45 + Math.sin(longitude * 13 - latitude * 7) * .18;
        const bands = Math.sin(latitude * 37 + warp) * .18 + Math.sin(latitude * 73 + warp * 1.5) * .1;
        value = .58 + bands + noise * (id === 'venus' ? .7 : .3);
        if (id === 'saturn') value = .67 + bands * .48 + noise * .14;
        if (id === 'uranus') value = .68 + bands * .13 + noise * .05;
        if (id === 'neptune') value = .63 + bands * .24 + noise * .14;
        if (id === 'jupiter') {
          const spotX = (x / width - .7) / .052, spotY = (y / height - .62) / .039;
          const r = spotX * spotX + spotY * spotY;
          if (r < 1) value = .22 + Math.sin(r * 26 + longitude * 4) * .055;
        }
      }
      if (id === 'sun') value = .6 + noise * .9 + Math.sin(sx * 410 + latSin * 362 + sz * 127) * .07;
      const pixel = (y * width + x) * 4;
      const grain = (rand() - .5) * 5;
      for (let channel = 0; channel < 3; channel++) image.data[pixel + channel] = low[channel] + (high[channel] - low[channel]) * value + grain;
      image.data[pixel + 3] = 255;
      if (id === 'mars' && Math.abs(latitude) > 1.42 + noise * .1) {
        image.data[pixel] = 224; image.data[pixel + 1] = 219; image.data[pixel + 2] = 210;
      }
    }
  }
  context.putImageData(image, 0, 0);
  if (['mercury', 'moon', 'mars'].includes(id)) {
    for (let i = 0; i < (id === 'mars' ? 130 : 480); i++) {
      const x = rand() * width, y = rand() * height, radius = 1.2 + rand() ** 3 * 22;
      for (const offset of [-width, 0, width]) {
        const gradient = context.createRadialGradient(x + offset - radius * .13, y - radius * .18, radius * .25, x + offset, y, radius);
        gradient.addColorStop(0, 'rgba(16,12,10,0.28)'); gradient.addColorStop(.7, 'rgba(16,12,10,0.18)');
        gradient.addColorStop(.84, 'rgba(235,225,210,0.22)'); gradient.addColorStop(1, 'rgba(16,12,10,0)');
        context.fillStyle = gradient; context.beginPath(); context.ellipse(x + offset, y, radius, radius * .76, 0, 0, Math.PI * 2); context.fill();
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = anisotropy;
  return texture;
}

export function createRadialGlow() {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const glow = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  glow.addColorStop(0, 'rgba(255,232,171,0.7)'); glow.addColorStop(.17, 'rgba(255,197,103,0.35)');
  glow.addColorStop(.3, 'rgba(255,138,43,0.11)'); glow.addColorStop(.55, 'rgba(248,94,22,0.035)'); glow.addColorStop(1, 'rgba(245,100,20,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

export function createRingTexture() {
  const size = 1024;
  const pixels = new Uint8Array(size * 4);
  const random = seededRandom(747);
  for (let i = 0; i < size; i++) {
    const r = i / size;
    let opacity = .62 + Math.sin(r * 181) * .1 + Math.sin(r * 431) * .13 + random() * .18;
    if (r < .1) opacity *= r / .1 * .4;
    if (r > .49 && r < .535) opacity *= .045; // Cassini Division.
    if (r > .81 && r < .825) opacity *= .2;
    opacity *= Math.min(1, (1 - r) * 30);
    const light = .67 + Math.sin(r * 37) * .08 + random() * .14;
    pixels[i * 4] = 222 * light; pixels[i * 4 + 1] = 203 * light; pixels[i * 4 + 2] = 165 * light;
    pixels[i * 4 + 3] = Math.max(0, Math.min(255, opacity * 255));
  }
  const texture = new THREE.DataTexture(pixels, size, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
