import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PlanetTextureLibrary } from './PlanetTextureLibrary.js';

test('late texture loads cannot overwrite a new destination and quality changes release high-detail maps', () => {
  const originalLoad = THREE.TextureLoader.prototype.load;
  const requests = [];
  THREE.TextureLoader.prototype.load = function(url, callback) {
    const texture = new THREE.Texture();
    requests.push({ url, texture, finish: () => callback(texture) });
    return texture;
  };
  const library = new PlanetTextureLibrary(4);
  try {
    const surfaces = {};
    const fallback = new THREE.Texture();
    library.register('mars', texture => { surfaces.mars = texture; }, fallback);
    library.register('jupiter', texture => { surfaces.jupiter = texture; }, fallback);
    requests[0].finish(); requests[1].finish();
    library.focus('mars');
    const abandoned = requests.at(-1);
    library.focus('jupiter');
    const current = requests.at(-1);
    current.finish();
    abandoned.finish();
    assert.equal(surfaces.jupiter, current.texture);
    assert.equal(surfaces.mars, requests[0].texture);
    assert.equal(library.high.id, 'jupiter');
    assert.ok(!library.textures.has(abandoned.texture));
    let disposed = 0;
    current.texture.addEventListener('dispose', () => disposed++);
    library.focus('jupiter', 'balanced');
    assert.equal(disposed, 1);
    assert.equal(library.high, null);
    assert.equal(surfaces.jupiter, requests[1].texture);
    assert.equal(library.textures.size, 2);
    library.dispose(); library.dispose();
    assert.equal(library.textures.size, 0);
  } finally { library.dispose(); THREE.TextureLoader.prototype.load = originalLoad; }
});
