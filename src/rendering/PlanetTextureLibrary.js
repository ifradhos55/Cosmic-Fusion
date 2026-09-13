import * as THREE from 'three';

const FILES = {
  sun: 'sun', mercury: 'mercury', venus: 'venus_atmosphere', earth: 'earth_daymap',
  mars: 'mars', jupiter: 'jupiter', saturn: 'saturn', uranus: 'uranus', neptune: 'neptune', moon: 'moon',
};
const HIGH_RES = new Set(['sun', 'mercury', 'earth', 'mars', 'jupiter', 'saturn']);

/** All worlds retain small base maps; only the focused world owns an 8K map.
 * A generation token prevents late loads from changing a newer selection.
 */
export class PlanetTextureLibrary {
  constructor(anisotropy) {
    this.anisotropy = anisotropy;
    this.entries = new Map();
    this.textures = new Set();
    this.quality = 'high';
    this.generation = 0;
    this.errors = [];
  }
  load(filename, apply) {
    const url = `/assets/textures/${filename}`;
    const texture = new THREE.TextureLoader().load(url, loaded => {
      if (!this.disposed) apply(loaded);
    }, undefined, () => { if (!this.disposed) this.errors.push(url); });
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.anisotropy;
    texture.wrapS = THREE.RepeatWrapping;
    this.textures.add(texture);
    return texture;
  }
  register(id, apply, fallback = null) {
    const entry = { apply, base: fallback };
    this.entries.set(id, entry);
    this.load(`2k_${FILES[id]}.jpg`, texture => {
      entry.base = texture;
      if (this.high?.id !== id || !this.high.ready) apply(texture);
    });
  }
  focus(id, quality = this.quality) {
    if (this.selectedId === id && this.quality === quality) return;
    this.selectedId = id; this.quality = quality;
    const generation = ++this.generation;
    if (this.high) {
      const entry = this.entries.get(this.high.id);
      if (entry?.base) entry.apply(entry.base);
      this.high.texture.dispose(); this.textures.delete(this.high.texture);
      this.high = null;
    }
    if (quality !== 'high' || !HIGH_RES.has(id)) return;
    const texture = this.load(`8k_${FILES[id]}.jpg`, loaded => {
      if (generation !== this.generation) { loaded.dispose(); this.textures.delete(loaded); return; }
      this.high.ready = true;
      this.entries.get(id)?.apply(loaded);
    });
    this.high = { id, texture, ready: false };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.generation++;
    this.textures.forEach(texture => texture.dispose());
    this.textures.clear(); this.entries.clear();
  }
}
